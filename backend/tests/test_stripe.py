"""Stripe Checkout and the webhook that grants subscription access.

The webhook tests post through the real ASGI app with a genuinely computed
Stripe signature, rather than calling the handler with a pre-parsed event. That
is the only way to prove the thing most easily got wrong: the signature is
verified against the *raw* bytes of the body, so a handler that took a Pydantic
model — or re-serialised the JSON — would reject every real event while these
tests still passed.
"""

import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import stripe
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.main import app
from app.models import AuditLog, PaymentHistory, PaymentMethod, Restaurant, RestaurantStatus
from app.routers import billing
from app.security import RESTAURANT_TOKEN_TTL, as_utc, create_access_token

WEBHOOK_SECRET = "whsec_test_secret_for_signing_only"
WEBHOOK_PATH = "/api/v1/webhooks/stripe"
CHECKOUT_PATH = "/api/v1/subscriptions/create-checkout-session"

pytestmark = pytest.mark.asyncio


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def sign(payload: bytes, secret: str = WEBHOOK_SECRET, timestamp: int | None = None) -> str:
    """Build a Stripe-Signature header the way Stripe does.

    Computed here rather than mocked, so the test exercises the library's real
    verification path over the exact bytes being sent.
    """
    ts = timestamp if timestamp is not None else int(time.time())
    signed = f"{ts}.".encode() + payload
    digest = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={ts},v1={digest}"


def checkout_completed_event(
    restaurant_id: str, *, event_id: str = "evt_checkout_1", customer: str = "cus_test_1"
) -> dict:
    return {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_1",
                "object": "checkout.session",
                "client_reference_id": restaurant_id,
                "customer": customer,
                "amount_total": 12300,
                "currency": "pln",
                "metadata": {"restaurant_id": restaurant_id},
            }
        },
    }


def invoice_paid_event(
    *,
    event_id: str = "evt_invoice_1",
    customer: str = "cus_test_1",
    restaurant_id: str | None = None,
    period_end: int | None = None,
) -> dict:
    """A renewal invoice. Deliberately carries no `client_reference_id`."""
    obj: dict = {
        "id": "in_test_1",
        "object": "invoice",
        "customer": customer,
        "amount_paid": 12300,
        "currency": "pln",
    }
    if restaurant_id:
        obj["subscription_details"] = {"metadata": {"restaurant_id": restaurant_id}}
    if period_end:
        obj["lines"] = {"data": [{"period": {"end": period_end}}]}
    return {"id": event_id, "type": "invoice.payment_succeeded", "data": {"object": obj}}


async def post_event(event: dict, *, signature: str | None = None, secret: str = WEBHOOK_SECRET):
    payload = json.dumps(event).encode()
    headers = {"content-type": "application/json"}
    headers["stripe-signature"] = signature if signature is not None else sign(payload, secret)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(WEBHOOK_PATH, content=payload, headers=headers)


async def reload_restaurant(restaurant_id) -> Restaurant:
    async with AsyncSessionLocal() as db:
        return await db.get(Restaurant, restaurant_id)


def valid_until(restaurant: Restaurant) -> datetime:
    """The expiry as an aware UTC timestamp.

    SQLite hands back naive datetimes where Postgres returns aware ones, so the
    assertions normalise the same way the application does rather than depending
    on which driver is underneath.
    """
    return as_utc(restaurant.subscription_valid_until)


async def payments(restaurant_id) -> list[PaymentHistory]:
    async with AsyncSessionLocal() as db:
        return list(
            (
                await db.scalars(
                    select(PaymentHistory).where(
                        PaymentHistory.restaurant_id == restaurant_id
                    )
                )
            ).all()
        )


async def audit_actions() -> list[str]:
    async with AsyncSessionLocal() as db:
        rows = (await db.scalars(select(AuditLog))).all()
        return [r.action for r in rows]


@pytest.fixture(autouse=True)
def stripe_env(monkeypatch):
    monkeypatch.setenv("STRIPE_API_KEY", "sk_test_key")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET)
    monkeypatch.setenv("STRIPE_PRICE_ID", "price_test_123")
    monkeypatch.setenv("APP_BASE_URL", "https://panel.test")


# --------------------------------------------------------------------------- #
# Checkout session
# --------------------------------------------------------------------------- #


async def test_checkout_session_passes_the_restaurant_id_to_stripe(restaurant, monkeypatch):
    """`client_reference_id` is the only thing tying a payment back to a row."""
    captured: dict = {}

    def fake_create(**kwargs):
        captured.update(kwargs)
        return {"id": "cs_test_1", "url": "https://checkout.stripe.com/c/pay/cs_test_1"}

    monkeypatch.setattr(stripe.checkout.Session, "create", staticmethod(fake_create))

    token, _ = create_access_token(
        subject=str(restaurant.id), role="restaurant", expires_in=RESTAURANT_TOKEN_TTL
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            CHECKOUT_PATH, headers={"Authorization": f"Bearer {token}"}
        )

    assert response.status_code == 200
    assert response.json()["checkout_url"].startswith("https://checkout.stripe.com/")

    assert captured["client_reference_id"] == str(restaurant.id)
    assert captured["mode"] == "subscription"
    assert captured["line_items"] == [{"price": "price_test_123", "quantity": 1}]
    # Carried on the subscription too, so renewal invoices stay attributable.
    assert captured["subscription_data"]["metadata"]["restaurant_id"] == str(restaurant.id)
    assert captured["success_url"] == f"https://panel.test/panel/{restaurant.id}/menu?checkout=success"
    assert captured["cancel_url"] == f"https://panel.test/panel/{restaurant.id}/menu?checkout=cancelled"
    # The secret key travels as an argument, never as a module-level global.
    assert captured["api_key"] == "sk_test_key"


