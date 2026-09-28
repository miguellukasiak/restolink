"""Subscription billing: Stripe Checkout, and the webhook that grants access.

Two routers, because the two halves have opposite trust models.

`/api/v1/subscriptions` is the owner asking to pay, behind the usual bearer
token. `/api/v1/webhooks/stripe` is Stripe telling us they did, and it is
**unauthenticated by necessity** — Stripe has no token of ours. Its signature
check is therefore the whole of its security, which is why a missing signing
secret refuses the request rather than waving it through: an endpoint that
skipped verification would be an open door for marking any restaurant as paid.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from .. import audit, stripe_service
from ..database import get_db
from ..dependencies import get_current_restaurant
from ..models import (
    PaymentHistory,
    PaymentMethod,
    PaymentStatus,
    Restaurant,
    RestaurantStatus,
)
from ..schemas import CheckoutSessionResponse, WebhookAck
from ..security import as_utc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/subscriptions", tags=["Subscriptions"])
webhook_router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks"])

#: Fallback period when the event does not say when the paid month ends.
DEFAULT_PERIOD = timedelta(days=30)

#: The events that grant access. `checkout.session.completed` is the first
#: payment; `invoice.payment_succeeded` is every renewal after it — and also
#: fires alongside the first one, which is why the idempotency guard below is
#: not optional.
GRANTING_EVENTS = frozenset(
    {"checkout.session.completed", "invoice.payment_succeeded"}
)

#: Recorded as the actor in the audit trail. Not an email, and deliberately
#: shaped so it cannot collide with one: nobody signed in to cause this.
WEBHOOK_ACTOR = "system:stripe-webhook"


# --------------------------------------------------------------------------- #
# Checkout
# --------------------------------------------------------------------------- #


@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    restaurant: Restaurant = Depends(get_current_restaurant),
) -> CheckoutSessionResponse:
    """Start a Stripe Checkout for the signed-in restaurant.

    The restaurant comes from the token, never from the request body — a
    checkout that let the caller name the account being subscribed would let
    one owner pay another's bill, or more usefully to an attacker, claim it.
    """
    if not stripe_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Płatności nie są jeszcze skonfigurowane na serwerze.",
        )

    base = stripe_service.app_base_url()
    panel = f"{base}/panel/{restaurant.id}/menu"

    try:
        url = await stripe_service.create_checkout_session(
            restaurant_id=str(restaurant.id),
            restaurant_name=restaurant.name,
            customer_email=restaurant.email or restaurant.contact_email,
            stripe_customer_id=restaurant.stripe_customer_id,
            # The query flag is what tells the panel to refetch on return, so
            # the warning banner disappears without the owner reloading.
            success_url=f"{panel}?checkout=success",
            cancel_url=f"{panel}?checkout=cancelled",
        )
    except stripe_service.StripeNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Płatności nie są jeszcze skonfigurowane na serwerze.",
        ) from exc
    except stripe_service.StripeCallFailed as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nie udało się otworzyć płatności. Spróbuj ponownie za chwilę.",
        ) from exc

    logger.info("Checkout session opened for restaurant %s", restaurant.id)
    return CheckoutSessionResponse(checkout_url=url)


# --------------------------------------------------------------------------- #
# Webhook
# --------------------------------------------------------------------------- #


async def _already_processed(db: AsyncSession, event_id: str) -> bool:
    existing = await db.scalar(
        select(PaymentHistory.id).where(
            PaymentHistory.external_transaction_id == event_id
        )
    )
    return existing is not None


async def _find_restaurant(
    db: AsyncSession, obj: dict
) -> Restaurant | None:
    """Resolve the paying restaurant from the event.

    By id when the event carries one, otherwise by the Stripe customer we
    remembered at the first checkout. Renewal invoices only ever have the
    latter.
    """
    raw_id = stripe_service.restaurant_id_from(obj)
    if raw_id:
        try:
            parsed = uuid.UUID(raw_id)
        except ValueError:
            logger.warning("Stripe event carried an unparseable restaurant id.")
        else:
            found = await db.get(
                Restaurant, parsed, options=[noload(Restaurant.package)]
            )
            if found is not None and found.deleted_at is None:
                return found

    customer_id = stripe_service.customer_id_from(obj)
    if customer_id:
        return await db.scalar(
            select(Restaurant).where(
                Restaurant.stripe_customer_id == customer_id,
                Restaurant.deleted_at.is_(None),
            )
        )

    return None


def _next_valid_until(current: datetime | None, period_end: datetime | None) -> datetime:
    """Extend the subscription without ever shortening it.

    Stretches from whichever is later, now or the existing expiry, so paying
    early adds to the remaining time instead of throwing it away. Stripe's own
    period end wins when it is in the future, because that is the date the card
    will actually be charged against again.
    """
    now = datetime.now(timezone.utc)
    base = max(now, as_utc(current)) if current else now

    if period_end and period_end > base:
        return period_end
    return base + DEFAULT_PERIOD


@webhook_router.post("/stripe", response_model=WebhookAck)
async def stripe_webhook(
    request: Request, db: AsyncSession = Depends(get_db)
) -> WebhookAck:
    """Grant subscription access on a verified Stripe payment event.

    The body is read with `await request.body()` and never through a Pydantic
    model. The signature is computed over the exact bytes Stripe sent, so any
    parse-and-reserialise round trip — different whitespace, different key order
    — fails verification for every genuine event while accepting nothing extra.

    Everything that is not a payment we act on returns 200 and does nothing.
    Stripe retries non-2xx responses with backoff for days, so answering an
    error to an event we simply do not care about buys a queue of retries and
    no information.
    """
    payload = await request.body()
    signature = request.headers.get("stripe-signature")

    try:
        event = stripe_service.verify_webhook(payload, signature)
    except stripe_service.StripeNotConfigured as exc:
        # Our misconfiguration, so 500 — and Stripe *should* retry this one,
        # because the event is real and will be processable once the secret is
        # in place.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret is not configured.",
        ) from exc
    except Exception as exc:  # noqa: BLE001 — bad signature, bad JSON, no header
        # 400 on purpose: Stripe treats it as final and stops retrying, which is
        # right for a payload that will never verify.
        logger.warning("Rejected a Stripe webhook: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe signature.",
        ) from exc

    event_id = str(event.get("id") or "")
    event_type = str(event.get("type") or "")

    if event_type not in GRANTING_EVENTS:
        logger.info("Ignoring Stripe event %s (%s)", event_id, event_type)
        return WebhookAck(status="ignored", event_type=event_type)

    if event_id and await _already_processed(db, event_id):
        # A retry, or the sibling event describing the same first payment.
        logger.info("Stripe event %s already processed.", event_id)
        return WebhookAck(status="duplicate", event_type=event_type)

    obj = stripe_service.event_object(event)
    restaurant = await _find_restaurant(db, obj)
    if restaurant is None:
        # 200, not 404. The event verified, so it is genuinely ours; retrying it
        # for days will not make an unknown restaurant appear, and a stuck
        # webhook queue hides the events that do matter.
        logger.error(
            "Stripe event %s (%s) could not be matched to a restaurant.",
            event_id,
            event_type,
        )
        return WebhookAck(status="unmatched", event_type=event_type)

    # Remember the customer so renewals, which carry no restaurant id, can be
    # attributed later.
    customer_id = stripe_service.customer_id_from(obj)
    if customer_id and restaurant.stripe_customer_id != customer_id:
        restaurant.stripe_customer_id = customer_id

    restaurant.subscription_valid_until = _next_valid_until(
        restaurant.subscription_valid_until, stripe_service.period_end_from(obj)
    )
    # The "payment lock" in this schema is the status itself: PENDING hides the
    # public menu, BLOCKED locks the panel. A paid subscription clears both.
    restaurant.status = RestaurantStatus.ACTIVE

    amount = stripe_service.amount_from(obj)
    db.add(
        PaymentHistory(
            restaurant_id=restaurant.id,
            amount=amount,
            status=PaymentStatus.SUCCESS,
            payment_method=PaymentMethod.GATEWAY,
            # The event id, not the payment id: this column is what makes the
            # handler idempotent, so it has to be unique per *delivery*.
            external_transaction_id=event_id or None,
            payment_date=datetime.now(timezone.utc),
        )
    )
    await audit.record(
        db,
        admin_email=WEBHOOK_ACTOR,
        action=audit.SUBSCRIPTION_PAID,
        target_entity=(
            f"{restaurant.name} ({restaurant.id}) — {amount:.2f} — "
            f"do {restaurant.subscription_valid_until:%Y-%m-%d}"
        ),
    )

    try:
        await db.commit()
    except IntegrityError:
        # Two retries arriving together: the unique index on the event id let
        # exactly one through. The other did its work for nothing, which is the
        # correct outcome.
        await db.rollback()
        logger.info("Stripe event %s raced another delivery; kept one.", event_id)
        return WebhookAck(status="duplicate", event_type=event_type)

    logger.info(
        "Stripe %s activated restaurant %s until %s",
        event_type,
        restaurant.id,
        restaurant.subscription_valid_until,
    )
    return WebhookAck(status="processed", event_type=event_type)
