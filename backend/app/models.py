"""SQLAlchemy 2.0 models mirroring the finalized DBML schema.

Conventions:
- UUID primary keys generated in Python (uuid4).
- Soft deletes everywhere: rows carry `deleted_at`; queries must filter on it.
  Read-oriented relationships below already exclude soft-deleted children.
- Images (logo, dish photos) are stored as Cloudinary URLs in TEXT columns; the
  browser still uploads a Base64 Data URI, which the API swaps for the hosted
  URL before persisting (see app/cloudinary_service.py).
- `allergens` / `tags` are JSONB arrays of strings.
"""

import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class TimestampSoftDeleteMixin:
    """created_at / updated_at bookkeeping + soft-delete marker."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class RestaurantStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    BLOCKED = "BLOCKED"
    PENDING = "PENDING"


class PaymentMethod(str, enum.Enum):
    GATEWAY = "GATEWAY"
    MANUAL = "MANUAL"


class PaymentStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    PENDING = "PENDING"
    FAILED = "FAILED"


class SubscriptionPackage(TimestampSoftDeleteMixin, Base):
    __tablename__ = "subscription_package"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)


class Restaurant(TimestampSoftDeleteMixin, Base):
    __tablename__ = "restaurant"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(50), nullable=False)

    # --- Sign-in credentials -------------------------------------------------
    # `email` is the *login identity* and is deliberately separate from
    # `contact_email`, which is public-facing contact data an owner may want to
    # change or publish without touching how they sign in. Both are nullable so
    # restaurants created before authentication existed stay valid; a row with
    # no credentials simply cannot log in.
    #
    # Postgres allows many NULLs under a UNIQUE constraint, so unset rows do
    # not collide with each other.
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    #: When the password was last changed. Access tokens issued before this
    #: moment are refused, which is what makes a reset actually end every other
    #: session — the whole point of resetting a password you think is
    #: compromised. NULL means "never changed", and every token passes.
    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    package_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("subscription_package.id"), nullable=False
    )
    status: Mapped[RestaurantStatus] = mapped_column(
        SAEnum(RestaurantStatus, name="restaurant_status"),
        default=RestaurantStatus.PENDING,
        nullable=False,
    )
    subscription_valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Theme settings
    primary_color: Mapped[str] = mapped_column(
        String(50), default="#d32f2f", nullable=False
    )
    background_color: Mapped[str] = mapped_column(
        String(50), default="#ffffff", nullable=False
    )
    font_family: Mapped[str] = mapped_column(
        String(100), default="Roboto", nullable=False
    )
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    package: Mapped[SubscriptionPackage] = relationship(lazy="selectin")
    categories: Mapped[list["MenuCategory"]] = relationship(
        primaryjoin=(
            "and_(Restaurant.id == MenuCategory.restaurant_id, "
            "MenuCategory.deleted_at.is_(None))"
        ),
        order_by="MenuCategory.sort_order",
        viewonly=True,
    )


class PasswordReset(Base):
    """A single-use, short-lived password reset grant.

    Only the SHA-256 *hash* of the token is stored: the raw value exists in the
    email and nowhere else, so a leaked database dump cannot be replayed to take
    over an account.

    Rows are hard-deleted rather than soft-deleted — unlike the rest of the
    schema. A soft-deleted credential is still a credential, and keeping spent
    tokens around only widens the window for mistakes. `used_at` therefore does
    not exist either; consumption means deletion.
    """

    __tablename__ = "password_reset"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("restaurant.id"), nullable=False, index=True
    )
    #: SHA-256 of the raw token, hex-encoded — always 64 characters.
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PaymentHistory(TimestampSoftDeleteMixin, Base):
    __tablename__ = "payment_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("restaurant.id"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status"), nullable=False
    )
    payment_method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod, name="payment_method"), nullable=False
    )
    external_transaction_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MenuCategory(Base):
    __tablename__ = "menu_category"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("restaurant.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    items: Mapped[list["MenuItem"]] = relationship(
        primaryjoin=(
            "and_(MenuCategory.id == MenuItem.category_id, "
            "MenuItem.deleted_at.is_(None))"
        ),
        order_by="(MenuItem.sort_order, MenuItem.created_at)",
        viewonly=True,
    )


class MenuItem(TimestampSoftDeleteMixin, Base):
    __tablename__ = "menu_item"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("menu_category.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    ingredients: Mapped[str] = mapped_column(Text, default="", nullable=False)
    allergens: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    is_available: Mapped[bool] = mapped_column(default=True, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
