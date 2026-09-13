"""The owner's translation dictionary for their own menu.

Every route here is the restaurant owner editing their own data, so the whole
router sits behind `verify_restaurant_access` — which checks both that the
bearer token is valid and that it belongs to the restaurant named in the path.
"""

import asyncio
import html
import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload, selectinload

from ..database import get_db
from ..dependencies import verify_restaurant_access
from ..models import MenuCategory, Restaurant, TranslationDictionary
from ..schemas import (
    AutoTranslateRequest,
    AutoTranslateResponse,
    DictionaryEntry,
    DictionaryResponse,
    DictionarySaveRequest,
)
from ..translation_service import (
    DICTIONARY_LANGUAGES,
    collect_sources,
    load_dictionary,
    normalize_language,
    source_hash,
    translatable,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/panel/{restaurant_id}/dictionary",
    tags=["Dictionary"],
    dependencies=[Depends(verify_restaurant_access)],
)

#: Seconds between two draft translations. The free endpoint refuses Render's
#: IPs outright, so this will not rescue it there — but on a connection it does
#: answer, spacing the calls out is what keeps it answering. The owner is
#: watching a spinner, not a guest, so the wait is affordable.
AUTO_TRANSLATE_DELAY_SECONDS = 1.5

#: Ceiling on one drafting run, so a hung endpoint cannot hold the request open.
AUTO_TRANSLATE_BUDGET_SECONDS = 180.0

_WHITESPACE = re.compile(r"\s+")


def _require_language(raw: str) -> str:
    language = normalize_language(raw)
    if language is None or language not in DICTIONARY_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Nieobsługiwany język. Dostępne: "
                + ", ".join(code.upper() for code in DICTIONARY_LANGUAGES)
            ),
        )
    return language


async def _menu_phrases(db: AsyncSession, restaurant_id: uuid.UUID) -> list[str]:
    """Every distinct phrase in the menu, in menu order.

    Category names come before their dishes so the dictionary screen reads like
    the menu it describes, rather than like a database dump.
    """
    categories = (
        await db.scalars(
            select(MenuCategory)
            .options(selectinload(MenuCategory.items))
            .where(
                MenuCategory.restaurant_id == restaurant_id,
                MenuCategory.deleted_at.is_(None),
            )
            .order_by(MenuCategory.sort_order.asc())
        )
    ).all()

    texts: list[str] = []
    for category in categories:
        texts.append(category.name)
        for item in category.items:
            texts.extend((item.name, item.description, item.ingredients))
    return collect_sources(texts)


@router.get("", response_model=DictionaryResponse)
async def get_dictionary(
    restaurant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    target_lang: str = Query(..., min_length=2, max_length=8),
) -> DictionaryResponse:
    """The menu's phrases paired with whatever the owner has translated so far.

    Built from the live menu every time rather than from the dictionary table,
    so a dish renamed yesterday appears here today and a dish deleted yesterday
    does not. Stale rows are left in the table — harmless, and they come back
    into use if the dish is restored.
    """
    language = _require_language(target_lang)

    restaurant = await db.get(
        Restaurant, restaurant_id, options=[noload(Restaurant.package)]
    )
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Nie znaleziono restauracji.")

    phrases = await _menu_phrases(db, restaurant_id)
    existing = await load_dictionary(db, restaurant_id, language)

    return DictionaryResponse(
        target_lang=language,
        base_language=restaurant.base_language,
        entries=[
            DictionaryEntry(
                original_text=phrase, translated_text=existing.get(phrase, "")
            )
            for phrase in phrases
        ],
    )


