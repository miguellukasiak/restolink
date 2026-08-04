"""Public client-facing endpoint: the full menu for a restaurant."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload, selectinload

from ..database import get_db
from ..models import MenuCategory, Restaurant
from ..schemas import (
    MenuCategoryResponse,
    PublicMenuResponse,
    PublicRestaurant,
    ThemeSettings,
)

router = APIRouter(prefix="/api/v1/public", tags=["Public"])


@router.get(
    "/restaurants/{restaurant_id}/menu",
    response_model=PublicMenuResponse,
)
async def get_public_menu(
    restaurant_id: uuid.UUID, db: AsyncSession = Depends(get_db)
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

    return PublicMenuResponse(
        restaurant=PublicRestaurant(
            name=restaurant.name,
            theme=ThemeSettings.model_validate(restaurant),
            status=restaurant.status,
            subscription_valid_until=restaurant.subscription_valid_until,
        ),
        categories=[MenuCategoryResponse.model_validate(c) for c in categories],
    )
