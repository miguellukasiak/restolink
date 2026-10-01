"""Pydantic v2 request/response models.

These deliberately mirror the *frontend* TypeScript contracts (the shapes the
React app already consumes from the previous mock server), not just the DB
columns. The notable translation is the menu category `sort_order` DB column,
which is exposed to the client as `order`.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    PlainSerializer,
    field_validator,
    model_validator,
)

from .cloudinary_service import with_delivery_transformation
from .countries import (
    COUNTRIES,
    CURRENCIES,
    DEFAULT_COUNTRY,
    MAX_ADDRESS_LENGTH,
    default_currency,
    default_menu_language,
)
from .menu_languages import MENU_LANGUAGES
from .panel_language import DEFAULT_PANEL_LANGUAGE, PANEL_LANGUAGES
from .menu_labels import (
    BUILT_IN_ALLERGENS,
    BUILT_IN_TAGS,
    MAX_LABEL_LENGTH,
    MAX_LABELS,
    clean_labels,
)
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
    #: The panel's second language beside English, or None for English only.
    panel_language: str | None = None
    #: Where it is. The currency and the menu's language follow from it
    #: unless given.
    country: str = DEFAULT_COUNTRY
    address: str | None = None
    currency: str | None = None
    base_language: str | None = None

    @field_validator("panel_language")
    @classmethod
    def _panel_language(cls, value: str | None) -> str | None:
        return _checked_panel_language(value)

    @field_validator("country")
    @classmethod
    def _country(cls, value: str) -> str:
        return _checked_country(value)

    @field_validator("address")
    @classmethod
    def _address(cls, value: str | None) -> str | None:
        return _checked_address(value)

    @field_validator("currency")
    @classmethod
    def _currency(cls, value: str | None) -> str | None:
        return None if value is None else _checked_currency(value)

    @field_validator("base_language")
    @classmethod
    def _base_language(cls, value: str | None) -> str | None:
        return None if value is None else _checked_menu_language(value)

    @model_validator(mode="after")
    def _country_defaults(self) -> "RestaurantCreate":
        if self.currency is None:
            self.currency = default_currency(self.country)
        if self.base_language is None:
            self.base_language = default_menu_language(self.country)
        return self


def _checked_country(value: str) -> str:
    code = value.strip().upper()
    if code not in COUNTRIES:
        raise ValueError("Nieznany kraj.")
    return code


def _checked_address(value: str | None) -> str | None:
    """Tidied, or None when there is nothing in it."""
    if value is None:
        return None
    text = " ".join(value.split())
    if len(text) > MAX_ADDRESS_LENGTH:
        raise ValueError(
            f"Adres jest za długi — najwyżej {MAX_ADDRESS_LENGTH} znaków."
        )
    return text or None


def _checked_currency(value: str) -> str:
    code = value.strip().upper()
    if code not in CURRENCIES:
        raise ValueError("Nieobsługiwana waluta.")
    return code


#: What a menu can be written in: any language it can be offered in.
MENU_BASE_LANGUAGES: tuple[str, ...] = MENU_LANGUAGES


def _checked_menu_language(value: str) -> str:
    code = value.strip().lower()
    if code not in MENU_BASE_LANGUAGES:
        raise ValueError("Nieobsługiwany język menu.")
    return code


def _checked_panel_language(value: str | None) -> str | None:
    """A known second language, or None. English is every panel's already."""
    if value is None or value == "" or value == DEFAULT_PANEL_LANGUAGE:
        return None
    if value not in PANEL_LANGUAGES:
        raise ValueError(
            "Nieobsługiwany język panelu. Dostępne: " + ", ".join(PANEL_LANGUAGES)
        )
    return value