@router.put("", response_model=DictionaryResponse)
async def save_dictionary(
    restaurant_id: uuid.UUID,
    payload: DictionarySaveRequest,
    db: AsyncSession = Depends(get_db),
) -> DictionaryResponse:
    """Store the owner's translations, replacing what was there before.

    An entry whose translation is blank is *deleted* rather than stored empty:
    clearing a field in the panel means "I have not translated this", and a row
    holding an empty string would otherwise shadow the fallback chain and leave
    the phrase permanently untranslatable.
    """
    language = _require_language(payload.target_lang)

    restaurant = await db.get(
        Restaurant, restaurant_id, options=[noload(Restaurant.package)]
    )
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Nie znaleziono restauracji.")

    if language == restaurant.base_language:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie można tłumaczyć menu na jego własny język.",
        )

    upserts: list[dict[str, object]] = []
    clears: list[str] = []

    for entry in payload.entries:
        original = entry.original_text.strip()
        if not original or not translatable(original):
            continue

        translated = entry.translated_text.strip()
        if translated:
            upserts.append(
                {
                    "restaurant_id": restaurant_id,
                    "source_hash": source_hash(original),
                    "original_text": original,
                    "target_lang": language,
                    "translated_text": translated,
                }
            )
        else:
            clears.append(source_hash(original))

    if upserts:
        statement = pg_insert(TranslationDictionary).values(upserts)
        # Upsert on the natural key: saving the screen twice updates the rows
        # rather than colliding, and two tabs open at once cannot deadlock.
        await db.execute(
            statement.on_conflict_do_update(
                constraint="uq_dictionary_restaurant_source_lang",
                set_={
                    "translated_text": statement.excluded.translated_text,
                    "original_text": statement.excluded.original_text,
                },
            )
        )

    if clears:
        await db.execute(
            delete(TranslationDictionary).where(
                TranslationDictionary.restaurant_id == restaurant_id,
                TranslationDictionary.target_lang == language,
                TranslationDictionary.source_hash.in_(clears),
            )
        )

    await db.commit()
    logger.info(
        "Dictionary saved for %s → %s: %d written, %d cleared",
        restaurant_id,
        language,
        len(upserts),
        len(clears),
    )

    return await get_dictionary(restaurant_id, db, language)


def _clean(text: str) -> str:
    """Undo the HTML escaping the free translators apply, and tidy whitespace.

    MyMemory hands back `Plats principaux&#xA0;:`; React escapes on output, so
    that would reach the owner's input box as the literal characters `&#xA0;`.
    """
    return _WHITESPACE.sub(" ", html.unescape(text)).strip()


def _translate_one(text: str, target_lang: str) -> str | None:
    """One draft translation. Blocking, so it runs in a worker thread."""
    from deep_translator import GoogleTranslator

    return GoogleTranslator(source="auto", target=target_lang).translate(text)


@router.post("/auto-translate", response_model=AutoTranslateResponse)
async def auto_translate(
    restaurant_id: uuid.UUID,
    payload: AutoTranslateRequest,
    db: AsyncSession = Depends(get_db),
) -> AutoTranslateResponse:
    """Draft translations for review. **Nothing here is saved.**

    That is the whole point of the redesign. Machine output goes to the owner,
    who corrects it and presses save; it never reaches a guest unread. During
    testing this translator rendered "Smażony ser" as "Gekochter Käse" —
    *boiled* cheese — which is exactly the kind of error a human catches in a
    second and a guest never does.

    Requests are made strictly one at a time with a delay between them. A phrase
    that fails is reported in `failed` and the run continues: one refused draft
    should not cost the owner the other forty.
    """
    language = _require_language(payload.target_lang)

    restaurant = await db.get(
        Restaurant, restaurant_id, options=[noload(Restaurant.package)]
    )
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Nie znaleziono restauracji.")

    wanted = collect_sources(payload.texts)
    if not wanted:
        return AutoTranslateResponse(target_lang=language, entries=[], failed=[])

    loop = asyncio.get_running_loop()
    deadline = loop.time() + AUTO_TRANSLATE_BUDGET_SECONDS

    entries: list[DictionaryEntry] = []
    failed: list[str] = []

    for index, text in enumerate(wanted):
        if loop.time() > deadline:
            # Out of budget: everything still untried is reported as failed so
            # the owner sees exactly which rows they still need to fill.
            failed.extend(wanted[index:])
            logger.info(
                "Auto-translate budget spent after %d/%d phrase(s) → %s",
                index,
                len(wanted),
                language,
            )
            break

        # Space the calls out, but not before the first — there is nothing yet
        # to space it from.
        if index:
            await asyncio.sleep(AUTO_TRANSLATE_DELAY_SECONDS)

        try:
            raw = await run_in_threadpool(_translate_one, text, language)
        except Exception as exc:  # noqa: BLE001 — the wrapper raises many types
            logger.warning(
                "Auto-translate failed for one phrase (%s) → %s",
                type(exc).__name__,
                language,
            )
            failed.append(text)
            continue

        draft = _clean(raw) if isinstance(raw, str) else ""
        if not draft:
            failed.append(text)
            continue

        entries.append(DictionaryEntry(original_text=text, translated_text=draft))

    logger.info(
        "Auto-translate drafted %d/%d phrase(s) → %s",
        len(entries),
        len(wanted),
        language,
    )
    return AutoTranslateResponse(
        target_lang=language, entries=entries, failed=failed
    )
