"""Menu translation with a permanent database cache.

Two measured facts shaped this module, and neither was obvious up front.

**Google's free endpoint is blocked here.** `deep-translator`'s
`GoogleTranslator` answers `TooManyRequests` on the very first call — not the
fifth, the first — from this network, and datacenter IPs like Render's are
exactly what that endpoint refuses hardest. It is still tried first, because
when it does work it is the best of the free options; `MyMemoryTranslator`
(also free, also key-less) is tried after it and verifiably works.

**No free backend is fast enough to translate a menu inside a request.**
MyMemory takes roughly 0.8s per string, and a modest menu is ~50 strings. A
guest is not waiting forty seconds for a QR code to resolve.

So the request path never calls upstream at all. It serves whatever is cached —
instantly, and fully translated once the cache is warm — and reports whether
anything is still missing. Filling the cache happens in a background task after
the response has already gone out. The first guest to open a menu in German
sees Polish for a few seconds; everyone after them sees German, forever, with
no upstream call.
"""

import asyncio
import hashlib
import html
import logging
import re
from collections.abc import Iterable, Sequence

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .database import AsyncSessionLocal
from .models import TranslationCache

logger = logging.getLogger(__name__)

#: Menus are authored in Polish, so `?lang=pl` translates nothing.
#:
#: A constant rather than a column because every restaurant on the platform is
#: Polish today. The moment that stops being true this becomes
#: `Restaurant.base_language` and is read from the row.
MENU_BASE_LANGUAGE = "pl"

#: Languages the menu will attempt. Anything else is ignored rather than
#: forwarded upstream — an unbounded `?lang=` is a free way for a crawler to
#: make us hammer a rate-limited endpoint.
SUPPORTED_LANGUAGES = frozenset({"en", "de", "fr", "es", "it", "uk", "cs", "pl"})

#: MyMemory wants regional codes; Google is happy with either.
_MYMEMORY_LOCALE = {
    "pl": "pl-PL",
    "en": "en-GB",
    "de": "de-DE",
    "fr": "fr-FR",
    "es": "es-ES",
    "it": "it-IT",
    "uk": "uk-UA",
    "cs": "cs-CZ",
}

#: Ceiling for one background warming pass. Generous, because nobody is waiting
#: on it — but bounded, so a hung endpoint cannot pin a worker thread forever.
WARM_TIMEOUT_SECONDS = 120.0

#: Strings translated per warming pass. A very large menu fills over a few
#: visits instead of one long run.
WARM_BATCH_LIMIT = 60

#: Longer strings pass through untranslated — dish text is short, and anything
#: past this is a copy-paste accident.
MAX_SOURCE_LENGTH = 2000

#: A string needs at least this many letters to be worth an upstream call.
#: Two, because the things being excluded are measurements — "0,5 l", "200 g",
#: "12%" — which carry exactly one letter and come back unchanged at best.
#: Checking merely for *a* letter is not enough: the "l" in "0,5 l" is one.
MIN_ALPHA_CHARACTERS = 2


#: Runs of whitespace, including the non-breaking spaces the upstream emits.
_WHITESPACE = re.compile(r"\s+")


def clean_translation(text: str) -> str:
    """Make an upstream translation safe to render.

    MyMemory returns HTML-escaped text: "Dania główne" comes back as
    `Plats principaux&#xA0;:`. React escapes on output, so that entity would
    reach the guest as the literal characters `&#xA0;` printed on a dish card.
    Unescaping here — once, before it is cached — fixes it everywhere at no
    per-request cost.

    Whitespace is normalised in the same pass, because what those entities
    decode to is usually a non-breaking space that then renders as a stray gap.
    """
    unescaped = html.unescape(text)
    return _WHITESPACE.sub(" ", unescaped).strip()


def normalize_language(raw: str | None) -> str | None:
    """`de-AT` → `de`. Returns None when the value is unusable or unsupported."""
    if not raw:
        return None
    code = raw.strip().lower().split("-")[0]
    return code if code in SUPPORTED_LANGUAGES else None


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def translatable(text: str) -> bool:
    """Skip blanks, bare measurements and anything implausibly long."""
    stripped = text.strip()
    if not stripped or len(stripped) > MAX_SOURCE_LENGTH:
        return False
    return sum(1 for character in stripped if character.isalpha()) >= MIN_ALPHA_CHARACTERS


def collect_sources(texts: Iterable[str]) -> set[str]:
    """The distinct, worth-translating strings in a menu.

    De-duplicated because a menu repeats category names and stock phrasing many
    times, and each distinct string should cost exactly one cache slot.
    """
    return {text for text in texts if text and translatable(text)}


