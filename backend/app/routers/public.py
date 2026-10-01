"""Public client-facing endpoint: the full menu for a restaurant."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload, selectinload

from ..database import get_db
from ..menu_languages import offered_languages
from ..models import MenuCategory, MenuNote, Restaurant
from ..menu_labels import BUILT_IN_ALLERGENS, BUILT_IN_TAGS
from ..translation_service import (
    collect_sources,
    dish_texts,
    load_dictionary,
    resolve_phrases,
)
from ..schemas import (
    MenuCategoryResponse,
    MenuNoteResponse,
    PublicMenuResponse,
    PublicRestaurant,
    ThemeSettings,
    TranslationStatus,
)

router = APIRouter(prefix="/api/v1/public", tags=["Public"])


@router.get(
    "/restaurants/{restaurant_id}/menu",
    response_model=PublicMenuResponse,
)
async def get_public_menu(
    restaurant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    lang: str | None = Query(
        None,
        max_length=16,
        description=(
            "Two-letter target language for the menu's free text, e.g. `de`. "
            "Regional forms like `de-AT` are accepted. Omit it — or pass the "
            "menu's own language — to get the original wording."
        ),
    ),
) -> PublicMenuResponse:
    """Restaurant name, theme, and non-deleted categories with non-deleted items.

    The whole menu is fetched in a fixed, small number of queries regardless of
    size: one for the restaurant, one for its categories, one for the owner's
    notes between them, and a single
    ``selectinload`` batch for *all* items across those categories (never one
    query per category — that would be the classic N+1). `allergens`/`tags` are
    JSONB columns on the item row, so they add no extra round-trips.

    `noload(Restaurant.package)` suppresses the relationship's default
    ``lazy="selectin"`` — the public payload never uses the subscription package,
    so there's no reason to pay for that extra query on this hot, QR-scanned path.
    """
    restaurant = await db.get(
        Restaurant, restaurant_id, options=[noload(Restaurant.package)]
    )
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Nie znaleziono restauracji.")

    result = await db.scalars(
        select(MenuCategory)
        .options(selectinload(MenuCategory.items))
        .where(
            MenuCategory.restaurant_id == restaurant_id,
            MenuCategory.deleted_at.is_(None),
        )
        .order_by(MenuCategory.sort_order.asc())
    )
    categories = result.all()
    notes = await db.scalars(
        select(MenuNote)
        .where(MenuNote.restaurant_id == restaurant_id, MenuNote.deleted_at.is_(None))
        .order_by(MenuNote.sort_order, MenuNote.created_at)
    )

    payload = PublicMenuResponse(
        restaurant=PublicRestaurant(
            name=restaurant.name,
            theme=ThemeSettings.model_validate(restaurant),
            status=restaurant.status,
            subscription_valid_until=restaurant.subscription_valid_until,
            languages=[
                restaurant.base_language,
                *offered_languages(restaurant.menu_languages, restaurant.base_language),
            ],
            currency=restaurant.currency,
            country=restaurant.country,
        ),
        categories=[MenuCategoryResponse.model_validate(c) for c in categories],
        notes=[MenuNoteResponse.model_validate(note) for note in notes],
    )

    await _localize(db, payload, restaurant, lang)
    return payload


async def _localize(
    db: AsyncSession,
    payload: PublicMenuResponse,
    restaurant: Restaurant,
    lang: str | None,
) -> None:
    """Rewrite the menu's free text into `lang`, in place.

    Reads the owner's dictionary and nothing else: one SELECT per language, no
    network call, so the endpoint answers as fast in German as in Polish.

    Resolution is per phrase, not per menu — the requested language first, then
    English, then the original wording. A part-finished German dictionary gives
    a German guest German where the owner got to, English where they had
    already done it, and Polish for the rest, which beats holding the whole menu
    back to Polish over one missing dish.

    Only author-written text is touched: category names, dish names,
    descriptions, ingredients, the allergens and tags the owner made up, and
    the notes between the sections.
    Ids, prices, availability and the *built-in* allergens and tags are left
    alone — ids because they address rows, prices because a translation must
    never be able to change a number, and built-in labels because the frontend
    already translates them through i18next and filters by their stored value.
    A custom allergen is translated consistently across the whole payload, so
    the guest's allergy filter, built from the same payload, still matches it.
    """
    phrases, language = await resolve_phrases(
        db, restaurant.id, lang, restaurant.base_language
    )
    if language is None:
        return

    sources: list[str] = [note.body for note in payload.notes]
    for category in payload.categories:
        sources.append(category.name)
        for item in category.items:
            sources.extend(dish_texts(item))

    # `.get(text, text)` throughout: an untranslated phrase keeps its original
    # wording, so a half-finished dictionary degrades one dish at a time.
    for category in payload.categories:
        category.name = phrases.get(category.name, category.name)
        for item in category.items:
            item.name = phrases.get(item.name, item.name)
            item.description = phrases.get(item.description, item.description)
            item.ingredients = phrases.get(item.ingredients, item.ingredients)
            item.allergens = [
                label if label in BUILT_IN_ALLERGENS else phrases.get(label, label)
                for label in item.allergens
            ]
            item.tags = [
                label if label in BUILT_IN_TAGS else phrases.get(label, label)
                for label in item.tags
            ]

    for note in payload.notes:
        note.body = phrases.get(note.body, note.body)

    distinct = collect_sources(sources)
    translated = sum(1 for phrase in distinct if phrase in phrases)

    # Whether English had to cover for the requested language. Worked out from
    # the primary dictionary alone, so it stays honest when the two overlap.
    primary_only = await load_dictionary(db, restaurant.id, language)
    used_fallback = any(
        phrase in phrases and phrase not in primary_only for phrase in distinct
    )

    payload.translation = TranslationStatus(
        language=language,
        base_language=restaurant.base_language,
        used_fallback=used_fallback,
        phrases_total=len(distinct),
        phrases_translated=translated,
    )
