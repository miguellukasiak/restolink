"""Stripe Checkout and webhook verification.

Configuration comes exclusively from the environment — never hardcode keys:

    STRIPE_API_KEY          secret key (sk_…) for server-side calls
    STRIPE_WEBHOOK_SECRET   signing secret (whsec_…) for the endpoint
    STRIPE_PRICE_ID         the recurring price the checkout subscribes to
    APP_BASE_URL            front-end origin, for success and cancel URLs

Read lazily rather than at import, so a deployment that sets the variables
after the process starts — and a test that sets them per case — behaves the
same as one that had them all along.

The Stripe SDK is synchronous. Network calls go through `run_in_threadpool`;
signature verification is local HMAC work and stays on the event loop.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import stripe
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)


class StripeNotConfigured(RuntimeError):
    """A required Stripe environment variable is missing."""


class StripeCallFailed(RuntimeError):
    """Stripe refused or could not answer a request."""


def _env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        logger.error("%s is not set — Stripe billing is unavailable.", name)
        raise StripeNotConfigured(name)
    return value


def app_base_url() -> str:
    return os.getenv(
        "APP_BASE_URL", "https://restolink-vert.vercel.app"
    ).rstrip("/")


def is_configured() -> bool:
    """Whether checkout can be attempted at all."""
    return bool(
        os.getenv("STRIPE_API_KEY", "").strip()
        and os.getenv("STRIPE_PRICE_ID", "").strip()
    )


# --------------------------------------------------------------------------- #
# Checkout
# --------------------------------------------------------------------------- #


async def create_checkout_session(
    *,
    restaurant_id: str,
    restaurant_name: str,
    customer_email: str | None,
    stripe_customer_id: str | None,
    success_url: str,
    cancel_url: str,
) -> str:
    """Open a Checkout Session and return the URL to send the owner to.

    `client_reference_id` carries the restaurant id, which is the only thing
    that lets the webhook attribute the payment. It is set three ways on
    purpose — on the session, in the session metadata, and on the subscription
    the session creates — because the first two reach
    `checkout.session.completed` and the third is what survives into the
    monthly `invoice.payment_succeeded` events that follow.
    """
    api_key = _env("STRIPE_API_KEY")
    price_id = _env("STRIPE_PRICE_ID")

    params: dict[str, Any] = {
        "mode": "subscription",
        "line_items": [{"price": price_id, "quantity": 1}],
        "client_reference_id": restaurant_id,
        "metadata": {"restaurant_id": restaurant_id, "restaurant_name": restaurant_name},
        "subscription_data": {"metadata": {"restaurant_id": restaurant_id}},
        "success_url": success_url,
        "cancel_url": cancel_url,
        # Stripe insists on one or the other, never both.
        **(
            {"customer": stripe_customer_id}
            if stripe_customer_id
            else {"customer_email": customer_email} if customer_email else {}
        ),
    }

    try:
        session = await run_in_threadpool(
            lambda: stripe.checkout.Session.create(api_key=api_key, **params)
        )
    except Exception as exc:  # noqa: BLE001 — SDK raises a family of errors
        logger.exception("Stripe refused to create a checkout session")
        raise StripeCallFailed(str(exc)) from exc

    url = getattr(session, "url", None) or (
        session.get("url") if isinstance(session, dict) else None
    )
    if not url:
        raise StripeCallFailed("Stripe returned a session without a URL.")
    return str(url)


# --------------------------------------------------------------------------- #
# Webhooks
# --------------------------------------------------------------------------- #


def verify_webhook(payload: bytes, signature: str | None) -> dict[str, Any]:
    """Verify a webhook's signature and return the parsed event.

    `payload` must be the **raw request body**. Re-serialising a parsed JSON
    body changes whitespace and key order, and the signature is computed over
    the exact bytes Stripe sent — so a Pydantic-parsed body would fail
    verification for every legitimate event while still accepting nothing.

    Raises `StripeNotConfigured` when no secret is set. That is deliberately not
    a soft failure: an endpoint that skips verification because it lacks a
    secret is an unauthenticated way to mark any restaurant as paid.
    """
    secret = _env("STRIPE_WEBHOOK_SECRET")

    if not signature:
        raise ValueError("Missing Stripe-Signature header.")

    # Verification is the SDK's job: it does the timestamp tolerance and the
    # constant-time digest comparison, and neither is worth reimplementing.
    stripe.Webhook.construct_event(payload, signature, secret)

    # The event itself is then read from the same bytes that were just verified,
    # rather than from the object `construct_event` returns. Those bytes are
    # exactly what was signed, so there is no trust gap — and the SDK's `Event`
    # is a typed object whose shape has changed across major versions (in v15 it
    # is no longer a mapping at all), so reading it directly couples this module
    # to a library detail for no benefit.
    return json.loads(payload)


def event_object(event: dict[str, Any]) -> dict[str, Any]:
    data = event.get("data") or {}
    obj = data.get("object") or {}
    return obj if isinstance(obj, dict) else {}


def restaurant_id_from(obj: dict[str, Any]) -> str | None:
    """Dig the restaurant id out of whichever shape the event has.

    Checkout sessions carry `client_reference_id`; their metadata carries it
    too. Invoices carry neither, but the subscription they belong to does — and
    Stripe surfaces that as `subscription_details.metadata` on newer API
    versions. Checked in order, so one missing field is not a dead end.
    """
    direct = obj.get("client_reference_id")
    if isinstance(direct, str) and direct:
        return direct

    for holder in (obj.get("metadata"), (obj.get("subscription_details") or {}).get("metadata")):
        if isinstance(holder, dict):
            value = holder.get("restaurant_id")
            if isinstance(value, str) and value:
                return value

    return None


def customer_id_from(obj: dict[str, Any]) -> str | None:
    customer = obj.get("customer")
    if isinstance(customer, str) and customer:
        return customer
    # Expanded objects arrive as a dict rather than an id.
    if isinstance(customer, dict):
        value = customer.get("id")
        if isinstance(value, str) and value:
            return value
    return None


def amount_from(obj: dict[str, Any]) -> float:
    """The paid amount in major units. Stripe sends minor units (grosze)."""
    for field in ("amount_total", "amount_paid", "amount_due"):
        value = obj.get(field)
        if isinstance(value, (int, float)):
            return round(value / 100, 2)
    return 0.0


def period_end_from(obj: dict[str, Any]) -> datetime | None:
    """When the paid period ends, if the event says so.

    Preferred over adding a fixed thirty days, because it is what Stripe will
    actually bill against — drifting from it means the panel and the customer's
    card disagree about when the month ends.
    """
    candidates: list[Any] = [obj.get("period_end")]

    lines = obj.get("lines")
    if isinstance(lines, dict):
        data = lines.get("data")
        if isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, dict):
                period = first.get("period")
                if isinstance(period, dict):
                    candidates.append(period.get("end"))

    for value in candidates:
        if isinstance(value, (int, float)) and value > 0:
            return datetime.fromtimestamp(int(value), tz=timezone.utc)
    return None
