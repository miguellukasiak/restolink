"""Public client-facing endpoint: the full menu for a restaurant."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload, selectinload

from ..database import get_db
from ..models import MenuCategory, Restaurant
from ..translation_service import (
    MENU_BASE_LANGUAGE,
    collect_sources,
    normalize_language,
    read_cached,
    warm_cache,
)
from ..schemas import (
    MenuCategoryResponse,
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
    background_tasks: BackgroundTasks,
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
    size: one for the restaurant, one for its categories, and a single
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

    payload = PublicMenuResponse(
        restaurant=PublicRestaurant(
            name=restaurant.name,
            theme=ThemeSettings.model_validate(restaurant),
            status=restaurant.status,
            subscription_valid_until=restaurant.subscription_valid_until,
        ),
        categories=[MenuCategoryResponse.model_validate(c) for c in categories],
    )

    await _localize(db, payload, lang, background_tasks)
    return payload


async def _localize(
    db: AsyncSession,
    payload: PublicMenuResponse,
    lang: str | None,
    background_tasks: BackgroundTasks,
) -> None:
    """Rewrite the menu's free text into `lang`, in place.

    Reads only the cache, so this adds one SELECT and never a network call —
    the endpoint answers just as fast in German as in Polish. Anything not yet
    cached keeps its original wording and is queued for a background warming
    pass, and the response says so via `translation.pending` so the client can
    come back for it.

    Only author-written prose is touched: category names, dish names,
    descriptions and ingredients. Ids, prices, availability, allergens and tags
    are left alone — ids because they address rows, prices because a machine
    translator will happily mangle a number, and allergens/tags because they
    come from a fixed vocabulary the frontend already translates properly
    through i18next.
    """
    language = normalize_language(lang)
    if language is None or language == MENU_BASE_LANGUAGE:
        return

    sources: list[str] = []
    for category in payload.categories:
        sources.append(category.name)
        for item in category.items:
            sources.extend((item.name, item.description, item.ingredients))

    translations = await read_cached(db, sources, language)

    # `.get(text, text)` throughout: a string that is not cached keeps its
    # original wording, so a cold cache degrades one dish at a time rather than
    # failing the menu.
    for category in payload.categories:
        category.name = translations.get(category.name, category.name)
        for item in category.items:
            item.name = translations.get(item.name, item.name)
            item.description = translations.get(item.description, item.description)
            item.ingredients = translations.get(item.ingredients, item.ingredients)

    missing = [text for text in collect_sources(sources) if text not in translations]
    if missing:
        background_tasks.add_task(warm_cache, missing, language)

    payload.translation = TranslationStatus(
        language=language, pending=bool(missing)
    )