class RestaurantListItem(BaseModel):
    """A row in the admin restaurants grid, with its package embedded."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    contact_email: str
    contact_phone: str
    status: RestaurantStatus
    subscription_valid_until: datetime | None
    panel_language: str | None = None
    country: str = DEFAULT_COUNTRY
    address: str | None = None
    currency: str = "PLN"
    base_language: str = "pl"
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
    #: The panel's second language beside English; None means English only.
    panel_language: str | None = None
    #: The restaurant's own look, so the panel's header wears its brand: the
    #: logo, or a monogram in its colour, beside its name in its menu's
    #: heading face.
    logo_url: HostedImageUrl = None
    primary_color: str | None = None
    font_family: str | None = None
    #: Where it is and what its menu is in: prices, the map's pin, and the
    #: language starting texts are offered in.
    country: str = DEFAULT_COUNTRY
    currency: str = "PLN"
    base_language: str = "pl"


class RestaurantThemeUpdate(BaseModel):
    """Body for PUT /restaurants/{id}/theme. All fields optional (partial)."""

    logo_url: str | None = None
    primary_color: str | None = None
    background_color: str | None = None
    font_family: str | None = None
    # A name, not markup: the frontend owns the artwork, so anything beyond a
    # short slug is refused rather than stored and later interpolated.
    menu_pattern: str | None = Field(default=None, pattern=r"^[a-z0-9-]{1,32}$")


class ThemeSettings(BaseModel):
    """Full theme block returned to the public client."""

    model_config = ConfigDict(from_attributes=True)

    logo_url: HostedImageUrl
    primary_color: str
    background_color: str
    font_family: str
    menu_pattern: str | None = None


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

    @field_validator("allergens")
    @classmethod
    def _allergens(cls, values: list[str]) -> list[str]:
        return _checked_labels(values, BUILT_IN_ALLERGENS)

    @field_validator("tags")
    @classmethod
    def _tags(cls, values: list[str]) -> list[str]:
        return _checked_labels(values, BUILT_IN_TAGS)


def _checked_labels(values: list[str], built_in: tuple[str, ...]) -> list[str]:
    """Built-in or the owner's own, but bounded: each a chip, a handful per dish."""
    cleaned = clean_labels(values, built_in)
    if len(cleaned) > MAX_LABELS:
        raise ValueError(f"Najwyżej {MAX_LABELS} pozycji na danie.")
    for label in cleaned:
        if len(label) > MAX_LABEL_LENGTH:
            raise ValueError(
                f"„{label[:20]}…” jest za długie — najwyżej {MAX_LABEL_LENGTH} znaków."
            )
    return cleaned


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


#: Long enough for opening hours and what a set menu consists of; short
#: enough to stay a note between sections rather than a page of its own.
MAX_NOTE_LENGTH = 1000


def _clean_note(body: str) -> str:
    """Line endings unified, trailing spaces and runs of blank lines dropped."""
    unified = body.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in unified.split("\n")]
    text = "\n".join(lines).strip()
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    if not text:
        raise ValueError("Tekst jest pusty.")
    if len(text) > MAX_NOTE_LENGTH:
        raise ValueError(
            f"Tekst jest za długi — najwyżej {MAX_NOTE_LENGTH} znaków."
        )
    return text


class NoteStyle(BaseModel):
    """How a note looks on the guest menu. Every field has a default, so a
    row stored before an option existed still reads as it always looked."""

    #: A slug naming artwork the frontend owns, like `menu_pattern`; null
    #: means no icon. An unknown slug is drawn as the default by the frontend.
    icon: str | None = Field(default="info", pattern=r"^[a-z0-9-]{1,32}$")
    #: "card": a frame in the brand's tint; "filled": the brand colour
    #: itself; "plain": the text alone, like a line of the menu.
    variant: Literal["card", "filled", "plain"] = "card"
    align: Literal["left", "center"] = "left"


class MenuNoteCreate(BaseModel):
    body: str
    #: Where it goes: the header's button puts it at the top, where hours and
    #: set-menu notes usually belong; the foot of the board at the bottom.
    at: Literal["start", "end"] = "end"
    style: NoteStyle = Field(default_factory=NoteStyle)

    @field_validator("body")
    @classmethod
    def _body(cls, value: str) -> str:
        return _clean_note(value)


class MenuNoteUpdate(BaseModel):
    body: str
    #: Absent leaves the look as it is.
    style: NoteStyle | None = None

    @field_validator("body")
    @classmethod
    def _body(cls, value: str) -> str:
        return _clean_note(value)


class MenuNoteResponse(BaseModel):
    """A note between the menu's sections. `order` shares its numbering with
    the categories' `order`, which is how a client interleaves the two."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    body: str
    order: int = Field(validation_alias="sort_order", serialization_alias="order")
    style: NoteStyle = Field(default_factory=NoteStyle)


class MenuOrderCategory(BaseModel):
    """One category's place on the board, with its dishes in display order."""

    id: uuid.UUID
    item_ids: list[uuid.UUID] = Field(default_factory=list, max_length=1000)


