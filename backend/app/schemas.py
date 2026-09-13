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


class TranslationStatus(BaseModel):
    """Which language this menu is actually being served in.

    Translations come from the owner's dictionary, so coverage can be partial:
    `phrases_translated` out of `phrases_total` says how much of the menu the
    guest is reading in their own language rather than in a fallback.
    """

    #: The language requested, and the one the page should be labelled with.
    language: str
    #: The restaurant's own language — what untranslated phrases are written in.
    base_language: str
    #: True when at least one phrase came from English because the requested
    #: language had no entry for it.
    used_fallback: bool = False
    phrases_total: int = 0
    phrases_translated: int = 0


class PublicMenuResponse(BaseModel):
    restaurant: PublicRestaurant
    categories: list[MenuCategoryResponse]
    #: Absent when the menu was requested in its own language.
    translation: TranslationStatus | None = None


# --------------------------------------------------------------------------- #
# Translation dictionary (owner panel)
# --------------------------------------------------------------------------- #


class DictionaryEntry(BaseModel):
    """One menu phrase and its translation, as shown in the panel."""

    original_text: str
    translated_text: str = ""


class DictionaryResponse(BaseModel):
    target_lang: str
    base_language: str
    #: Every distinct phrase in the menu, in menu order, each with whatever the
    #: owner has already written for it.
    entries: list[DictionaryEntry]


class DictionarySaveRequest(BaseModel):
    target_lang: str = Field(min_length=2, max_length=8)
    entries: list[DictionaryEntry] = Field(default_factory=list)


class AutoTranslateRequest(BaseModel):
    target_lang: str = Field(min_length=2, max_length=8)
    #: Only the phrases the owner wants drafted — normally the empty ones.
    texts: list[str] = Field(default_factory=list, max_length=100)


class AutoTranslateResponse(BaseModel):
    target_lang: str
    #: Drafts for review. Nothing here has been saved.
    entries: list[DictionaryEntry]
    #: Phrases the translator could not produce a draft for; the owner writes
    #: those by hand.
    failed: list[str] = Field(default_factory=list)


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


# --------------------------------------------------------------------------- #
# Google Maps reviews (owner panel)
# --------------------------------------------------------------------------- #


class GooglePlaceUpdate(BaseModel):
    """Body for PUT /panel/{id}/google-place.

    An empty string is a valid value and means "disconnect" — the owner gets
    the setup screen back rather than being stuck with a listing they can only
    replace, never remove.
    """

    google_place_id: str = Field(max_length=255)


class GoogleReviewItem(BaseModel):
    """One review, normalised out of Google's payload.

    Only the fields the dashboard renders are kept. Google's envelope carries
    more (language codes, translation flags, author URLs we do not link to),
    and storing the lot would mean a cached row full of data no screen reads.
    """

    author_name: str
    profile_photo_url: str | None = None
    rating: float
    text: str = ""
    #: Already localised by the API — the request asks for Polish, so this
    #: arrives as e.g. "2 tygodnie temu" and needs no formatting here.
    relative_time_description: str = ""
    #: Epoch seconds. Used to order "most recent", and nothing else.
    time: int = 0


class GoogleReviewsResponse(BaseModel):
    """The reviews dashboard's entire state, in one answer.

    `configured` is what the panel switches on: false renders the setup screen,
    true renders the dashboard. Returning it as data rather than as a 404 keeps
    "not set up yet" out of the error path, where it would otherwise show a
    guest-facing owner a red alert for something they have simply not done yet.
    """

    configured: bool
    place_id: str | None = None
    #: NULL for a listing with no ratings yet — distinct from 0.0, which would
    #: read as "rated, and terribly".
    rating: float | None = None
    total_ratings: int = 0
    reviews: list[GoogleReviewItem] = Field(default_factory=list)
    #: When the data was last pulled from Google. NULL before the first sync.
    synced_at: datetime | None = None
