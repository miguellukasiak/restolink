"""Admin endpoints: restaurant management, manual payments, packages."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import (
    PaymentHistory,
    PaymentMethod,
    PaymentStatus,
    Restaurant,
    RestaurantStatus,
    SubscriptionPackage,
)
from ..schemas import (
    ManualPaymentRequest,
    ManualPaymentResponse,
    PackageResponse,
    PaginationMeta,
    RestaurantCreate,
    RestaurantListItem,
    RestaurantListResponse,
    UpdatedRestaurant,
)

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])


async def _get_restaurant_with_package(
    db: AsyncSession, restaurant_id: uuid.UUID
) -> Restaurant | None:
    """Fetch a live restaurant with its package eagerly loaded."""
    result = await db.scalars(
        select(Restaurant)
        .options(selectinload(Restaurant.package))
        .where(Restaurant.id == restaurant_id, Restaurant.deleted_at.is_(None))
    )
    return result.first()


@router.get("/restaurants", response_model=RestaurantListResponse)
async def list_restaurants(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> RestaurantListResponse:
    """Paginated list of restaurant accounts with their subscription package."""
    total_items = await db.scalar(
        select(func.count(Restaurant.id)).where(Restaurant.deleted_at.is_(None))
    )
    total_items = total_items or 0

    result = await db.scalars(
        select(Restaurant)
        .options(selectinload(Restaurant.package))
        .where(Restaurant.deleted_at.is_(None))
        .order_by(Restaurant.created_at.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    restaurants = result.all()
    total_pages = (total_items + limit - 1) // limit if total_items else 0

    return RestaurantListResponse(
        data=list(restaurants),
        meta=PaginationMeta(
            total_items=total_items,
            total_pages=total_pages,
            current_page=page,
        ),
    )


@router.post("/restaurants", status_code=201, response_model=RestaurantListItem)
async def create_restaurant(
    payload: RestaurantCreate, db: AsyncSession = Depends(get_db)
) -> Restaurant:
    """Create a PENDING restaurant with a 14-day trial window."""
    package = await db.get(SubscriptionPackage, payload.package_id)
    if package is None or package.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Nie znaleziono pakietu.")

    restaurant = Restaurant(
        name=payload.name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        package_id=payload.package_id,
        status=RestaurantStatus.PENDING,
        subscription_valid_until=datetime.now(timezone.utc) + timedelta(days=14),
    )
    db.add(restaurant)
    await db.flush()

    created = await _get_restaurant_with_package(db, restaurant.id)
    assert created is not None
    return created


@router.post(
    "/restaurants/{restaurant_id}/manual-payment",
    response_model=ManualPaymentResponse,
)
async def manual_payment(
    restaurant_id: uuid.UUID,
    payload: ManualPaymentRequest,
    db: AsyncSession = Depends(get_db),
) -> ManualPaymentResponse:
    """Book a manual transfer: record payment, extend subscription, activate."""
    restaurant = await db.get(Restaurant, restaurant_id)
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail="Nie znaleziono restauracji o podanym ID."
        )

    now = datetime.now(timezone.utc)
    base = restaurant.subscription_valid_until or now
    if base < now:
        base = now
    restaurant.subscription_valid_until = base + timedelta(days=30)
    restaurant.status = RestaurantStatus.ACTIVE

    payment = PaymentHistory(
        restaurant_id=restaurant.id,
        amount=payload.amount,
        status=PaymentStatus.SUCCESS,
        payment_method=PaymentMethod.MANUAL,
        payment_date=now,
    )
    db.add(payment)
    await db.flush()

    return ManualPaymentResponse(
        success=True,
        payment_id=payment.id,
        updated_restaurant=UpdatedRestaurant(
            id=restaurant.id,
            new_status=restaurant.status,
            new_valid_until=restaurant.subscription_valid_until,
        ),
    )


@router.get("/packages", response_model=list[PackageResponse])
async def list_packages(db: AsyncSession = Depends(get_db)) -> list[SubscriptionPackage]:
    """All active subscription packages."""
    result = await db.scalars(
        select(SubscriptionPackage)
        .where(SubscriptionPackage.deleted_at.is_(None))
        .order_by(SubscriptionPackage.created_at.asc())
    )
    return list(result.all())
