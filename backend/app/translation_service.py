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

**The background worker is deliberately slow.** Production logs showed it being
rate-limited, which is what happens when you fire a whole menu at a free
endpoint at once. It now translates one string at a time, waits between them,
retries a refused string with exponential backoff, and gives up on a string
rather than on the menu. Three separate mechanisms keep the request rate down:

* one call per `THROTTLE_SECONDS`, enforced by sleeping between strings;
* a process-wide lock, so two languages warming at once cannot double the rate,
  and a pile-up of queued passes collapses into one;
* a sticky provider per pass — once Google refuses, the rest of the pass goes
  straight to MyMemory instead of asking Google fifty more times. That alone
  halved the request count, since every string was previously paying for a
  failed Google call before its successful one.

Progress is written to the database in small batches as it goes, so a pass cut
short — by the time budget, or by Render idling the instance — keeps everything
it had already translated.
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

#: Seconds between two upstream calls. Google's stated ceiling is 5/s; this is
#: one, because the ceiling is what gets you blocked and there is no hurry — the
#: guest already has their menu, in the original language, and nobody is waiting
#: on this loop.
THROTTLE_SECONDS = 1.0

#: Attempts per string before giving up on it.
MAX_ATTEMPTS = 3

#: First retry waits this long, and each further retry doubles it: 2s, 4s.
#: A rate-limited endpoint wants to be left alone, so backing off hard is both
#: politer and likelier to succeed than trying again immediately.
RETRY_BACKOFF_SECONDS = 2.0

#: Wall-clock ceiling for one warming pass. At one call per second a pass is
#: mostly spent sleeping, so this is what actually bounds it — not the string
#: count. Whatever it does not reach is picked up by the next pass.
WARM_TIME_BUDGET_SECONDS = 100.0

#: Strings considered per warming pass. Deliberately below what the time budget
#: allows, so a pass normally finishes its list rather than being cut off.
WARM_BATCH_LIMIT = 40

#: Translations buffered before being written. Small, so a pass killed halfway —
#: by the budget, or by Render idling the instance — keeps its progress instead
#: of throwing away a minute of upstream calls.
PERSIST_EVERY = 8

#: How many consecutive unchanged results, with nothing changed yet, count as a
#: broken endpoint echoing its input rather than a menu full of loanwords.
ECHO_SUSPICION_THRESHOLD = 8

#: Serializes upstream access across the whole process. Without it two languages
#: warming at once would each sleep politely and still double the request rate.
_upstream_lock = asyncio.Lock()

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


# --------------------------------------------------------------------------- #
# Upstream providers
# --------------------------------------------------------------------------- #


def _google_one(text: str, target_lang: str) -> str | None:
    from deep_translator import GoogleTranslator

    return GoogleTranslator(source="auto", target=target_lang).translate(text)


def _mymemory_one(text: str, target_lang: str) -> str | None:
    from deep_translator import MyMemoryTranslator

    source = _MYMEMORY_LOCALE.get(MENU_BASE_LANGUAGE, "pl-PL")
    target = _MYMEMORY_LOCALE.get(target_lang, target_lang)
    return MyMemoryTranslator(source=source, target=target).translate(text)


#: Tried in order, best first. Both are free and key-less.
PROVIDERS = [
    ("google", _google_one),
    ("mymemory", _mymemory_one),
]

#: Distinguishes "this provider failed" from "it translated to nothing".
_FAILED = object()


def _is_rate_limited(exc: BaseException) -> bool:
    """Whether this failure means "slow down" rather than "that will never work".

    Matched on the class name and message instead of importing the library's
    exception types, because `deep-translator` moves them between versions and
    an ImportError here would be a far worse failure than a missed match.
    """
    name = type(exc).__name__.lower()
    if "toomanyrequests" in name or "ratelimit" in name:
        return True
    text = str(exc).lower()
    return "too many requests" in text or "429" in text


async def _attempt_with_backoff(call, text: str, target_lang: str, provider: str):
    """Call one provider up to `MAX_ATTEMPTS` times, backing off exponentially.

    Returns the translation, or `_FAILED` if the provider never answered. A
    failure that is not a rate limit is not retried: if the endpoint rejected
    the *input*, sending the same input again more slowly will not help.
    """
    delay = RETRY_BACKOFF_SECONDS

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return await run_in_threadpool(call, text, target_lang)
        except Exception as exc:  # noqa: BLE001 — the wrapper raises many types
            if not _is_rate_limited(exc):
                logger.warning(
                    "%s could not translate a string (%s); skipping it.",
                    provider,
                    type(exc).__name__,
                )
                return _FAILED

            if attempt == MAX_ATTEMPTS:
                logger.warning(
                    "%s rate-limited us %d times in a row; giving up on it.",
                    provider,
                    MAX_ATTEMPTS,
                )
                return _FAILED

            logger.info(
                "%s rate-limited (attempt %d/%d); backing off %.0fs.",
                provider,
                attempt,
                MAX_ATTEMPTS,
                delay,
            )
            await asyncio.sleep(delay)
            delay *= 2

    return _FAILED


