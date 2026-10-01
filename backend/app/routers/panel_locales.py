"""The owner panel in any catalogue language, translated by DeepL.

HQ gives a restaurant a second panel language when creating it. Polish is
written by hand; for any other the HQ browser — which holds the panel's
English, src/i18n/panel/en.json — sends the strings here in batches to be
translated, then saves the result. Saving also translates, here, what lives
on the server: the error messages and the owner emails. The language is then
shared by every restaurant that has it, and a later save translates only
what is new or whose English changed.

Two routers with different doors: HQ's, behind the admin session, which can
spend the DeepL quota; and a public one that serves a finished language to
the panel — before sign-in too, when an email link carries `&lang=`. It is
interface text, no secret.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..deepl_client import (
    DEEPL_TARGET,
    deepl_key,
    translate_interface,
    translation_failure,
)
from ..dependencies import get_current_superadmin
from ..email_service import EMAIL_COPY
from ..messages import message_sources
from ..models import PanelLocale
from ..panel_language import BUILT_IN_PANEL_LANGUAGES, PANEL_LANGUAGES
from ..panel_texts import remember
from ..schemas import (
    MAX_INTERFACE_BATCH,
    InterfaceTexts,
    InterfaceTranslations,
    PanelLocaleResponse,
    PanelLocaleStatus,
    PanelLocaleUpload,
)

admin_router = APIRouter(
    prefix="/api/v1/admin/panel-locales",
    tags=["Panel languages"],
    dependencies=[Depends(get_current_superadmin)],
)

public_router = APIRouter(
    prefix="/api/v1/public/panel-locales", tags=["Panel languages"]
)


def _machine_language(code: str) -> str:
    """A panel language DeepL makes — not English, not a hand-written one."""
    if not is_machine_language(code):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tego języka panelu nie tłumaczy się automatycznie.",
        )
    return code


async def _translate(texts: list[str], code: str) -> list[str]:
    """DeepL, in batches it accepts, with its errors made readable."""
    key = deepl_key()
    out: list[str] = []
    for start in range(0, len(texts), MAX_INTERFACE_BATCH):
        batch = texts[start : start + MAX_INTERFACE_BATCH]
        try:
            out += await run_in_threadpool(
                translate_interface, batch, DEEPL_TARGET[code], key
            )
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001 — mapped by type
            raise translation_failure(exc) from exc
    return out


@admin_router.get("", response_model=list[PanelLocaleStatus])
async def list_panel_locales(
    db: AsyncSession = Depends(get_db),
) -> list[PanelLocaleStatus]:
    """Which languages are ready, so HQ's picker can say so."""
    rows = (await db.scalars(select(PanelLocale).order_by(PanelLocale.code))).all()
    return [
        PanelLocaleStatus(
            code=row.code, strings=len(row.strings), updated_at=row.updated_at
        )
        for row in rows
    ]


@admin_router.post("/{code}/translate", response_model=InterfaceTranslations)
async def translate_panel_strings(
    code: str, payload: InterfaceTexts
) -> InterfaceTranslations:
    """One batch of the panel's English, in `code`. Nothing is saved."""
    language = _machine_language(code)
    return InterfaceTranslations(translations=await _translate(payload.texts, language))


async def ensure_server_texts(db: AsyncSession, language: str) -> PanelLocale:
    """The server's side of a DeepL language — every message and email line —
    translating whatever is not yet; creates the row if there is none.

    Called on every save of the panel's strings, and by HQ's restaurant
    creation before the welcome email goes out, so the first restaurant given
    a new language is welcomed in it rather than in English."""
    row = await db.get(PanelLocale, language)

    stored_messages = (row.messages if row else None) or {}
    exact = dict(stored_messages.get("exact", {}))
    patterns = dict(stored_messages.get("patterns", {}))
    emails = dict((row.emails if row else None) or {})

    english_exact, english_patterns = message_sources()
    todo = (
        [
            ("exact", key, text)
            for key, text in english_exact.items()
            if key not in exact
        ]
        + [
            ("patterns", key, text)
            for key, text in english_patterns.items()
            if key not in patterns
        ]
        + [
            ("emails", key, text)
            for key, text in EMAIL_COPY["en"].items()
            if key not in emails
        ]
    )
    if not todo and row is not None:
        return row
    if todo:
        translated = await _translate([text for _, _, text in todo], language)
        for (kind, key, _), text in zip(todo, translated, strict=False):
            {"exact": exact, "patterns": patterns, "emails": emails}[kind][key] = text

    if row is None:
        row = PanelLocale(code=language, strings={}, sources={}, messages={}, emails={})
        db.add(row)
    # New dicts, not edits in place: JSONB columns track assignment.
    row.messages = {"exact": exact, "patterns": patterns}
    row.emails = emails
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    remember(language, row.messages, row.emails)
    return row


def is_machine_language(code: str | None) -> bool:
    """True for a panel language DeepL makes."""
    return (
        bool(code) and code in PANEL_LANGUAGES and code not in BUILT_IN_PANEL_LANGUAGES
    )


@admin_router.put("/{code}", response_model=PanelLocaleStatus)
async def save_panel_locale(
    code: str,
    payload: PanelLocaleUpload,
    db: AsyncSession = Depends(get_db),
) -> PanelLocaleStatus:
    """Stores the panel's strings, and makes the server's side of the
    language: every message and email line not yet translated."""
    row = await ensure_server_texts(db, _machine_language(code))
    now = datetime.now(timezone.utc)
    row.strings = {**(row.strings or {}), **payload.strings}
    row.sources = {**(row.sources or {}), **payload.sources}
    row.updated_at = now
    await db.flush()
    return PanelLocaleStatus(code=row.code, strings=len(row.strings), updated_at=now)


@public_router.get("/{code}", response_model=PanelLocaleResponse)
async def get_panel_locale(
    code: str, db: AsyncSession = Depends(get_db)
) -> PanelLocaleResponse:
    row = await db.get(PanelLocale, code) if code in PANEL_LANGUAGES else None
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Panel nie jest jeszcze przetłumaczony na ten język.",
        )
    return PanelLocaleResponse(code=row.code, strings=row.strings, sources=row.sources)