class MenuOrderUpdate(BaseModel):
    """Body for PUT /restaurants/{id}/menu/order: the board, top to bottom.

    Carries the whole layout rather than a single move, so a request that
    arrives late or twice still leaves the menu in the order the owner last
    saw, instead of replaying a relative move against a board that has since
    changed.
    """

    categories: list[MenuOrderCategory] = Field(max_length=200)
    #: The sections top to bottom, category and note ids interleaved; it
    #: decides the order of both. Absent from a client that predates notes —
    #: its categories then fill the category places and the notes stay put.
    layout: list[uuid.UUID] | None = Field(default=None, max_length=400)

    @model_validator(mode="after")
    def _each_id_once(self) -> "MenuOrderUpdate":
        category_ids = [category.id for category in self.categories]
        if len(set(category_ids)) != len(category_ids):
            raise ValueError("Kategoria występuje w układzie więcej niż raz.")
        if self.layout is not None and len(set(self.layout)) != len(self.layout):
            raise ValueError("Element występuje w układzie więcej niż raz.")
        item_ids = [
            item_id for category in self.categories for item_id in category.item_ids
        ]
        if len(set(item_ids)) != len(item_ids):
            raise ValueError("Danie występuje w układzie więcej niż raz.")
        return self


# --------------------------------------------------------------------------- #
# Public menu
# --------------------------------------------------------------------------- #


class PublicRestaurant(BaseModel):
    name: str
    theme: ThemeSettings
    status: RestaurantStatus
    subscription_valid_until: datetime | None
    #: The languages the guest can switch to: the menu's own first, then the
    #: ones the owner offers, in their order.
    languages: list[str] = Field(default_factory=list)
    #: What the prices are in (ISO 4217), and where the restaurant is — the
    #: prices are written the way that country writes them.
    currency: str = "PLN"
    country: str = DEFAULT_COUNTRY


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
    #: The owner's notes between the sections, placed by `order` among the
    #: categories' own.
    notes: list[MenuNoteResponse] = Field(default_factory=list)
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


class LanguageProgress(BaseModel):
    code: str
    #: Phrases of the current menu translated into `code`.
    translated: int


class MenuLanguagesResponse(BaseModel):
    """What the "Języki" screen needs in one request."""

    base_language: str
    #: Where the restaurant is: the map's pin and the recommendations.
    country: str = DEFAULT_COUNTRY
    #: Offered to guests besides the base language, in the owner's order.
    languages: list[str]
    #: The whole catalogue the owner can pick from.
    available: list[str]
    #: Distinct phrases on the menu right now — what each language needs.
    phrases_total: int
    #: One entry per catalogue language with anything translated, plus every
    #: offered language; a removed language keeps its translations, and the
    #: screen shows that it would come back ready.
    progress: list[LanguageProgress]


class MenuLanguagesUpdate(BaseModel):
    #: Bounded by the catalogue: anything longer has a duplicate or a code the
    #: handler would refuse anyway.
    languages: list[str] = Field(max_length=40)


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
    """HQ sign-in. Individual credentials, not a shared master password."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_BYTES)


class AdminProfile(BaseModel):
    """Who the bearer token belongs to, for the HQ panel to display."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    is_superadmin: bool


class AdminTokenResponse(BaseModel):
    """The HQ token plus the identity behind it.

    `is_superadmin` rides along so the sign-in screen can route on it without
    a second round trip. It is **not** a claim inside the token: the flag is
    re-read from the database on every request, so revoking someone takes
    effect immediately instead of whenever their half-day token expires.
    """

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    admin: AdminProfile


class MessageResponse(BaseModel):
    message: str


# --------------------------------------------------------------------------- #
# Landing-page contact form (public)
# --------------------------------------------------------------------------- #


class ContactRequest(BaseModel):
    """A sales inquiry from the landing page.

    Limits match the `maxlength` attributes on the form, so a person typing
    into it never meets a 422 the browser did not warn them about first. Only
    what a person must type is constrained: a lead is never refused over
    metadata such as `language`.
    """

    # Strips before validating, so a name of three spaces counts as empty.
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    restaurant: str | None = Field(None, max_length=160)
    message: str = Field(min_length=1, max_length=5000)
    language: str | None = None
    #: Honeypot. Hidden from people and assistive tech alike, so anything in
    #: it was put there by a bot filling in every field it could find.
    website: str | None = None


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


# --------------------------------------------------------------------------- #
# HQ: team management, audit log, impersonation
# --------------------------------------------------------------------------- #


class AdminListItem(BaseModel):
    """A row in the "Zespół HQ" table."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    is_superadmin: bool
    created_at: datetime


class AdminCreateRequest(BaseModel):
    """Body for POST /admin/admins. The raw password never leaves this object."""

    email: EmailStr
    password: str = _password_field("Hasło nowego administratora (min. 8 znaków).")


class AuditLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    admin_email: str
    #: A stable token such as `restaurant.impersonated`; the panel translates it.
    action: str
    target_entity: str
    created_at: datetime


class AuditLogResponse(BaseModel):
    data: list[AuditLogEntry]
    meta: PaginationMeta


class ImpersonationResponse(BaseModel):
    """A short-lived owner token, minted for support.

    Shaped like the owner login's `TokenResponse` so the panel can store it
    through the same code path, with `expires_in` carrying the much shorter
    support window rather than an owner's week.
    """

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    restaurant_id: uuid.UUID
    restaurant_name: str


# --------------------------------------------------------------------------- #
# Onboarding: activation & HQ rescue
# --------------------------------------------------------------------------- #


class ActivateRequest(BaseModel):
    """Body for POST /auth/activate — the welcome link's landing form."""

    token: str = Field(min_length=1, max_length=512)
    new_password: str = _password_field("Hasło do panelu (min. 8 znaków).")


