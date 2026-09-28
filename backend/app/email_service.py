"""Transactional email via Resend.

Configuration comes exclusively from the environment — never hardcode keys:

    RESEND_API_KEY   API key from the Resend dashboard
    RESEND_FROM      sender, e.g. "RestoLink <noreply@twojadomena.pl>"
    APP_BASE_URL     front-end origin used to build links in emails

Mirrors `cloudinary_service`: a missing key logs a loud warning instead of
crashing, so local development works without credentials.
"""

import logging
import os

import resend
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_ADDRESS = os.getenv("RESEND_FROM", "RestoLink <onboarding@resend.dev>")
APP_BASE_URL = os.getenv("APP_BASE_URL", "https://restolink-vert.vercel.app").rstrip("/")

resend.api_key = API_KEY


class EmailSendError(RuntimeError):
    """Raised when Resend rejects or fails a send."""


def is_configured() -> bool:
    return bool(API_KEY)


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
        # The Resend SDK is synchronous, so it goes to a worker thread rather
        # than blocking the event loop for every other request.
        await run_in_threadpool(
            resend.Emails.send,
            {
                "from": FROM_ADDRESS,
                "to": [to_email],
                "subject": "Reset hasła do panelu RestoLink",
                "html": _reset_email_html(restaurant_name, url),
                "text": _reset_email_text(restaurant_name, url),
            },
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
        await run_in_threadpool(
            resend.Emails.send,
            {
                "from": FROM_ADDRESS,
                "to": [to_email],
                "subject": "Witamy w RestoLink — aktywuj swoje konto",
                "html": _welcome_email_html(restaurant_name, url, valid_days),
                "text": _welcome_email_text(restaurant_name, url, valid_days),
            },
        )
    except Exception as exc:  # noqa: BLE001 — SDK raises a variety of errors
        logger.exception("Resend failed to send the welcome email")
        raise EmailSendError(str(exc)) from exc
