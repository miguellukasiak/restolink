"""Transactional email via Resend.

Configuration comes exclusively from the environment — never hardcode keys:

    RESEND_API_KEY        API key from the Resend dashboard
    RESEND_FROM           sender, e.g. "RestoLink <noreply@twojadomena.pl>"
    APP_BASE_URL          front-end origin used to build links in emails
    CONTACT_INBOX_EMAIL   where landing-page inquiries go; comma-separated for
                          several recipients

The Resend variables are read at send time, not at import, so a late-configured
deployment and a test behave alike.

For the reset and welcome emails a missing key logs a loud warning instead of
crashing, so local development works without credentials. The contact inquiry
does not get that leniency — see `send_contact_inquiry`.
"""

import html
import logging
import os
from typing import Any

import resend
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

APP_BASE_URL = os.getenv("APP_BASE_URL", "https://restolink-vert.vercel.app").rstrip("/")


class EmailSendError(RuntimeError):
    """Raised when Resend rejects or fails a send."""


class EmailNotConfigured(RuntimeError):
    """A variable an email needs is unset. The message is the variable's name."""


def _api_key() -> str:
    return os.getenv("RESEND_API_KEY", "").strip()


def _from_address() -> str:
    return os.getenv("RESEND_FROM", "").strip() or "RestoLink <onboarding@resend.dev>"


def is_configured() -> bool:
    return bool(_api_key())


async def _deliver(params: dict[str, Any]) -> None:
    """Hand one message to Resend.

    The SDK is synchronous, so it goes to a worker thread rather than blocking
    the event loop for every other request. The key is applied per send because
    the SDK keeps it in a module global.
    """
    resend.api_key = _api_key()
    await run_in_threadpool(resend.Emails.send, {"from": _from_address(), **params})


def reset_password_url(raw_token: str) -> str:
    return f"{APP_BASE_URL}/reset-password?token={raw_token}"


def _reset_email_html(restaurant_name: str, url: str) -> str:
    minutes = 30
    return f"""\
<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#f7f9fa;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#2c3542;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;">
      <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#161c25;">RestoLink</p>
      <p style="margin:0 0 16px;font-size:16px;">Cześć, {restaurant_name}!</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
        Otrzymaliśmy prośbę o zresetowanie hasła do panelu. Kliknij przycisk
        poniżej, aby ustawić nowe hasło. Link jest ważny przez {minutes} minut
        i zadziała tylko raz.
      </p>
      <p style="margin:0 0 28px;">
        <a href="{url}" style="display:inline-block;background:#0f8256;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:16px;">
          Ustaw nowe hasło
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#6b7787;">
        Jeśli to nie Ty prosiłeś o zmianę, zignoruj tę wiadomość — Twoje hasło
        pozostanie bez zmian.
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#9aa4b2;word-break:break-all;">
        Gdyby przycisk nie działał, wklej ten adres w przeglądarkę:<br />{url}
      </p>
    </div>
  </body>
</html>"""


def _reset_email_text(restaurant_name: str, url: str) -> str:
    return (
        f"Cześć, {restaurant_name}!\n\n"
        "Otrzymaliśmy prośbę o zresetowanie hasła do panelu RestoLink.\n"
        "Otwórz poniższy link, aby ustawić nowe hasło. Jest ważny przez 30 "
        "minut i zadziała tylko raz.\n\n"
        f"{url}\n\n"
        "Jeśli to nie Ty prosiłeś o zmianę, zignoruj tę wiadomość — Twoje "
        "hasło pozostanie bez zmian.\n"
    )


