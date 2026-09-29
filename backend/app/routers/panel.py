"""Restaurant-owner panel endpoints: info, theme, menu categories & items."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..cloudinary_service import ImageUploadError, upload_image_if_needed
from ..database import get_db
from ..dependencies import verify_restaurant_access
from ..models import MenuCategory, MenuItem, Restaurant
from ..schemas import (
    MenuCategoryCreate,
    MenuCategoryResponse,
    MenuCategoryUpdate,
    MenuItemRequest,
    MenuItemResponse,
    MenuOrderUpdate,
    RestaurantPanelInfo,
    RestaurantThemeUpdate,
)

# Every route below is addressed as `/{restaurant_id}/…`, so the guard is
# applied once here rather than repeated on every route. It both authenticates the
# bearer token and checks that the token's restaurant matches the one in the
# path — a router-level dependency means a future endpoint cannot be added
# unprotected by forgetting to decorate it.
router = APIRouter(
    prefix="/api/v1/restaurants",
    tags=["Panel"],
    dependencies=[Depends(verify_restaurant_access)],
)


async def _host_image(image: str | None, *, folder: str) -> str | None:
    """Upload a freshly-cropped Data URI to Cloudinary, returning its URL.

    Values that are already hosted URLs pass straight through, so re-saving an
    unchanged photo costs nothing. Upload failures surface as a 502 rather than
    an unhandled 500, so the client shows a real message.
    """
    try:
        return await upload_image_if_needed(image, folder=folder)
    except ImageUploadError as exc:
        raise HTTPException(
            status_code=502,
            detail="Nie udało się przesłać zdjęcia. Spróbuj ponownie.",
        ) from exc


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
    fields = payload.model_dump(exclude_unset=True)
    # The logo rides along on *every* public menu load, so it gets the same
    # Cloudinary treatment as dish photos instead of being inlined as Base64.
    if "logo_url" in fields:
        fields["logo_url"] = await _host_image(fields["logo_url"], folder="logos")
    for field, value in fields.items():
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
        if existing is not None:
            # The id comes from the body, so it has to be proved to be ours
            # like the category was. Dish ids are public — every guest menu
            # carries them — and without this check any owner could name
            # another restaurant's dish here and pull it into their own menu.
            owner = await db.get(MenuCategory, existing.category_id)
            if (
                existing.deleted_at is not None
                or owner is None
                or owner.restaurant_id != restaurant_id
            ):
                raise HTTPException(status_code=404, detail="Nie znaleziono dania.")
            item = existing

    # A new dish, or one moved to another category from the editor, goes to the
    # end of its category — keeping the old position number would drop it at a
    # random place among dishes it was never ordered against.
    if item is None or item.category_id != payload.category_id:
        max_order = await db.scalar(
            select(func.max(MenuItem.sort_order)).where(
                MenuItem.category_id == payload.category_id,
                MenuItem.deleted_at.is_(None),
            )
        )
        if item is None:
            item = MenuItem()
            if payload.id is not None:
                item.id = payload.id
            db.add(item)
        item.sort_order = (max_order or 0) + 1

    item.category_id = payload.category_id
    item.name = payload.name
    item.price = payload.price
    item.description = payload.description or ""
    item.ingredients = payload.ingredients or ""
    item.allergens = payload.allergens
    item.tags = payload.tags
    item.is_available = payload.is_available
    # Store a short Cloudinary URL, never the multi-megabyte Data URI the
    # browser sends — that bloat was the menu-loading bottleneck.
    item.image_url = await _host_image(payload.image_url, folder="dishes")

    await db.flush()
    await db.refresh(item)
    return item


@router.put("/{restaurant_id}/menu/order", status_code=204)
async def reorder_menu(
    restaurant_id: uuid.UUID,
    payload: MenuOrderUpdate,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Persist the board after a drag: category order, dish order, dish moves.

    Every id must belong to this restaurant. One that does not answers 404
    without saying whether it exists elsewhere, like the rest of the panel.
    Live rows the body leaves out — a dish added from another tab while this
    one was dragging — keep their relative order after the listed ones rather
    than being lost or failing the whole request.
    """
    await _require_restaurant(db, restaurant_id)

    categories = list(
        await db.scalars(
            select(MenuCategory)
            .where(
                MenuCategory.restaurant_id == restaurant_id,
                MenuCategory.deleted_at.is_(None),
            )
            .order_by(MenuCategory.sort_order, MenuCategory.created_at)
        )
    )
    categories_by_id = {category.id: category for category in categories}
    if any(entry.id not in categories_by_id for entry in payload.categories):
        raise HTTPException(status_code=404, detail="Nie znaleziono kategorii.")

    items = list(
        await db.scalars(
            select(MenuItem)
            .where(
                MenuItem.category_id.in_(categories_by_id),
                MenuItem.deleted_at.is_(None),
            )
            .order_by(MenuItem.sort_order, MenuItem.created_at)
        )
    )
    items_by_id = {item.id: item for item in items}
    listed_item_ids = {
        item_id for entry in payload.categories for item_id in entry.item_ids
    }
    if not listed_item_ids <= items_by_id.keys():
        raise HTTPException(status_code=404, detail="Nie znaleziono dania.")

    listed_category_ids = {entry.id for entry in payload.categories}
    ordered_categories = [categories_by_id[entry.id] for entry in payload.categories]
    ordered_categories += [
        category for category in categories if category.id not in listed_category_ids
    ]
    for position, category in enumerate(ordered_categories, start=1):
        category.sort_order = position

    columns: dict[uuid.UUID, list[MenuItem]] = {
        category.id: [] for category in categories
    }
    for entry in payload.categories:
        for item_id in entry.item_ids:
            item = items_by_id[item_id]
            item.category_id = entry.id
            columns[entry.id].append(item)
    # `items` is already in the old order, so the leftovers keep theirs.
    for item in items:
        if item.id not in listed_item_ids:
            columns[item.category_id].append(item)
    for dishes in columns.values():
        for position, item in enumerate(dishes, start=1):
            item.sort_order = position

    await db.flush()
