"""Public client-facing endpoint: the full menu for a restaurant."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
    """Restaurant name, theme, and non-deleted categories with non-deleted items."""
    restaurant = await db.get(Restaurant, restaurant_id)
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
        ),
        categories=[MenuCategoryResponse.model_validate(c) for c in categories],
    )
