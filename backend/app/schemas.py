"""Pydantic v2 request/response models.

These deliberately mirror the *frontend* TypeScript contracts (the shapes the
React app already consumes from the previous mock server), not just the DB
columns. The notable translation is the menu category `sort_order` DB column,
which is exposed to the client as `order`.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer

from .cloudinary_service import with_delivery_transformation
from .models import RestaurantStatus
from .security import MAX_PASSWORD_BYTES

#: An image column on its way out to a client.
#:
#: The database holds the canonical Cloudinary URL, which serves the original
#: full-size file. Resizing and re-encoding are a *delivery* concern, so the
#: params are injected here, at serialization time, instead of being baked into
#: stored data — every response model that exposes an image gets the cheap
#: variant for free, and the transformation can be retuned in one place without
#: a migration or a re-upload. See `cloudinary_service` for the mechanics.
HostedImageUrl = Annotated[
    str | None, PlainSerializer(with_delivery_transformation)
]

# --------------------------------------------------------------------------- #
# Packages
# --------------------------------------------------------------------------- #


class PackageResponse(BaseModel):
    """Nested/standalone subscription package (frontend `PackageItem`)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


# --------------------------------------------------------------------------- #
# Restaurants (admin)
# --------------------------------------------------------------------------- #


class RestaurantCreate(BaseModel):
    """Body for POST /admin/restaurants."""

    name: str = Field(min_length=1)
    contact_email: str
    contact_phone: str
    package_id: uuid.UUID


class RestaurantListItem(BaseModel):
    """A row in the admin restaurants grid, with its package embedded."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    contact_email: str
    contact_phone: str
    status: RestaurantStatus
    subscription_valid_until: datetime | None
    package: PackageResponse


class PaginationMeta(BaseModel):
    total_items: int
    total_pages: int
    current_page: int


class RestaurantListResponse(BaseModel):
    data: list[RestaurantListItem]
    meta: PaginationMeta


# --------------------------------------------------------------------------- #
# Manual payment
# --------------------------------------------------------------------------- #


class ManualPaymentRequest(BaseModel):
    amount: float = Field(gt=0)
    notes: str | None = None


class UpdatedRestaurant(BaseModel):
    id: uuid.UUID
    new_status: RestaurantStatus
    new_valid_until: datetime | None


class ManualPaymentResponse(BaseModel):
    success: bool
    payment_id: uuid.UUID
    updated_restaurant: UpdatedRestaurant


# --------------------------------------------------------------------------- #
# Panel: restaurant info & theme
# --------------------------------------------------------------------------- #


class RestaurantPanelInfo(BaseModel):
    """Restaurant details for the panel header + subscription gating."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    status: RestaurantStatus
    subscription_valid_until: datetime | None


class RestaurantThemeUpdate(BaseModel):
    """Body for PUT /restaurants/{id}/theme. All fields optional (partial)."""

    logo_url: str | None = None
    primary_color: str | None = None
    background_color: str | None = None
    font_family: str | None = None


class ThemeSettings(BaseModel):
    """Full theme block returned to the public client."""

    model_config = ConfigDict(from_attributes=True)

    logo_url: HostedImageUrl
    primary_color: str
    background_color: str
    font_family: str


# --------------------------------------------------------------------------- #
# Menu items & categories
# --------------------------------------------------------------------------- #


class MenuItemRequest(BaseModel):
    """Upsert body for POST /restaurants/{id}/menu/items.

    `id` present -> update that dish; absent -> create a new one.
    """

    id: uuid.UUID | None = None
    category_id: uuid.UUID
    name: str = Field(min_length=1)
    price: float = Field(ge=0)
    description: str | None = ""
    ingredients: str | None = ""
    allergens: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    is_available: bool = True
    image_url: str | None = None


class MenuItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category_id: uuid.UUID
    name: str
    price: float
    description: str
    ingredients: str
    allergens: list[str]
    tags: list[str]
    is_available: bool
    image_url: HostedImageUrl


class MenuCategoryCreate(BaseModel):
    name: str = Field(min_length=1)


class MenuCategoryUpdate(BaseModel):
    name: str = Field(min_length=1)


class MenuCategoryResponse(BaseModel):
    """Category with nested items. DB `sort_order` is exposed as `order`."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    name: str
    order: int = Field(validation_alias="sort_order", serialization_alias="order")
    items: list[MenuItemResponse] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Public menu
# --------------------------------------------------------------------------- #


class PublicRestaurant(BaseModel):
    name: str
    theme: ThemeSettings
    status: RestaurantStatus
    subscription_valid_until: datetime | None


class PublicMenuResponse(BaseModel):
    restaurant: PublicRestaurant
    categories: list[MenuCategoryResponse]


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #


def _password_field(description: str) -> Any:
    """A password input, bounded at both ends.

    The lower bound is a real (if modest) policy. The upper bound is not
    cosmetic: bcrypt hashes only the first 72 bytes and silently drops the
    rest, so without it two different long passwords would unlock the same
    account. Rejecting them is the only honest option — quietly truncating
    would let an owner believe in a strength they do not have.
    """
    return Field(min_length=8, max_length=MAX_PASSWORD_BYTES, description=description)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_BYTES)


class TokenResponse(BaseModel):
    """OAuth2-shaped so the frontend needs no special casing."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    restaurant_id: uuid.UUID | None = None
    restaurant_name: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    password: str = _password_field("Nowe hasło (min. 8 znaków).")


class AdminLoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=512)


class MessageResponse(BaseModel):
    message: str
