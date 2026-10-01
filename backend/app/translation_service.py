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
them. Machine translation survives in `dictionary.py` — now through DeepL's
official API rather than a scraper — as a *draft* generator the owner reviews
before saving, never as something that reaches a guest unread.
"""

import hashlib
import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .menu_labels import BUILT_IN_ALLERGENS, BUILT_IN_TAGS, custom_labels
from .menu_languages import MENU_LANGUAGES
from .models import MenuCategory, MenuNote, TranslationDictionary, menu_layout

#: Languages the public menu will serve. A `?lang=` outside this set is ignored
#: rather than looked up.
SUPPORTED_LANGUAGES = frozenset(MENU_LANGUAGES)

#: Languages an owner can maintain a dictionary for: the whole catalogue, so a
#: language can be prepared before it is switched on for guests.
DICTIONARY_LANGUAGES = MENU_LANGUAGES

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


async def menu_phrases(db: AsyncSession, restaurant_id: uuid.UUID) -> list[str]:
    """Every distinct phrase in the menu, in menu order.

    Category names come before their dishes, and the owner's notes sit where
    they sit on the menu, so the dictionary screen reads like the menu it
    describes rather than like a database dump.
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
    notes = (
        await db.scalars(
            select(MenuNote)
            .where(
                MenuNote.restaurant_id == restaurant_id,
                MenuNote.deleted_at.is_(None),
            )
            .order_by(MenuNote.sort_order, MenuNote.created_at)
        )
    ).all()

    texts: list[str] = []
    for block in menu_layout(list(categories), list(notes)):
        if isinstance(block, MenuNote):
            texts.append(block.body)
            continue
        texts.append(block.name)
        for item in block.items:
            texts.extend(dish_texts(item))
    return collect_sources(texts)


def dish_texts(item) -> list[str]:
    """Everything the owner wrote on one dish, in reading order.

    Their own allergens and tags count — "Sezam" needs translating like a dish
    name does — but built-in ones do not: the guest interface already has them
    in every language, and listing them would ask the owner to translate
    "Gluten" thirty-four times for nothing. Works on the ORM row and on the
    response model alike; both carry these attributes.
    """
    return [
        item.name,
        item.description,
        item.ingredients,
        *custom_labels(item.allergens or [], BUILT_IN_ALLERGENS),
        *custom_labels(item.tags or [], BUILT_IN_TAGS),
    ]


async def translated_counts(
    db: AsyncSession, restaurant_id: uuid.UUID, phrases: list[str]
) -> dict[str, int]:
    """How many of `phrases` each language has a translation for.

    One query for every language at once. Rows for phrases no longer on the
    menu are ignored, so a renamed dish does not count as translated.
    """
    wanted = set(phrases)
    rows = await db.execute(
        select(
            TranslationDictionary.target_lang,
            TranslationDictionary.original_text,
            TranslationDictionary.translated_text,
        ).where(TranslationDictionary.restaurant_id == restaurant_id)
    )
    counts: dict[str, int] = {}
    for language, original, translated in rows.all():
        if original in wanted and translated and translated.strip():
            counts[language] = counts.get(language, 0) + 1
    return counts


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
