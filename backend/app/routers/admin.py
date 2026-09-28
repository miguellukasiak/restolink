"""Admin endpoints: restaurant management, manual payments, packages."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload, selectinload

from .. import audit
from ..database import get_db
from ..dependencies import get_current_superadmin
from ..models import (
    AdminUser,
    AuditLog,
    PaymentHistory,
    PaymentMethod,
    PaymentStatus,
    Restaurant,
    RestaurantStatus,
    SubscriptionPackage,
)
from ..schemas import (
    AdminCreateRequest,
    AdminListItem,
    AdminProfile,
    AuditLogResponse,
    ImpersonationResponse,
    ManualPaymentRequest,
    ManualPaymentResponse,
    PackageResponse,
    PaginationMeta,
    RestaurantCreate,
    RestaurantListItem,
    RestaurantListResponse,
    UpdatedRestaurant,
)
from ..security import (
    IMPERSONATION_TOKEN_TTL,
    as_utc,
    create_access_token,
    hash_password,
)

# These routes list every customer, create restaurants and record payments, so
# the whole router sits behind the superadmin check — applied here rather than
# on each endpoint, so an HQ route added later cannot arrive unprotected by
# someone forgetting to decorate it.
router = APIRouter(
    prefix="/api/v1/admin",
    tags=["Admin"],
    dependencies=[Depends(get_current_superadmin)],
)


@router.get("/me", response_model=AdminProfile)
async def get_me(
    admin: AdminUser = Depends(get_current_superadmin),
) -> AdminUser:
    """The signed-in HQ account.

    Exists because the panel no longer has one anonymous operator: with named
    accounts, "who am I signed in as" is a real question, and the header shows
    the answer.
    """
    return admin


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
    payload: RestaurantCreate,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_superadmin),
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

    await audit.record(
        db,
        admin_email=admin.email,
        action=audit.RESTAURANT_CREATED,
        target_entity=f"{restaurant.name} ({restaurant.id})",
    )

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
    admin: AdminUser = Depends(get_current_superadmin),
) -> ManualPaymentResponse:
    """Book a manual transfer: record payment, extend subscription, activate."""
    restaurant = await db.get(Restaurant, restaurant_id)
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(
            status_code=404, detail="Nie znaleziono restauracji o podanym ID."
        )

    now = datetime.now(timezone.utc)
    # `as_utc` because the stored value's awareness is a property of the driver,
    # not of this code: comparing a naive timestamp against an aware one raises
    # mid-request and turns booking a payment into a 500.
    base = as_utc(restaurant.subscription_valid_until) if restaurant.subscription_valid_until else now
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
    await audit.record(
        db,
        admin_email=admin.email,
        action=audit.RESTAURANT_PAYMENT_RECORDED,
        target_entity=f"{restaurant.name} ({restaurant.id}) — {payload.amount:.2f}",
    )
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


# --------------------------------------------------------------------------- #
# HQ team
# --------------------------------------------------------------------------- #


@router.get("/admins", response_model=list[AdminListItem])
async def list_admins(db: AsyncSession = Depends(get_db)) -> list[AdminUser]:
    """Every HQ account, revoked ones included.

    Revoked accounts stay on the list rather than disappearing: "who used to
    have access" is exactly the question this screen is for, and hiding them
    would make a revocation look like a deletion.
    """
    result = await db.scalars(select(AdminUser).order_by(AdminUser.created_at.asc()))
    return list(result.all())


@router.post("/admins", status_code=201, response_model=AdminListItem)
async def create_admin(
    payload: AdminCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_superadmin),
) -> AdminUser:
    """Add a colleague to HQ.

    The raw password is hashed here and never stored, logged or echoed back —
    the response is the account, not the credential. Whoever creates the
    account has to pass the password to its owner out of band, which is the
    same trade the CLI bootstrap makes.
    """
    email = payload.email.strip().lower()

    created = AdminUser(
        email=email,
        hashed_password=hash_password(payload.password),
        is_superadmin=True,
        # Stamped now so the column is never NULL for an account that has one.
        # Nothing can predate the row, so no token is retired by it.
        password_changed_at=datetime.now(timezone.utc),
    )
    db.add(created)

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        # The unique index on email is the only constraint this insert can
        # break, and 409 is the honest answer: the request was well formed, the
        # address is simply taken.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Konto o tym adresie e-mail już istnieje.",
        ) from exc

    await audit.record(
        db,
        admin_email=admin.email,
        action=audit.ADMIN_CREATED,
        target_entity=email,
    )
    return created


@router.put("/admins/{admin_id}/revoke", response_model=AdminListItem)
async def revoke_admin(
    admin_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_superadmin),
) -> AdminUser:
    """Take away HQ access without deleting the person.

    The row stays so the audit trail keeps pointing at a real account. The flag
    is re-read on every request, so this takes effect on the target's very next
    call rather than when their token happens to expire.
    """
    target = await db.get(AdminUser, admin_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Nie znaleziono konta.")

    if target.id == admin.id:
        # Self-revocation is the one move that can empty HQ: every other
        # revocation leaves at least the person performing it. Refusing here is
        # what guarantees an account always remains to let the others back in.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Nie można odebrać uprawnień samemu sobie. Poproś innego "
                "administratora."
            ),
        )

    if not target.is_superadmin:
        # Already revoked. Answering 200 keeps the button idempotent instead of
        # showing an error for a state the operator wanted anyway.
        return target

    target.is_superadmin = False
    await audit.record(
        db,
        admin_email=admin.email,
        action=audit.ADMIN_REVOKED,
        target_entity=target.email,
    )
    await db.flush()
    return target


# --------------------------------------------------------------------------- #
# Audit log
# --------------------------------------------------------------------------- #


@router.get("/audit-logs", response_model=AuditLogResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> AuditLogResponse:
    """The trail, newest first."""
    total_items = await db.scalar(select(func.count(AuditLog.id))) or 0

    result = await db.scalars(
        select(AuditLog)
        # `id` breaks ties: entries written in the same transaction share a
        # timestamp to the microsecond, and without a second key their order
        # would be whatever the planner felt like, differing between pages.
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    total_pages = (total_items + limit - 1) // limit if total_items else 0

    return AuditLogResponse(
        data=list(result.all()),
        meta=PaginationMeta(
            total_items=total_items, total_pages=total_pages, current_page=page
        ),
    )


# --------------------------------------------------------------------------- #
# Impersonation
# --------------------------------------------------------------------------- #


@router.post("/impersonate/{restaurant_id}", response_model=ImpersonationResponse)
async def impersonate_restaurant(
    restaurant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(get_current_superadmin),
) -> ImpersonationResponse:
    """Mint an owner token for support work, and write down that it happened.

    This is the most powerful thing the HQ panel can do: the result is a normal
    restaurant token, indistinguishable from one the owner signed in for, and
    it opens their menu, their settings and their data. Three things keep that
    proportionate.

    It is behind the superadmin check like everything else here. It expires in
    an hour rather than the owner's week, because a support session is a phone
    call and a forgotten tab should not still be a key tomorrow. And it is
    unconditionally recorded in the audit log *before* the token exists, so
    there is no path that produces a token without a row naming who took it.
    """
    restaurant = await db.get(
        Restaurant, restaurant_id, options=[noload(Restaurant.package)]
    )
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Nie znaleziono restauracji.")

    await audit.record(
        db,
        admin_email=admin.email,
        action=audit.RESTAURANT_IMPERSONATED,
        target_entity=f"{restaurant.name} ({restaurant.id})",
    )
    await db.flush()

    token, expires_in = create_access_token(
        subject=str(restaurant.id),
        role="restaurant",
        expires_in=IMPERSONATION_TOKEN_TTL,
    )
    return ImpersonationResponse(
        access_token=token,
        expires_in=expires_in,
        restaurant_id=restaurant.id,
        restaurant_name=restaurant.name,
    )
