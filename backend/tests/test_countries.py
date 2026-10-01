"""Where a restaurant is: HQ sets the country, and the currency, the menu's
language and the "Języki" screen follow.

Through the real ASGI app, so validation, the response models and the error
handlers are exercised the way the browser meets them.
"""

import re
from pathlib import Path

import pytest
from sqlalchemy import select

from app.countries import COUNTRIES, CURRENCIES
from app.database import AsyncSessionLocal
from app.menu_languages import MENU_LANGUAGES
from app.models import AuditLog, Restaurant, RestaurantStatus
from tests.test_panel_language import admin_headers, client, create, owner_headers

FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src"


def test_the_frontend_knows_the_same_countries():
    source = (FRONTEND / "constants" / "countries.ts").read_text(encoding="utf-8")
    mirrored = {
        code: (currency, language)
        for code, currency, language in re.findall(
            r"^\s+([A-Z]{2}): \['([A-Z]{3})', '([a-z]{2})'\],$", source, re.M
        )
    }
    assert mirrored == COUNTRIES


def test_every_country_starts_somewhere_real():
    for code, (currency, language) in COUNTRIES.items():
        assert re.fullmatch(r"[A-Z]{2}", code)
        assert re.fullmatch(r"[A-Z]{3}", currency)
        assert language == "pl" or language in MENU_LANGUAGES, code
    assert "PLN" in CURRENCIES and "EUR" in CURRENCIES


@pytest.mark.asyncio
async def test_a_restaurant_from_before_is_in_poland(restaurant):
    async with client() as http:
        info = await http.get(
            f"/api/v1/restaurants/{restaurant.id}", headers=owner_headers(restaurant.id)
        )
    assert info.json()["country"] == "PL"
    assert info.json()["currency"] == "PLN"
    assert info.json()["base_language"] == "pl"


@pytest.mark.asyncio
async def test_the_country_gives_the_currency_and_the_menus_language(restaurant):
    async with client() as http:
        response = await create(
            http, restaurant, country="tr", address="  Atatürk Cd. 12,\n   Antalya "
        )
    body = response.json()
    assert response.status_code == 201
    assert body["country"] == "TR"
    assert body["currency"] == "TRY"
    assert body["base_language"] == "tr"
    # Tidied to one line: it is printed and shown, never parsed.
    assert body["address"] == "Atatürk Cd. 12, Antalya"


@pytest.mark.asyncio
async def test_hq_can_choose_both_itself(restaurant):
    # A Ukrainian owner in Turkey who prices in euro and writes in Ukrainian.
    async with client() as http:
        response = await create(
            http,
            restaurant,
            country="TR",
            currency="eur",
            base_language="uk",
            panel_language="uk",
        )
    body = response.json()
    assert (body["country"], body["currency"], body["base_language"]) == ("TR", "EUR", "uk")


@pytest.mark.parametrize(
    "field, value",
    [("country", "XX"), ("currency", "ABC"), ("base_language", "xx"), ("address", "x" * 301)],
)
@pytest.mark.asyncio
async def test_what_is_not_offered_is_refused(restaurant, field, value):
    async with client() as http:
        response = await create(http, restaurant, **{field: value})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_hq_moves_a_restaurant_and_the_audit_says_so(restaurant):
    async with client() as http:
        response = await http.put(
            f"/api/v1/admin/restaurants/{restaurant.id}",
            json={
                "country": "UA",
                "currency": "UAH",
                "base_language": "uk",
                "address": "Хрещатик 1, Київ",
            },
            headers=await admin_headers(),
        )
        cleared = await http.put(
            f"/api/v1/admin/restaurants/{restaurant.id}",
            json={"address": ""},
            headers=await admin_headers(),
        )
    assert response.status_code == 200
    assert (response.json()["country"], response.json()["currency"]) == ("UA", "UAH")
    assert response.json()["base_language"] == "uk"
    assert cleared.json()["address"] is None
    async with AsyncSessionLocal() as db:
        entries = (await db.scalars(select(AuditLog.target_entity))).all()
    assert any("country: PL → UA" in entry and "currency: PLN → UAH" in entry for entry in entries)


@pytest.mark.asyncio
async def test_the_guest_menu_and_the_languages_screen_know_where_it_is(restaurant):
    async with AsyncSessionLocal() as db:
        row = await db.get(Restaurant, restaurant.id)
        row.status = RestaurantStatus.ACTIVE
        row.country = "TR"
        row.currency = "TRY"
        row.base_language = "tr"
        row.menu_languages = ["en", "de"]
        await db.commit()
    async with client() as http:
        menu = await http.get(f"/api/v1/public/restaurants/{restaurant.id}/menu")
        languages = await http.get(
            f"/api/v1/panel/{restaurant.id}/languages", headers=owner_headers(restaurant.id)
        )
    assert menu.json()["restaurant"]["currency"] == "TRY"
    assert menu.json()["restaurant"]["country"] == "TR"
    assert menu.json()["restaurant"]["languages"] == ["tr", "en", "de"]
    assert languages.json()["country"] == "TR"
    assert languages.json()["base_language"] == "tr"
    assert "pl" not in languages.json()["languages"]
