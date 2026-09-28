"""The landing page's contact form.

Posted through the real ASGI app, so validation and `response_model` are part
of what is tested. Resend itself is replaced by a recorder: the tests prove what
we hand it, not that the network works.
"""

import logging

import pytest
import resend
from httpx import ASGITransport, AsyncClient

from app import main
from app.main import app
from app.routers import contact

CONTACT_PATH = "/api/v1/public/contact"

pytestmark = pytest.mark.asyncio


def inquiry(**overrides) -> dict:
    body = {
        "name": "Anna Kowalska",
        "email": "anna@bistro.pl",
        "restaurant": "Bistro Pod Mostem",
        "message": "Dzień dobry,\nchcielibyśmy zobaczyć demo.",
        "language": "pl",
        "website": "",
    }
    body.update(overrides)
    return body


async def post(body: dict, *, forwarded_for: str | None = "203.0.113.7"):
    headers = {"x-forwarded-for": forwarded_for} if forwarded_for else {}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(CONTACT_PATH, json=body, headers=headers)


@pytest.fixture(autouse=True)
def fresh_limits(monkeypatch):
    """Limits are module state; each test starts with a clean slate."""
    monkeypatch.setattr(
        contact, "_per_client", contact._SlidingWindow(contact._PER_CLIENT_LIMIT, contact._HOUR)
    )
    monkeypatch.setattr(
        contact, "_global", contact._SlidingWindow(contact._GLOBAL_LIMIT, contact._DAY)
    )


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("RESEND_FROM", "RestoLink <noreply@restolink.test>")
    monkeypatch.setenv("CONTACT_INBOX_EMAIL", "sprzedaz@restolink.test")


@pytest.fixture
def sent(monkeypatch) -> list[dict]:
    """Every message handed to Resend, in order."""
    outbox: list[dict] = []
    monkeypatch.setattr(resend.Emails, "send", lambda params: outbox.append(params))
    return outbox


# --------------------------------------------------------------------------- #
# Delivery
# --------------------------------------------------------------------------- #


async def test_inquiry_is_emailed_to_our_inbox_with_reply_to_the_visitor(configured, sent):
    response = await post(inquiry())

    assert response.status_code == 200
    assert response.json() == {"message": "Dziękujemy! Odezwiemy się wkrótce."}
    assert len(sent) == 1
    message = sent[0]
    assert message["to"] == ["sprzedaz@restolink.test"]
    assert message["from"] == "RestoLink <noreply@restolink.test>"
    # Answering the notification must reach the lead, not our own sender.
    assert message["reply_to"] == "anna@bistro.pl"
    assert message["subject"] == "Nowe zapytanie ze strony: Anna Kowalska (Bistro Pod Mostem)"
    assert "chcielibyśmy zobaczyć demo." in message["text"]
    assert "Bistro Pod Mostem" in message["html"]


async def test_several_recipients_are_accepted(configured, sent, monkeypatch):
    monkeypatch.setenv("CONTACT_INBOX_EMAIL", "a@restolink.test, b@restolink.test")

    response = await post(inquiry())

    assert response.status_code == 200
    assert sent[0]["to"] == ["a@restolink.test", "b@restolink.test"]


async def test_visitor_markup_is_escaped_in_our_inbox(configured, sent):
    response = await post(
        inquiry(
            name="<b>Mallory</b>",
            restaurant=None,
            message='<a href="https://evil.example">Kliknij</a>',
        )
    )

    assert response.status_code == 200
    html = sent[0]["html"]
    assert "<b>Mallory</b>" not in html
    assert "&lt;b&gt;Mallory&lt;/b&gt;" in html
    assert 'href="https://evil.example"' not in html
    assert "&lt;a href=&quot;https://evil.example&quot;&gt;" in html


async def test_newlines_in_the_name_cannot_break_the_subject(configured, sent):
    await post(inquiry(name="Anna\r\nBcc: someone@example.com", restaurant=""))

    subject = sent[0]["subject"]
    assert "\n" not in subject and "\r" not in subject
    assert subject == "Nowe zapytanie ze strony: Anna Bcc: someone@example.com"


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": "   "},
        {"message": "\n\n"},
        {"email": "not-an-email"},
        {"message": "x" * 5001},
    ],
)
async def test_what_a_person_must_type_is_required(configured, sent, overrides):
    response = await post(inquiry(**overrides))

    assert response.status_code == 422
    assert sent == []


async def test_odd_metadata_never_costs_a_lead(configured, sent):
    response = await post(inquiry(language="x" * 500, restaurant=None))

    assert response.status_code == 200
    assert "Język strony: " + "x" * 16 + "\n" in sent[0]["text"]