async def read_cached(
    db: AsyncSession, texts: Iterable[str], target_lang: str
) -> dict[str, str]:
    """Cached translations for these strings. Never touches the network.

    This is the whole request path: if the cache is warm the menu comes back
    fully translated with one extra SELECT, and if it is cold the caller falls
    back to the original wording.
    """
    language = normalize_language(target_lang)
    if language is None or language == MENU_BASE_LANGUAGE:
        return {}

    unique = collect_sources(texts)
    if not unique:
        return {}

    by_hash = {_hash(text): text for text in unique}
    rows = await _select_cached(db, list(by_hash), language)
    return {by_hash[digest]: value for digest, value in rows.items()}


async def _select_cached(
    db: AsyncSession, hashes: Sequence[str], target_lang: str
) -> dict[str, str]:
    if not hashes:
        return {}
    rows = await db.scalars(
        select(TranslationCache).where(
            tuple_(TranslationCache.source_hash, TranslationCache.target_lang).in_(
                [(digest, target_lang) for digest in hashes]
            )
        )
    )
    return {row.source_hash: row.translated_text for row in rows}


def _translate_upstream(texts: list[str], target_lang: str) -> list[str | None]:
    """Blocking call into deep-translator. Runs in a worker thread.

    Google first, MyMemory as the fallback. Both are free and key-less; the
    order reflects quality, not availability — see the module docstring for why
    the fallback is not theoretical.
    """
    from deep_translator import GoogleTranslator, MyMemoryTranslator

    try:
        results = GoogleTranslator(source="auto", target=target_lang).translate_batch(
            texts
        )
        if results and any(results):
            return list(results)
        logger.warning("Google returned nothing usable; falling back to MyMemory.")
    except Exception as exc:  # noqa: BLE001 — the wrapper raises many types
        logger.warning(
            "Google translation unavailable (%s); falling back to MyMemory.",
            type(exc).__name__,
        )

    source = _MYMEMORY_LOCALE.get(MENU_BASE_LANGUAGE, "pl-PL")
    target = _MYMEMORY_LOCALE.get(target_lang, target_lang)
    results = MyMemoryTranslator(source=source, target=target).translate_batch(texts)
    return list(results) if results else [None] * len(texts)


async def _persist(
    db: AsyncSession, entries: list[dict[str, str]]
) -> None:
    """Write new translations, tolerating a concurrent writer.

    Two warming passes for the same menu can overlap. `ON CONFLICT DO NOTHING`
    makes the loser a no-op rather than an IntegrityError.
    """
    if not entries:
        return
    statement = pg_insert(TranslationCache).values(entries)
    await db.execute(
        statement.on_conflict_do_nothing(constraint="uq_translation_source_lang")
    )
    await db.commit()


async def warm_cache(texts: list[str], target_lang: str) -> None:
    """Translate and cache these strings. Runs *after* the response is sent.

    Opens its own session: the request's session is closed by the time a
    background task runs. Every failure is swallowed and logged — nothing here
    can affect a user-visible request, and a menu that stays in its original
    language is a far better outcome than a 500.
    """
    language = normalize_language(target_lang)
    if language is None or language == MENU_BASE_LANGUAGE:
        return

    pending = [text for text in collect_sources(texts)][:WARM_BATCH_LIMIT]
    if not pending:
        return

    try:
        async with AsyncSessionLocal() as db:
            # Re-check: another visitor may have warmed these between the
            # response going out and this task starting.
            already = await read_cached(db, pending, language)
            missing = [text for text in pending if text not in already]
            if not missing:
                return

            logger.info(
                "Warming %d translation(s) → %s", len(missing), language
            )
            fetched = await asyncio.wait_for(
                run_in_threadpool(_translate_upstream, missing, language),
                timeout=WARM_TIMEOUT_SECONDS,
            )

            usable = [
                (source, cleaned)
                for source, translated in zip(missing, fetched, strict=False)
                if translated
                and isinstance(translated, str)
                and (cleaned := clean_translation(translated))
            ]

            # A word that survives translation unchanged is a real result —
            # "Tiramisu" and "Espresso" are the same in German — and must be
            # cached, or it is re-requested forever and `pending` never clears.
            # What is *not* a real result is an endpoint echoing its input back:
            # that shows up as the entire batch coming back identical, never as
            # three loanwords in a menu of thirty dishes.
            if usable and all(
                translated.strip() == source.strip() for source, translated in usable
            ):
                logger.warning(
                    "Upstream returned every one of %d string(s) unchanged for %s — "
                    "treating as a failed batch rather than caching it.",
                    len(usable),
                    language,
                )
                return

            fresh: list[dict[str, str]] = []
            for source, translated in usable:
                fresh.append(
                    {
                        "source_hash": _hash(source),
                        "original_text": source,
                        "target_lang": language,
                        "translated_text": translated,
                    }
                )

            await _persist(db, fresh)
            logger.info("Cached %d translation(s) → %s", len(fresh), language)
    except (TimeoutError, asyncio.TimeoutError):
        logger.warning(
            "Translation warming timed out after %ss → %s",
            WARM_TIMEOUT_SECONDS,
            language,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Translation warming failed → %s", language)
