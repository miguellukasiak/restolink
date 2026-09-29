"""Which languages a menu offers, and what the "Języki" screen is told.

Through the real ASGI app, so validation and the response models are
exercised the way the browser meets them.
"""

import json
import re
import uuid
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update

from app.database import AsyncSessionLocal
from app.main import app
from app.menu_languages import (
    DEFAULT_MENU_LANGUAGES,
    LEGACY_MENU_LANGUAGES,
    MENU_LANGUAGES,
    offered_languages,
)
from app.models import MenuCategory, MenuItem, Restaurant, TranslationDictionary
from app.routers.dictionary import _DEEPL_TARGET
from app.security import RESTAURANT_TOKEN_TTL, create_access_token
from app.translation_service import source_hash

FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src"


def owner_headers(restaurant_id) -> dict[str, str]:
    token, _ = create_access_token(
        subject=str(restaurant_id), role="restaurant", expires_in=RESTAURANT_TOKEN_TTL
    )
    return {"Authorization": f"Bearer {token}"}


def client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def put_languages(http: AsyncClient, restaurant, languages):
    return await http.put(
        f"/api/v1/panel/{restaurant.id}/languages",
        json={"languages": languages},
        headers=owner_headers(restaurant.id),
    )


async def get_languages(http: AsyncClient, restaurant) -> dict:
    response = await http.get(
        f"/api/v1/panel/{restaurant.id}/languages", headers=owner_headers(restaurant.id)
    )
    assert response.status_code == 200
    return response.json()


async def guest_languages(http: AsyncClient, restaurant) -> list[str]:
    response = await http.get(f"/api/v1/public/restaurants/{restaurant.id}/menu")
    assert response.status_code == 200
    return response.json()["restaurant"]["languages"]


async def set_stored(restaurant, value) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Restaurant)
            .where(Restaurant.id == restaurant.id)
            .values(menu_languages=value)
        )
        await db.commit()


# --------------------------------------------------------------------------- #
# Defaults
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_a_new_restaurant_offers_english(restaurant):
    assert restaurant.menu_languages == list(DEFAULT_MENU_LANGUAGES)
    async with client() as http:
        assert await guest_languages(http, restaurant) == ["pl", "en"]


@pytest.mark.asyncio
async def test_a_restaurant_from_before_keeps_its_four_languages(restaurant):
    """NULL is what migration 011 leaves on every existing row."""
    await set_stored(restaurant, None)
    async with client() as http:
        assert await guest_languages(http, restaurant) == ["pl", *LEGACY_MENU_LANGUAGES]
        body = await get_languages(http, restaurant)
    assert body["languages"] == list(LEGACY_MENU_LANGUAGES)


def test_offered_languages_drops_what_a_guest_must_not_see():
    stored = ["de", "xx", "pl", "de", "zh"]
    assert offered_languages(stored, "pl") == ["de", "zh"]
    assert offered_languages(None, "de") == ["en", "fr", "es"]


# --------------------------------------------------------------------------- #
# Choosing languages
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_the_owner_chooses_languages_and_guests_see_them_in_order(restaurant):
    async with client() as http:
        response = await put_languages(http, restaurant, ["uk", "en", "zh", "de"])
        assert response.status_code == 200
        assert response.json()["languages"] == ["uk", "en", "zh", "de"]
        assert await guest_languages(http, restaurant) == ["pl", "uk", "en", "zh", "de"]


@pytest.mark.asyncio
async def test_repeats_and_the_base_language_are_dropped_quietly(restaurant):
    async with client() as http:
        response = await put_languages(http, restaurant, ["EN", "pl", "en", " de "])
    assert response.status_code == 200
    assert response.json()["languages"] == ["en", "de"]


@pytest.mark.asyncio
async def test_all_languages_can_be_removed(restaurant):
    async with client() as http:
        response = await put_languages(http, restaurant, [])
        assert response.status_code == 200
        assert await guest_languages(http, restaurant) == ["pl"]