class _ProviderChain:
    """Picks a working provider once per pass and sticks with it.

    Previously every string tried Google, was refused, and only then reached
    MyMemory — two requests per string against endpoints already rate-limiting
    us for making too many. A provider that refuses is dropped for the rest of
    the pass, which halves the traffic and stops us knocking on a door that has
    already been shut.
    """

    def __init__(self) -> None:
        self._available = list(PROVIDERS)

    @property
    def exhausted(self) -> bool:
        return not self._available

    async def translate(self, text: str, target_lang: str) -> str | None:
        """One string, with retries. None when every provider gave up on it."""
        while self._available:
            name, call = self._available[0]
            result = await _attempt_with_backoff(call, text, target_lang, name)
            if result is not _FAILED:
                return result

            self._available.pop(0)
            if self._available:
                logger.warning(
                    "Provider %s is refusing requests; switching to %s for the "
                    "rest of this pass.",
                    name,
                    self._available[0][0],
                )
        return None


# --------------------------------------------------------------------------- #
# Cache writes
# --------------------------------------------------------------------------- #


async def _persist(db: AsyncSession, entries: list[dict[str, str]]) -> None:
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


def _entry(source: str, translated: str, language: str) -> dict[str, str]:
    return {
        "source_hash": _hash(source),
        "original_text": source,
        "target_lang": language,
        "translated_text": translated,
    }


# --------------------------------------------------------------------------- #
# Background warming
# --------------------------------------------------------------------------- #


async def warm_cache(texts: list[str], target_lang: str) -> None:
    """Translate and cache these strings. Runs *after* the response is sent.

    Opens its own session, because the request's session is closed by the time a
    background task runs. Every failure is swallowed and logged: nothing here
    can affect a user-visible request, and a menu left in its original language
    is a far better outcome than a 500.
    """
    language = normalize_language(target_lang)
    if language is None or language == MENU_BASE_LANGUAGE:
        return

    pending = sorted(collect_sources(texts))[:WARM_BATCH_LIMIT]
    if not pending:
        return

    # A pass already running will cover this work. Every poll from the client
    # would otherwise queue another one behind it, and they would all wake to
    # translate the same strings — at which point the throttle is meaningless,
    # because ten serialized passes still make ten times the requests.
    if _upstream_lock.locked():
        logger.debug("A warming pass is already running; skipping this one.")
        return

    async with _upstream_lock:
        try:
            async with AsyncSessionLocal() as db:
                # Re-check under the lock: the pass we waited behind may have
                # already translated exactly these strings.
                already = await read_cached(db, pending, language)
                missing = [text for text in pending if text not in already]
                if not missing:
                    return
                await _warm_missing(db, missing, language)
        except Exception:  # noqa: BLE001
            logger.exception("Translation warming failed → %s", language)


async def _warm_missing(db: AsyncSession, missing: list[str], language: str) -> None:
    """Translate one string at a time, throttled, persisting as it goes."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + WARM_TIME_BUDGET_SECONDS
    chain = _ProviderChain()

    buffer: list[dict[str, str]] = []
    cached = 0
    unchanged_run = 0
    # Until one translation comes back genuinely different we cannot tell a
    # working endpoint from one echoing its input. See the echo check below.
    verified = False

    logger.info("Warming %d translation(s) → %s", len(missing), language)

    for index, source in enumerate(missing):
        if loop.time() > deadline:
            logger.info(
                "Warming budget spent after %d/%d string(s) → %s; the rest "
                "follows on the next pass.",
                index,
                len(missing),
                language,
            )
            break

        # Throttle *between* calls, not before the first: the pause exists to
        # space requests out, and there is nothing yet to space this one from.
        if index:
            await asyncio.sleep(THROTTLE_SECONDS)

        translated = await chain.translate(source, language)

        if chain.exhausted:
            logger.warning(
                "Every provider is refusing requests; stopping this pass → %s.",
                language,
            )
            break

        if not translated or not isinstance(translated, str):
            # One string failed after its retries. Skipping it and carrying on
            # is the whole point — the next dish is unrelated and may well work.
            continue

        cleaned = clean_translation(translated)
        if not cleaned:
            continue

        # A word that survives translation unchanged is a real result —
        # "Tiramisu" and "Espresso" are the same in German — and must be cached,
        # or it is re-requested forever and `pending` never clears. What is not
        # a real result is an endpoint echoing its input back, which shows up as
        # an unbroken run of identical results before anything has changed.
        if cleaned.strip() == source.strip():
            unchanged_run += 1
            if not verified and unchanged_run >= ECHO_SUSPICION_THRESHOLD:
                logger.warning(
                    "First %d string(s) came back unchanged for %s — treating "
                    "this as an echoing endpoint and discarding the pass.",
                    unchanged_run,
                    language,
                )
                return
        else:
            unchanged_run = 0
            verified = True

        buffer.append(_entry(source, cleaned, language))

        # Flush early and often: a pass cut short by the budget, or by Render
        # idling the instance, keeps the minute of upstream calls it has already
        # paid for instead of throwing all of it away.
        if verified and len(buffer) >= PERSIST_EVERY:
            await _persist(db, buffer)
            cached += len(buffer)
            buffer.clear()

    if buffer and (verified or unchanged_run < ECHO_SUSPICION_THRESHOLD):
        await _persist(db, buffer)
        cached += len(buffer)

    logger.info("Cached %d translation(s) → %s", cached, language)