async def send_password_reset(
    *, to_email: str, restaurant_name: str, raw_token: str
) -> None:
    """Email a password reset link.

    Raises `EmailSendError` on failure. Callers must catch it and still answer
    the request the same way they would on success — a reset endpoint that
    reports "we could not email that address" tells an attacker the address is
    registered.
    """
    url = reset_password_url(raw_token)

    if not is_configured():
        logger.warning(
            "RESEND_API_KEY is not set — password reset email NOT sent. "
            "Reset link for %s: %s",
            to_email,
            url,
        )
        return

    try:
        await _deliver(
            {
                "to": [to_email],
                "subject": "Reset hasła do panelu RestoLink",
                "html": _reset_email_html(restaurant_name, url),
                "text": _reset_email_text(restaurant_name, url),
            }
        )
    except Exception as exc:  # noqa: BLE001 — SDK raises a variety of errors
        logger.exception("Resend failed to send the password reset email")
        raise EmailSendError(str(exc)) from exc


# --------------------------------------------------------------------------- #
# Welcome / activation
# --------------------------------------------------------------------------- #


def activation_url(raw_token: str) -> str:
    return f"{APP_BASE_URL}/activate?token={raw_token}"


def _welcome_email_html(restaurant_name: str, url: str, days: int) -> str:
    return f"""\
<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#f7f9fa;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#2c3542;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;">
      <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#161c25;">RestoLink</p>
      <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#161c25;">
        Witamy w RestoLink, {restaurant_name}!
      </p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
        Twoje konto jest już gotowe. Zostaw jeszcze jedną rzecz za sobą —
        ustaw hasło, a od razu wejdziesz do panelu, w którym zbudujesz menu
        i wygenerujesz kod QR dla gości.
      </p>
      <p style="margin:0 0 28px;">
        <a href="{url}" style="display:inline-block;background:#0f8256;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:16px;">
          Aktywuj konto
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#6b7787;">
        Link jest ważny {days} dni i zadziała tylko raz. Jeśli wygaśnie,
        napisz do nas — wyślemy nowy.
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#9aa4b2;word-break:break-all;">
        Gdyby przycisk nie działał, wklej ten adres w przeglądarkę:<br />{url}
      </p>
    </div>
  </body>
</html>"""


def _welcome_email_text(restaurant_name: str, url: str, days: int) -> str:
    return (
        f"Witamy w RestoLink, {restaurant_name}!\n\n"
        "Twoje konto jest już gotowe. Ustaw hasło poniższym linkiem, a od razu "
        "wejdziesz do panelu, w którym zbudujesz menu i wygenerujesz kod QR.\n\n"
        f"{url}\n\n"
        f"Link jest ważny {days} dni i zadziała tylko raz. Jeśli wygaśnie, "
        "napisz do nas — wyślemy nowy.\n"
    )


async def send_welcome(
    *, to_email: str, restaurant_name: str, raw_token: str, valid_days: int
) -> None:
    """Email the activation link to a newly created restaurant.

    Raises `EmailSendError` on failure. Unlike the reset email, the caller here
    *should* surface the outcome: this goes to an address an operator typed a
    moment ago, so a bounce is a typo to fix rather than information leaked to a
    stranger. There is nothing to conceal — the operator already knows the
    account exists, because they just created it.
    """
    url = activation_url(raw_token)

    if not is_configured():
        # Same contract as the reset email: development works without
        # credentials, and the link lands in the log so it is still usable.
        logger.warning(
            "RESEND_API_KEY is not set — welcome email NOT sent. "
            "Activation link for %s: %s",
            to_email,
            url,
        )
        return

    try:
        await _deliver(
            {
                "to": [to_email],
                "subject": "Witamy w RestoLink — aktywuj swoje konto",
                "html": _welcome_email_html(restaurant_name, url, valid_days),
                "text": _welcome_email_text(restaurant_name, url, valid_days),
            }
        )
    except Exception as exc:  # noqa: BLE001 — SDK raises a variety of errors
        logger.exception("Resend failed to send the welcome email")
        raise EmailSendError(str(exc)) from exc


# --------------------------------------------------------------------------- #
# Landing-page contact form
# --------------------------------------------------------------------------- #


def _contact_inbox() -> list[str]:
    raw = os.getenv("CONTACT_INBOX_EMAIL", "")
    return [address.strip() for address in raw.split(",") if address.strip()]