@pytest.mark.parametrize("code", ["xx", "klingon", "", "pl-PL"])
@pytest.mark.asyncio
async def test_an_unknown_language_is_refused_and_nothing_changes(restaurant, code):
    async with client() as http:
        response = await put_languages(http, restaurant, ["de", code])
        assert response.status_code == 400
        assert await guest_languages(http, restaurant) == ["pl", "en"]


@pytest.mark.asyncio
async def test_another_restaurants_languages_are_out_of_reach(restaurant):
    """The token names one restaurant; the path another — 404, not 403."""
    other = uuid.uuid4()
    async with client() as http:
        response = await http.put(
            f"/api/v1/panel/{other}/languages",
            json={"languages": ["de"]},
            headers=owner_headers(restaurant.id),
        )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_languages_need_a_signed_in_owner(restaurant):
    async with client() as http:
        response = await http.get(f"/api/v1/panel/{restaurant.id}/languages")
    assert response.status_code == 401


# --------------------------------------------------------------------------- #
# Progress
# --------------------------------------------------------------------------- #


async def add_menu(restaurant) -> None:
    async with AsyncSessionLocal() as db:
        category = MenuCategory(restaurant_id=restaurant.id, name="Zupy", sort_order=0)
        db.add(category)
        await db.flush()
        db.add(
            MenuItem(
                category_id=category.id,
                name="Żurek",
                description="Na zakwasie",
                price=22,
                sort_order=0,
            )
        )
        for language, original, translated in [
            ("de", "Zupy", "Suppen"),
            ("de", "Żurek", "Saure Mehlsuppe"),
            ("zh", "Zupy", "汤"),
            # No longer on the menu: must not count.
            ("de", "Barszcz", "Rote-Bete-Suppe"),
            # Cleared in the panel: must not count either.
            ("fr", "Zupy", "   "),
        ]:
            db.add(
                TranslationDictionary(
                    restaurant_id=restaurant.id,
                    source_hash=source_hash(original),
                    original_text=original,
                    target_lang=language,
                    translated_text=translated,
                )
            )
        await db.commit()


@pytest.mark.asyncio
async def test_progress_counts_only_the_current_menu(restaurant):
    await add_menu(restaurant)
    async with client() as http:
        body = await get_languages(http, restaurant)

    assert body["phrases_total"] == 3  # Zupy, Żurek, Na zakwasie
    progress = {entry["code"]: entry["translated"] for entry in body["progress"]}
    # English is offered (0 so far); German and Chinese have work in them even
    # though they are not offered, so the screen can say they come back ready.
    assert progress == {"en": 0, "de": 2, "zh": 1}


# --------------------------------------------------------------------------- #
# The catalogue agrees with everything that depends on it
# --------------------------------------------------------------------------- #


def test_every_catalogue_language_has_a_deepl_target():
    import deepl

    known = {
        value.lower()
        for name, value in vars(deepl.Language).items()
        if name.isupper() and isinstance(value, str)
    }
    missing = [code for code in MENU_LANGUAGES if _DEEPL_TARGET[code].lower() not in known]
    assert missing == []


def test_every_catalogue_language_has_a_guest_interface():
    locales = FRONTEND / "i18n" / "locales"
    reference = json.loads((locales / "en.json").read_text(encoding="utf-8"))
    for code in MENU_LANGUAGES:
        path = locales / f"{code}.json"
        assert path.exists(), f"no guest locale for {code}"
        keys = json.loads(path.read_text(encoding="utf-8")).keys()
        assert keys == reference.keys(), f"{code}.json keys differ from en.json"


def test_the_frontend_catalogue_lists_the_same_languages():
    source = (FRONTEND / "constants" / "menuLanguages.ts").read_text(encoding="utf-8")
    # Only the catalogue array — BASE_LANGUAGE below it is not a choice.
    catalogue = source.split("export const MENU_LANGUAGES", 1)[1].split("];", 1)[0]
    listed = re.findall(r"code: '([a-z]{2})'", catalogue)
    assert listed == list(MENU_LANGUAGES)