async def test_checkout_requires_authentication(restaurant, monkeypatch):
    monkeypatch.setattr(
        stripe.checkout.Session,
        "create",
        staticmethod(lambda **kw: pytest.fail("Stripe must not be called unauthenticated")),
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(CHECKOUT_PATH)
    assert response.status_code == 401


async def test_checkout_is_503_when_stripe_is_not_configured(restaurant, monkeypatch):
    monkeypatch.delenv("STRIPE_PRICE_ID", raising=False)
    token, _ = create_access_token(
        subject=str(restaurant.id), role="restaurant", expires_in=RESTAURANT_TOKEN_TTL
    )
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            CHECKOUT_PATH, headers={"Authorization": f"Bearer {token}"}
        )
    assert response.status_code == 503


# --------------------------------------------------------------------------- #
# Webhook: signature verification
# --------------------------------------------------------------------------- #


async def test_webhook_rejects_a_bad_signature(restaurant):
    response = await post_event(
        checkout_completed_event(str(restaurant.id)), signature="t=1,v1=deadbeef"
    )
    # 400 so Stripe stops retrying something that will never verify.
    assert response.status_code == 400

    reloaded = await reload_restaurant(restaurant.id)
    assert reloaded.status is RestaurantStatus.PENDING
    assert await payments(restaurant.id) == []


async def test_webhook_rejects_a_missing_signature_header(restaurant):
    payload = json.dumps(checkout_completed_event(str(restaurant.id))).encode()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            WEBHOOK_PATH, content=payload, headers={"content-type": "application/json"}
        )
    assert response.status_code == 400


async def test_webhook_rejects_a_signature_from_a_different_secret(restaurant):
    response = await post_event(
        checkout_completed_event(str(restaurant.id)), secret="whsec_someone_elses_secret"
    )
    assert response.status_code == 400


async def test_webhook_refuses_to_act_without_a_configured_secret(restaurant, monkeypatch):
    """No secret means no verification, which would be an open door."""
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    response = await post_event(checkout_completed_event(str(restaurant.id)))
    assert response.status_code == 500
    assert (await reload_restaurant(restaurant.id)).status is RestaurantStatus.PENDING


async def test_webhook_verifies_against_raw_bytes_not_reserialised_json(restaurant):
    """The body is signed byte-for-byte, whitespace included.

    This payload is valid JSON that no serialiser would produce — extra spaces
    and a trailing newline. A handler that parsed the body and re-dumped it
    before verifying would compute a different digest and reject it.
    """
    event = checkout_completed_event(str(restaurant.id))
    payload = (json.dumps(event, indent=4) + "\n").encode()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            WEBHOOK_PATH,
            content=payload,
            headers={
                "content-type": "application/json",
                "stripe-signature": sign(payload),
            },
        )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "processed"
    assert (await reload_restaurant(restaurant.id)).status is RestaurantStatus.ACTIVE


# --------------------------------------------------------------------------- #
# Webhook: granting access
# --------------------------------------------------------------------------- #


async def test_checkout_completed_activates_the_restaurant(restaurant):
    before = restaurant.subscription_valid_until

    response = await post_event(checkout_completed_event(str(restaurant.id)))
    assert response.status_code == 200
    assert response.json() == {"status": "processed", "event_type": "checkout.session.completed"}

    reloaded = await reload_restaurant(restaurant.id)
    assert reloaded.status is RestaurantStatus.ACTIVE
    assert valid_until(reloaded) > datetime.now(timezone.utc)
    # Extended from now, not from a stale expiry three days in the past.
    assert valid_until(reloaded) > as_utc(before)
    # The customer is remembered so renewals can be attributed.
    assert reloaded.stripe_customer_id == "cus_test_1"


async def test_payment_is_recorded_in_the_ledger_and_the_audit_trail(restaurant):
    await post_event(checkout_completed_event(str(restaurant.id)))

    rows = await payments(restaurant.id)
    assert len(rows) == 1
    assert rows[0].payment_method is PaymentMethod.GATEWAY
    assert float(rows[0].amount) == 123.00  # 12300 grosze
    assert rows[0].external_transaction_id == "evt_checkout_1"

    assert "subscription.paid" in await audit_actions()
    async with AsyncSessionLocal() as db:
        entry = (await db.scalars(select(AuditLog))).first()
    # Not a person, and shaped so it cannot be mistaken for one.
    assert entry.admin_email == billing.WEBHOOK_ACTOR