# --------------------------------------------------------------------------- #
# Abuse
# --------------------------------------------------------------------------- #


async def test_honeypot_gets_a_fake_success_and_sends_nothing(configured, sent, caplog):
    with caplog.at_level(logging.INFO, logger="app.routers.contact"):
        response = await post(inquiry(website="https://spam.example"))

    assert response.status_code == 200
    assert response.json() == {"message": "Dziękujemy! Odezwiemy się wkrótce."}
    assert sent == []
    # A false positive would otherwise be a silently lost lead.
    assert "chcielibyśmy zobaczyć demo." in caplog.text


async def test_one_client_is_limited_per_hour(configured, sent):
    for _ in range(contact._PER_CLIENT_LIMIT):
        assert (await post(inquiry())).status_code == 200

    refused = await post(inquiry())
    assert refused.status_code == 429
    assert len(sent) == contact._PER_CLIENT_LIMIT

    # Somebody else is unaffected.
    assert (await post(inquiry(), forwarded_for="198.51.100.4")).status_code == 200


async def test_left_most_forwarded_address_is_the_client(configured, sent):
    for _ in range(contact._PER_CLIENT_LIMIT):
        await post(inquiry(), forwarded_for="203.0.113.7, 10.0.0.1")

    # Same visitor behind a different proxy hop is still the same visitor.
    refused = await post(inquiry(), forwarded_for="203.0.113.7, 10.0.0.2")
    assert refused.status_code == 429


async def test_global_cap_holds_when_the_client_key_is_spoofed(configured, sent, monkeypatch, caplog):
    monkeypatch.setattr(contact, "_global", contact._SlidingWindow(3, contact._DAY))

    for i in range(3):
        assert (await post(inquiry(), forwarded_for=f"192.0.2.{i}")).status_code == 200

    with caplog.at_level(logging.ERROR, logger="app.routers.contact"):
        refused = await post(inquiry(message="Ostatnia szansa"), forwarded_for="192.0.2.99")

    assert refused.status_code == 429
    assert len(sent) == 3
    # Might be a real lead: it must be recoverable from the log.
    assert "Ostatnia szansa" in caplog.text


async def test_window_forgets_hits_older_than_the_window():
    window = contact._SlidingWindow(limit=2, window=60)

    assert window.allow("a", now=0)
    assert window.allow("a", now=10)
    assert not window.allow("a", now=20)
    assert window.allow("a", now=61)


async def test_window_memory_is_bounded_under_spoofed_keys(monkeypatch):
    monkeypatch.setattr(contact, "_MAX_TRACKED_CLIENTS", 100)
    window = contact._SlidingWindow(limit=5, window=60)

    for i in range(1000):
        assert window.allow(f"spoofed-{i}", now=1)

    assert len(window._hits) <= 100


# --------------------------------------------------------------------------- #
# Failure is never reported as success
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("missing", ["CONTACT_INBOX_EMAIL", "RESEND_API_KEY"])
async def test_missing_configuration_is_a_503_naming_the_variable(
    configured, sent, monkeypatch, caplog, missing
):
    monkeypatch.delenv(missing)

    with caplog.at_level(logging.ERROR, logger="app.routers.contact"):
        response = await post(inquiry())

    assert response.status_code == 503
    assert missing in response.json()["detail"]
    assert sent == []
    assert "chcielibyśmy zobaczyć demo." in caplog.text


async def test_resend_failure_is_a_502_and_the_inquiry_is_logged(configured, monkeypatch, caplog):
    def refuse(_params):
        raise resend.exceptions.ResendError(
            code=500, error_type="application_error", message="down", suggested_action=""
        )

    monkeypatch.setattr(resend.Emails, "send", refuse)

    with caplog.at_level(logging.ERROR, logger="app.routers.contact"):
        response = await post(inquiry())

    assert response.status_code == 502
    assert "anna@bistro.pl" in caplog.text


# --------------------------------------------------------------------------- #
# CORS
# --------------------------------------------------------------------------- #


async def test_extra_cors_origins_come_from_the_environment(monkeypatch):
    monkeypatch.setenv(
        "CORS_ALLOWED_ORIGINS", " https://restolink.pl/, https://www.restolink.pl ,, "
    )

    assert main.extra_cors_origins() == ["https://restolink.pl", "https://www.restolink.pl"]


async def test_no_extra_cors_origins_by_default(monkeypatch):
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)

    assert main.extra_cors_origins() == []
