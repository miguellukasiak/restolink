"""Menu translation from an owner-maintained dictionary.

This replaced a background machine-translation worker. Two things killed that
approach, and both are worth remembering before anyone reaches for it again:

**The free endpoints refuse Render.** Google's answers `TooManyRequests` on the
first call from a datacenter IP, and throttling to one request a second, backing
off exponentially and switching providers did not change that — a shared IP is
blacklisted regardless of how politely it knocks.

**Machine output is not good enough for a menu.** In testing, "Smażony ser"
came back as "Gekochter Käse" — *boiled* cheese. That is not a typo a guest
forgives; it is a different dish, and often enough an allergy-relevant one. A
menu is the one text a restaurant cannot afford to have approximately right.

So the owner writes the translations, in the panel, and this module only reads
them. `deep-translator` survives in `dictionary.py` as a *draft* generator the
owner reviews before saving — never as something that reaches a guest unread.
"""

import hashlib
import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import TranslationDictionary

#: Languages the public menu will serve. A `?lang=` outside this set is ignored
#: rather than looked up.
SUPPORTED_LANGUAGES = frozenset({"en", "de", "fr", "es", "it", "uk", "cs", "pl"})

#: Languages an owner can maintain a dictionary for, in the order the panel
#: lists them.
DICTIONARY_LANGUAGES = ("en", "de", "fr", "es")

#: Tried when the requested language has no entry for a phrase. English is the
#: language a tourist in Poland is most likely to read, so a German guest
#: looking at a dish nobody translated into German is better served English
#: than Polish.
FALLBACK_LANGUAGE = "en"

#: Longer strings are not offered for translation — dish text is short, and
#: anything past this is a copy-paste accident.
MAX_SOURCE_LENGTH = 2000

#: A phrase needs at least this many letters to be worth translating. Two,
#: because what this excludes is measurements — "0,5 l", "200 g", "12%" — and
#: checking for merely *a* letter is not enough: the "l" in "0,5 l" is one.
MIN_ALPHA_CHARACTERS = 2


def normalize_language(raw: str | None) -> str | None:
    """`de-AT` → `de`. Returns None when the value is unusable or unsupported."""
    if not raw:
        return None
    code = raw.strip().lower().split("-")[0]
    return code if code in SUPPORTED_LANGUAGES else None


def source_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def translatable(text: str) -> bool:
    """Skip blanks, bare measurements and anything implausibly long."""
    stripped = text.strip()
    if not stripped or len(stripped) > MAX_SOURCE_LENGTH:
        return False
    return sum(1 for character in stripped if character.isalpha()) >= MIN_ALPHA_CHARACTERS


def collect_sources(texts: Iterable[str]) -> list[str]:
    """The distinct, worth-translating phrases in a menu, in stable order.

    De-duplicated because a menu repeats category names and stock phrasing, and
    the owner should be asked to translate each phrase exactly once. Ordered so
    the dictionary screen does not reshuffle itself between visits.
    """
    seen: dict[str, None] = {}
    for text in texts:
        if text and translatable(text) and text not in seen:
            seen[text] = None
    return list(seen)


async def load_dictionary(
    db: AsyncSession, restaurant_id: uuid.UUID, target_lang: str
) -> dict[str, str]:
    """Every phrase this restaurant has translated into `target_lang`.

    Keyed by the original text, so callers look up what they already have
    without hashing anything themselves.
    """
    language = normalize_language(target_lang)
    if language is None:
        return {}

    rows = await db.scalars(
        select(TranslationDictionary).where(
            TranslationDictionary.restaurant_id == restaurant_id,
            TranslationDictionary.target_lang == language,
        )
    )
    return {
        row.original_text: row.translated_text
        for row in rows
        if row.translated_text and row.translated_text.strip()
    }


async def resolve_phrases(
    db: AsyncSession,
    restaurant_id: uuid.UUID,
    target_lang: str | None,
    base_language: str,
) -> tuple[dict[str, str], str | None]:
    """Phrase map for a public menu request, with fallback.

    Returns `(original phrase → translation, language serving the menu)`, or
    `({}, None)` when nothing should be translated.

    The chain runs **per phrase**, not per menu: the requested language first,
    then English, then the original wording. A part-finished German dictionary
    therefore renders German where the owner got to, English where they had
    already done it, and Polish for the rest — strictly more readable than
    holding the whole menu back to Polish because one dish is missing.
    """
    language = normalize_language(target_lang)
    if language is None or language == base_language:
        return {}, None

    primary = await load_dictionary(db, restaurant_id, language)

    # English fills the gaps, unless it *is* the request or the base language,
    # in which cases there is nothing to fall back to.
    if language != FALLBACK_LANGUAGE and FALLBACK_LANGUAGE != base_language:
        fallback = await load_dictionary(db, restaurant_id, FALLBACK_LANGUAGE)
        merged = {**fallback, **primary}
    else:
        merged = primary

    return merged, language
