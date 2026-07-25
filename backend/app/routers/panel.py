"""Restaurant-owner panel endpoints: info, theme, menu categories & items."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import MenuCategory, MenuItem, Restaurant
from ..schemas import (
    MenuCategoryCreate,
    MenuCategoryResponse,
    MenuCategoryUpdate,
    MenuItemRequest,
    MenuItemResponse,
    RestaurantPanelInfo,
    RestaurantThemeUpdate,
)

router = APIRouter(prefix="/api/v1/restaurants", tags=["Panel"])


async def _require_restaurant(
    db: AsyncSession, restaurant_id: uuid.UUID
) -> Restaurant:
    restaurant = await db.get(Restaurant, restaurant_id)
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Nie znaleziono restauracji.")
    return restaurant


async def _load_category(
    db: AsyncSession, category_id: uuid.UUID
) -> MenuCategory | None:
    """Load a single live category with its (live) items eagerly attached."""
    result = await db.scalars(
        select(MenuCategory)
        .options(selectinload(MenuCategory.items))
        .where(MenuCategory.id == category_id, MenuCategory.deleted_at.is_(None))
    )
    return result.first()


@router.get("/{restaurant_id}", response_model=RestaurantPanelInfo)
async def get_restaurant(
    restaurant_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> Restaurant:
    """Restaurant name/id for the panel header."""
    return await _require_restaurant(db, restaurant_id)


@router.put("/{restaurant_id}/theme")
async def update_theme(
    restaurant_id: uuid.UUID,
    payload: RestaurantThemeUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Persist the restaurant's visual settings (only provided fields)."""
    restaurant = await _require_restaurant(db, restaurant_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(restaurant, field, value)
    await db.flush()
    return {"success": True}


@router.get(
    "/{restaurant_id}/menu/categories",
    response_model=list[MenuCategoryResponse],
)
async def list_categories(
    restaurant_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[MenuCategory]:
    """Categories (with nested live items) ordered by their sort order."""
    await _require_restaurant(db, restaurant_id)
    result = await db.scalars(
        select(MenuCategory)
        .options(selectinload(MenuCategory.items))
        .where(
            MenuCategory.restaurant_id == restaurant_id,
            MenuCategory.deleted_at.is_(None),
        )
        .order_by(MenuCategory.sort_order.asc())
    )
    return list(result.all())


@router.post(
    "/{restaurant_id}/menu/categories",
    status_code=201,
    response_model=MenuCategoryResponse,
)
async def create_category(
    restaurant_id: uuid.UUID,
    payload: MenuCategoryCreate,
    db: AsyncSession = Depends(get_db),
) -> MenuCategory:
    """Append a new category after the current highest sort order."""
    await _require_restaurant(db, restaurant_id)
    max_order = await db.scalar(
        select(func.max(MenuCategory.sort_order)).where(
            MenuCategory.restaurant_id == restaurant_id,
            MenuCategory.deleted_at.is_(None),
        )
    )
    category = MenuCategory(
        restaurant_id=restaurant_id,
        name=payload.name,
        sort_order=(max_order or 0) + 1,
    )
    db.add(category)
    await db.flush()

    loaded = await _load_category(db, category.id)
    assert loaded is not None
    return loaded


async def _require_category(
    db: AsyncSession, restaurant_id: uuid.UUID, category_id: uuid.UUID
) -> MenuCategory:
    category = await db.get(MenuCategory, category_id)
    if (
        category is None
        or category.deleted_at is not None
        or category.restaurant_id != restaurant_id
    ):
        raise HTTPException(status_code=404, detail="Nie znaleziono kategorii.")
    return category


@router.patch(
    "/{restaurant_id}/menu/categories/{category_id}",
    response_model=MenuCategoryResponse,
)
async def update_category(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    payload: MenuCategoryUpdate,
    db: AsyncSession = Depends(get_db),
) -> MenuCategory:
    """Rename a category."""
    await _require_restaurant(db, restaurant_id)
    category = await _require_category(db, restaurant_id, category_id)
    category.name = payload.name
    await db.flush()

    loaded = await _load_category(db, category.id)
    assert loaded is not None
    return loaded


@router.delete(
    "/{restaurant_id}/menu/categories/{category_id}",
    status_code=204,
)
async def delete_category(
    restaurant_id: uuid.UUID,
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a category and cascade the soft-delete to its dishes."""
    await _require_restaurant(db, restaurant_id)
    category = await _require_category(db, restaurant_id, category_id)

    now = datetime.now(timezone.utc)
    category.deleted_at = now
    items = await db.scalars(
        select(MenuItem).where(
            MenuItem.category_id == category_id,
            MenuItem.deleted_at.is_(None),
        )
    )
    for item in items:
        item.deleted_at = now
    await db.flush()


@router.delete(
    "/{restaurant_id}/menu/items/{item_id}",
    status_code=204,
)
async def delete_menu_item(
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a single dish (ownership verified via its category)."""
    await _require_restaurant(db, restaurant_id)
    item = await db.get(MenuItem, item_id)
    if item is None or item.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Nie znaleziono dania.")

    category = await db.get(MenuCategory, item.category_id)
    if category is None or category.restaurant_id != restaurant_id:
        raise HTTPException(status_code=404, detail="Nie znaleziono dania.")

    item.deleted_at = datetime.now(timezone.utc)
    await db.flush()


@router.post("/{restaurant_id}/menu/items", response_model=MenuItemResponse)
async def upsert_menu_item(
    restaurant_id: uuid.UUID,
    payload: MenuItemRequest,
    db: AsyncSession = Depends(get_db),
) -> MenuItem:
    """Create a dish, or update it in place when `id` refers to an existing one."""
    await _require_restaurant(db, restaurant_id)

    category = await db.get(MenuCategory, payload.category_id)
    if (
        category is None
        or category.deleted_at is not None
        or category.restaurant_id != restaurant_id
    ):
        raise HTTPException(status_code=404, detail="Nie znaleziono kategorii.")

    item: MenuItem | None = None
    if payload.id is not None:
        existing = await db.get(MenuItem, payload.id)
        if existing is not None and existing.deleted_at is None:
            item = existing

    if item is None:
        max_order = await db.scalar(
            select(func.max(MenuItem.sort_order)).where(
                MenuItem.category_id == payload.category_id,
                MenuItem.deleted_at.is_(None),
            )
        )
        item = MenuItem(sort_order=(max_order or 0) + 1)
        if payload.id is not None:
            item.id = payload.id
        db.add(item)

    item.category_id = payload.category_id
    item.name = payload.name
    item.price = payload.price
    item.description = payload.description or ""
    item.ingredients = payload.ingredients or ""
    item.allergens = payload.allergens
    item.tags = payload.tags
    item.is_available = payload.is_available
    item.image_url = payload.image_url

    await db.flush()
    await db.refresh(item)
    return item