def _single_line(value: str) -> str:
    """Collapse every run of whitespace, newlines included, to one space."""
    return " ".join(value.split())


def contact_subject(name: str, venue: str | None) -> str:
    subject = f"Nowe zapytanie ze strony: {_single_line(name)}"
    if venue:
        subject += f" ({_single_line(venue)})"
    return subject


def _contact_email_html(
    *, name: str, email: str, venue: str | None, message: str, language: str | None
) -> str:
    # Every value here was typed by a stranger. Escaped, so a message cannot
    # plant markup or a disguised link in our own inbox.
    esc = html.escape
    rows = [
        ("Imię i nazwisko", esc(name)),
        ("E-mail", f'<a href="mailto:{esc(email)}" style="color:#0f8256;">{esc(email)}</a>'),
        ("Lokal", esc(venue) if venue else "—"),
        ("Język strony", esc(language) if language else "—"),
    ]
    table = "".join(
        f'<tr><td style="padding:6px 16px 6px 0;color:#6b7787;white-space:nowrap;vertical-align:top;">{label}</td>'
        f'<td style="padding:6px 0;color:#161c25;">{value}</td></tr>'
        for label, value in rows
    )
    return f"""\
<!doctype html>
<html lang="pl">
  <body style="margin:0;padding:24px;background:#f7f9fa;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#2c3542;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;">
      <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#161c25;">RestoLink</p>
      <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#161c25;">
        Nowe zapytanie z formularza kontaktowego
      </p>
      <table style="border-collapse:collapse;font-size:15px;margin:0 0 24px;">{table}</table>
      <div style="margin:0 0 24px;padding:16px 20px;background:#f7f9fa;border-radius:12px;font-size:15px;line-height:1.6;white-space:pre-wrap;">{esc(message)}</div>
      <p style="margin:0;font-size:13px;color:#6b7787;">
        Odpowiedz na tę wiadomość — trafi prosto do nadawcy.
      </p>
    </div>
  </body>
</html>"""


def _contact_email_text(
    *, name: str, email: str, venue: str | None, message: str, language: str | None
) -> str:
    return (
        "Nowe zapytanie z formularza kontaktowego\n\n"
        f"Imię i nazwisko: {name}\n"
        f"E-mail: {email}\n"
        f"Lokal: {venue or '—'}\n"
        f"Język strony: {language or '—'}\n\n"
        f"{message}\n\n"
        "Odpowiedz na tę wiadomość — trafi prosto do nadawcy.\n"
    )


async def send_contact_inquiry(
    *, name: str, email: str, venue: str | None, message: str, language: str | None
) -> None:
    """Email a landing-page inquiry to our own inbox, with Reply-To set to the
    visitor so answering it reaches them directly.

    Raises `EmailNotConfigured` when `RESEND_API_KEY` or `CONTACT_INBOX_EMAIL`
    is unset, and `EmailSendError` when Resend fails. Unlike the reset and
    welcome emails, a missing key is *not* treated as a development convenience:
    those log a link that someone can still use, while here the sender is a
    stranger who would be told their message arrived when it went nowhere. The
    caller must answer with an error, never a success.
    """
    recipients = _contact_inbox()
    if not recipients:
        raise EmailNotConfigured("CONTACT_INBOX_EMAIL")
    if not is_configured():
        raise EmailNotConfigured("RESEND_API_KEY")

    fields = {
        "name": name,
        "email": email,
        "venue": venue,
        "message": message,
        "language": language,
    }
    try:
        await _deliver(
            {
                "to": recipients,
                "reply_to": email,
                "subject": contact_subject(name, venue),
                "html": _contact_email_html(**fields),
                "text": _contact_email_text(**fields),
            }
        )
    except Exception as exc:  # noqa: BLE001 — SDK raises a variety of errors
        logger.exception("Resend failed to send a contact inquiry")
        raise EmailSendError(str(exc)) from exc
