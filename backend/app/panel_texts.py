"""The server's side of the DeepL-made panel languages: messages and emails.

Kept in memory — the exception handlers localize synchronously, and Render
runs one instance — loaded from `panel_locale` at start-up and replaced
whenever HQ saves a language (routers/panel_locales.py).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

_MESSAGES: dict[str, dict] = {}
_EMAILS: dict[str, dict[str, str]] = {}


def remember(code: str, messages: dict | None, emails: dict | None) -> None:
    _MESSAGES[code] = messages or {}
    _EMAILS[code] = emails or {}


def messages_for(code: str) -> dict | None:
    return _MESSAGES.get(code)


def emails_for(code: str) -> dict[str, str] | None:
    return _EMAILS.get(code)


async def load(db: AsyncSession) -> None:
    from .models import PanelLocale

    for row in (await db.scalars(select(PanelLocale))).all():
        remember(row.code, row.messages, row.emails)
