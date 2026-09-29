"""Built-in and custom allergens and tags, from the editor to the guest.

Through the real ASGI app, so the request validation, the dictionary screen
and the public response are exercised the way the browser meets them.
"""

import re
import uuid
from decimal import Decimal
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import AsyncSessionLocal
from app.main import app
from app.menu_labels import (
    BUILT_IN_ALLERGENS,
    BUILT_IN_TAGS,
    MAX_LABEL_LENGTH,
    MAX_LABELS,
    clean_labels,
)
from app.models import MenuCategory, TranslationDictionary
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


async def category(restaurant) -> uuid.UUID:
    async with AsyncSessionLocal() as db:
        row = MenuCategory(id=uuid.uuid4(), restaurant_id=restaurant.id, name="Pieczywo")
        db.add(row)
        await db.commit()
        return row.id


async def save_dish(http: AsyncClient, restaurant, category_id, **fields):
    body = {
        "category_id": str(category_id),
        "name": "Chałka",
        "price": 12,
        "allergens": [],
        "tags": [],
        **fields,
    }
    return await http.post(
        f"/api/v1/restaurants/{restaurant.id}/menu/items",
        json=body,
        headers=owner_headers(restaurant.id),
    )


async def translate(restaurant, language: str, entries: dict[str, str]) -> None:
    async with AsyncSessionLocal() as db:
        for original, translated in entries.items():
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


# --------------------------------------------------------------------------- #
# Cleaning what the owner typed
# --------------------------------------------------------------------------- #


def test_labels_are_trimmed_deduplicated_and_snapped_to_built_ins():
    assert clean_labels(
        ["  Sezam ", "sezam", "", "gluten", "Orzeszki   ziemne", "Gluten"],
        BUILT_IN_ALLERGENS,
    ) == ["Sezam", "Gluten", "Orzeszki ziemne"]


# --------------------------------------------------------------------------- #
# Saving a dish
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_a_dish_keeps_custom_allergens_and_tags(restaurant):
    category_id = await category(restaurant)
    async with client() as http:
        response = await save_dish(
            http,
            restaurant,
            category_id,
            allergens=["Gluten", "Sezam"],
            tags=["Z pieca", "nowość"],
        )
    assert response.status_code == 200
    body = response.json()
    assert body["allergens"] == ["Gluten", "Sezam"]
    # "nowość" typed by hand is the built-in tag, not a look-alike.
    assert body["tags"] == ["Z pieca", "Nowość"]


@pytest.mark.asyncio
async def test_a_label_longer_than_a_chip_is_refused(restaurant):
    category_id = await category(restaurant)
    async with client() as http:
        response = await save_dish(
            http, restaurant, category_id, allergens=["x" * (MAX_LABEL_LENGTH + 1)]
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_too_many_labels_are_refused(restaurant):
    category_id = await category(restaurant)
    async with client() as http:
        response = await save_dish(
            http,
            restaurant,
            category_id,
            tags=[f"Tag {number}" for number in range(MAX_LABELS + 1)],
        )
    assert response.status_code == 422


# --------------------------------------------------------------------------- #
# Translating them
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_custom_labels_are_offered_for_translation_built_ins_are_not(restaurant):
    category_id = await category(restaurant)
    async with client() as http:
        await save_dish(
            http, restaurant, category_id, allergens=["Gluten", "Sezam"], tags=["Z pieca"]
        )
        response = await http.get(
            f"/api/v1/panel/{restaurant.id}/dictionary",
            params={"target_lang": "de"},
            headers=owner_headers(restaurant.id),
        )
    assert response.status_code == 200
    phrases = [entry["original_text"] for entry in response.json()["entries"]]
    assert "Sezam" in phrases and "Z pieca" in phrases
    assert "Gluten" not in phrases


@pytest.mark.asyncio
async def test_the_guest_reads_custom_labels_translated_and_built_ins_as_stored(
    restaurant,
):
    category_id = await category(restaurant)
    async with client() as http:
        await save_dish(
            http, restaurant, category_id, allergens=["Gluten", "Sezam"], tags=["Z pieca"]
        )
        # Even a dictionary entry for a built-in label must not reach it: the
        # guest interface translates those, and filters by the stored value.
        await translate(
            restaurant, "de", {"Sezam": "Sesam", "Z pieca": "Aus dem Ofen", "Gluten": "X"}
        )
        response = await http.get(
            f"/api/v1/public/restaurants/{restaurant.id}/menu", params={"lang": "de"}
        )
    dish = response.json()["categories"][0]["items"][0]
    assert dish["allergens"] == ["Gluten", "Sesam"]
    assert dish["tags"] == ["Aus dem Ofen"]


# --------------------------------------------------------------------------- #
# The built-in vocabulary agrees with the frontend's
# --------------------------------------------------------------------------- #


def _frontend_list(name: str) -> list[str]:
    source = (FRONTEND / "constants" / "menu.ts").read_text(encoding="utf-8")
    block = source.split(f"export const {name} = [", 1)[1].split("]", 1)[0]
    return re.findall(r"'([^']+)'", block)


def test_built_in_allergens_match_the_frontend():
    assert _frontend_list("ALLERGEN_OPTIONS") == list(BUILT_IN_ALLERGENS)


def test_built_in_tags_match_the_frontend():
    assert _frontend_list("TAG_OPTIONS") == list(BUILT_IN_TAGS)