class RestaurantUpdate(BaseModel):
    """Body for PUT /admin/restaurants/{id}. Only provided fields change.

    Exists mainly for one situation: an owner who cannot reach the inbox the
    welcome email went to. Correcting `contact_email` here and re-sending the
    link is the whole rescue.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, min_length=1, max_length=50)
    #: Unlike the fields above, an explicit null here means something: take
    #: the second language away, leaving English only.
    panel_language: str | None = None
    country: str | None = None
    #: An explicit null or empty text clears it.
    address: str | None = None
    currency: str | None = None
    base_language: str | None = None

    @field_validator("panel_language")
    @classmethod
    def _panel_language(cls, value: str | None) -> str | None:
        return _checked_panel_language(value)

    @field_validator("country")
    @classmethod
    def _country(cls, value: str | None) -> str | None:
        return None if value is None else _checked_country(value)

    @field_validator("address")
    @classmethod
    def _address(cls, value: str | None) -> str | None:
        return _checked_address(value)

    @field_validator("currency")
    @classmethod
    def _currency(cls, value: str | None) -> str | None:
        return None if value is None else _checked_currency(value)

    @field_validator("base_language")
    @classmethod
    def _base_language(cls, value: str | None) -> str | None:
        return None if value is None else _checked_menu_language(value)


class ActivationLinkResponse(BaseModel):
    """A raw activation URL, for an operator to pass on by hand.

    Returned only to an authenticated superadmin, and the act of issuing it is
    recorded in the audit log — handing out a credential that sets someone's
    password should never be the one action nothing remembers.
    """

    activation_url: str
    expires_at: datetime
    #: Whether an email was also sent. False for the copy-to-clipboard path.
    emailed: bool = False


# --------------------------------------------------------------------------- #
# Billing (Stripe)
# --------------------------------------------------------------------------- #


class CheckoutSessionResponse(BaseModel):
    """Where to send the owner to pay."""

    checkout_url: str


class WebhookAck(BaseModel):
    """What the webhook did, for Stripe's dashboard and our logs.

    Always returned with 200. The body is informational only — Stripe cares
    about the status code, and every one of these outcomes is a deliberate
    "do not retry this".
    """

    #: processed | duplicate | ignored | unmatched
    status: str
    event_type: str = ""


# --------------------------------------------------------------------------- #
# Panel languages made by DeepL (routers/panel_locales.py)
# --------------------------------------------------------------------------- #

#: One DeepL request's worth: the API takes up to 50 texts at once.
MAX_INTERFACE_BATCH = 50
#: The panel has ~700 strings; room to grow, not room to abuse.
MAX_PANEL_STRINGS = 3000
MAX_PANEL_STRING = 2000


class InterfaceTexts(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=MAX_INTERFACE_BATCH)

    @field_validator("texts")
    @classmethod
    def _bounded(cls, texts: list[str]) -> list[str]:
        if any(len(text) > MAX_PANEL_STRING for text in texts):
            raise ValueError(f"Tekst dłuższy niż {MAX_PANEL_STRING} znaków.")
        return texts


class InterfaceTranslations(BaseModel):
    translations: list[str]


class PanelLocaleUpload(BaseModel):
    """What the HQ browser made: flat keys, and the English each came from."""

    strings: dict[str, str] = Field(max_length=MAX_PANEL_STRINGS)
    sources: dict[str, str] = Field(max_length=MAX_PANEL_STRINGS)

    @model_validator(mode="after")
    def _bounded(self) -> "PanelLocaleUpload":
        for mapping in (self.strings, self.sources):
            for key, text in mapping.items():
                if len(key) > 200 or len(text) > MAX_PANEL_STRING:
                    raise ValueError(f"Tekst dłuższy niż {MAX_PANEL_STRING} znaków.")
        return self


class PanelLocaleStatus(BaseModel):
    code: str
    #: How many of the panel's strings it has.
    strings: int
    updated_at: datetime


class PanelLocaleResponse(BaseModel):
    code: str
    strings: dict[str, str]
    sources: dict[str, str]