async def test_renewal_invoice_is_matched_by_stripe_customer(restaurant):
    """An invoice carries no `client_reference_id`; the customer link is all there is."""
    await post_event(checkout_completed_event(str(restaurant.id)))
    after_first = valid_until(await reload_restaurant(restaurant.id))

    period_end = int((datetime.now(timezone.utc) + timedelta(days=45)).timestamp())
    response = await post_event(
        invoice_paid_event(event_id="evt_invoice_2", period_end=period_end)
    )

    assert response.status_code == 200
    assert response.json()["status"] == "processed"
    reloaded = await reload_restaurant(restaurant.id)
    assert valid_until(reloaded) > after_first
    # Stripe's own period end wins over a flat +30 days.
    assert abs(valid_until(reloaded).timestamp() - period_end) < 2


async def test_renewal_is_matched_by_subscription_metadata_without_a_customer_row(restaurant):
    """Belt and braces: metadata on the subscription also resolves the restaurant."""
    response = await post_event(
        invoice_paid_event(
            event_id="evt_invoice_meta",
            customer="cus_never_seen",
            restaurant_id=str(restaurant.id),
        )
    )
    assert response.json()["status"] == "processed"
    assert (await reload_restaurant(restaurant.id)).status is RestaurantStatus.ACTIVE


async def test_paying_early_adds_to_remaining_time(restaurant):
    """Never shorten a subscription: extend from the later of now or the expiry."""
    future = datetime.now(timezone.utc) + timedelta(days=20)
    async with AsyncSessionLocal() as db:
        row = await db.get(Restaurant, restaurant.id)
        row.subscription_valid_until = future
        row.status = RestaurantStatus.ACTIVE
        await db.commit()

    await post_event(checkout_completed_event(str(restaurant.id)))

    reloaded = await reload_restaurant(restaurant.id)
    assert valid_until(reloaded) > future + timedelta(days=29)


# --------------------------------------------------------------------------- #
# Webhook: idempotency and events we ignore
# --------------------------------------------------------------------------- #


async def test_the_same_event_delivered_twice_is_applied_once(restaurant):
    """Stripe retries until it gets a 2xx. Days must not accumulate per retry."""
    event = checkout_completed_event(str(restaurant.id))

    first = await post_event(event)
    after_first = valid_until(await reload_restaurant(restaurant.id))

    second = await post_event(event)

    assert first.json()["status"] == "processed"
    assert second.status_code == 200
    assert second.json()["status"] == "duplicate"
    assert valid_until(await reload_restaurant(restaurant.id)) == after_first
    assert len(await payments(restaurant.id)) == 1


async def test_the_two_first_month_events_do_not_double_count(restaurant):
    """`checkout.session.completed` and `invoice.payment_succeeded` both describe
    the first payment. Distinct event ids, so both are processed — and the
    subscription should reflect two legitimate grants, not one silently lost."""
    await post_event(checkout_completed_event(str(restaurant.id)))
    first = valid_until(await reload_restaurant(restaurant.id))

    response = await post_event(invoice_paid_event(event_id="evt_invoice_same_month"))
    assert response.json()["status"] == "processed"

    rows = await payments(restaurant.id)
    assert len(rows) == 2
    assert {r.external_transaction_id for r in rows} == {
        "evt_checkout_1",
        "evt_invoice_same_month",
    }
    assert valid_until(await reload_restaurant(restaurant.id)) > first


@pytest.mark.parametrize(
    "event_type",
    [
        "payment_intent.succeeded",
        "customer.subscription.updated",
        "invoice.payment_failed",
        "charge.refunded",
    ],
)
async def test_unhandled_events_are_acknowledged_without_changing_anything(
    restaurant, event_type
):
    """200 for everything else, or Stripe queues retries for days."""
    event = {
        "id": f"evt_{event_type}",
        "type": event_type,
        "data": {"object": {"client_reference_id": str(restaurant.id)}},
    }
    response = await post_event(event)

    assert response.status_code == 200
    assert response.json() == {"status": "ignored", "event_type": event_type}
    assert (await reload_restaurant(restaurant.id)).status is RestaurantStatus.PENDING
    assert await payments(restaurant.id) == []


async def test_an_event_for_an_unknown_restaurant_is_acknowledged_not_retried(restaurant):
    response = await post_event(
        checkout_completed_event(str(uuid.uuid4()), event_id="evt_orphan")
    )
    assert response.status_code == 200
    assert response.json()["status"] == "unmatched"
    assert (await reload_restaurant(restaurant.id)).status is RestaurantStatus.PENDING


async def test_a_malformed_restaurant_id_does_not_crash_the_handler(restaurant):
    event = checkout_completed_event("not-a-uuid", event_id="evt_bad_id")
    event["data"]["object"]["metadata"] = {"restaurant_id": "also-not-a-uuid"}
    event["data"]["object"]["customer"] = "cus_unknown"

    response = await post_event(event)
    assert response.status_code == 200
    assert response.json()["status"] == "unmatched"
