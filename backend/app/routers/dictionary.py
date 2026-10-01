"""The owner's translation dictionary for their own menu.

Every route here is the restaurant owner editing their own data, so the whole
router sits behind `verify_restaurant_access` — which checks both that the
bearer token is valid and that it belongs to the restaurant named in the path.
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from ..database import get_db
from ..deepl_client import (
    DEEPL_TARGET,
    DEEPL_VARIANTS,
    deepl_key as _deepl_key,
    translation_failure as _translation_failure,
)
from ..dependencies import verify_restaurant_access
from ..models import Restaurant, TranslationDictionary
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
    menu_phrases,
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

#: The catalogue's DeepL targets (deepl_client.py), under the name the tests
#: and the rest of this module know.
_DEEPL_VARIANTS = DEEPL_VARIANTS
_DEEPL_TARGET = DEEPL_TARGET

#: Source codes have no regional variants, so this is just an uppercase pass —
#: guarded against a `base_language` DeepL does not know, where passing nothing
#: and letting it auto-detect is better than erroring.
_DEEPL_SOURCE = {"pl": "PL", "en": "EN", "de": "DE", "fr": "FR", "es": "ES"}


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

    phrases = await menu_phrases(db, restaurant_id)
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


# --------------------------------------------------------------------------- #
# Draft translations (DeepL)
# --------------------------------------------------------------------------- #


def _translate_batch(
    texts: list[str], target_lang: str, source_lang: str | None, auth_key: str
) -> list[str]:
    """One DeepL call for the whole list. Blocking, so it runs in a thread.

    `translate_text` accepts a sequence and returns one result per input in the
    same order, batched by the API itself — which is why the delays, retries and
    manual chunking the previous free-endpoint scraper needed are all gone.

    `source_lang` is passed when we know it. DeepL detects well on prose but
    poorly on the two-word fragments a menu is full of: "Sok" is Polish for
    juice and also a plausible fragment in several other languages, and telling
    it the answer is cheaper than letting it guess.
    """
    import deepl

    translator = deepl.Translator(auth_key)
    results = translator.translate_text(
        texts, target_lang=target_lang, source_lang=source_lang
    )
    # A single string in gives a single result out; a list always gives a list.
    # We always pass a list, but normalising costs one line and removes a whole
    # class of "sometimes it is not iterable" bug.
    if not isinstance(results, list):
        results = [results]
    return [result.text for result in results]


@router.post("/auto-translate", response_model=AutoTranslateResponse)
async def auto_translate(
    restaurant_id: uuid.UUID,
    payload: AutoTranslateRequest,
    db: AsyncSession = Depends(get_db),
) -> AutoTranslateResponse:
    """Draft translations for review. **Nothing here is saved.**

    That is the point of this screen. Machine output goes to the owner, who
    corrects it and presses save; it never reaches a guest unread. The engine
    that preceded DeepL rendered "Smażony ser" as "Gekochter Käse" — *boiled*
    cheese — which is exactly the kind of error a human catches in a second and
    a guest never does. DeepL is much better, but "much better" is still not
    "unsupervised".
    """
    language = _require_language(payload.target_lang)
    auth_key = _deepl_key()

    restaurant = await db.get(
        Restaurant, restaurant_id, options=[noload(Restaurant.package)]
    )
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Nie znaleziono restauracji.")

    wanted = collect_sources(payload.texts)
    if not wanted:
        return AutoTranslateResponse(target_lang=language, entries=[], failed=[])

    target = _DEEPL_TARGET[language]
    source = _DEEPL_SOURCE.get(restaurant.base_language)

    try:
        translations = await run_in_threadpool(
            _translate_batch, wanted, target, source, auth_key
        )
    except Exception as exc:  # noqa: BLE001 — mapped by type below
        raise _translation_failure(exc) from exc

    entries: list[DictionaryEntry] = []
    failed: list[str] = []

    for original, translated in zip(wanted, translations, strict=False):
        draft = translated.strip() if isinstance(translated, str) else ""
        if draft:
            entries.append(
                DictionaryEntry(original_text=original, translated_text=draft)
            )
        else:
            failed.append(original)

    # Defensive: DeepL returns one result per input, but a short list would
    # otherwise drop phrases silently and leave the owner wondering why some
    # rows stayed empty.
    if len(translations) < len(wanted):
        failed.extend(wanted[len(translations) :])

    logger.info(
        "DeepL drafted %d/%d phrase(s) %s → %s",
        len(entries),
        len(wanted),
        source or "auto",
        target,
    )
    return AutoTranslateResponse(target_lang=language, entries=entries, failed=failed)
