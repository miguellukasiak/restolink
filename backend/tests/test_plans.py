"""RestoLink sells one plan: HQ picks none, and every new restaurant is on it.

Through the real ASGI app. The explicit `package_id` stays accepted — the
door left open for tiers — and is still checked.
"""

import uuid

import pytest
from sqlalchemy import func, select

from app.database import AsyncSessionLocal
from app.models import Restaurant, SubscriptionPackage
from app.plans import DEFAULT_PACKAGE_NAME
from tests.test_panel_language import admin_headers, client


def body(**fields) -> dict:
    return {
        "name": "Bar Mleczny Pod Kogutem",
        "contact_email": f"kogut-{uuid.uuid4().hex[:6]}@example.com",
        "contact_phone": "+48 600 000 000",
        **fields,
    }


async def post(http, **fields):
    return await http.post(
        "/api/v1/admin/restaurants", json=body(**fields), headers=await admin_headers()
    )


async def plans_named(name: str) -> int:
    async with AsyncSessionLocal() as db:
        return await db.scalar(
            select(func.count())
            .select_from(SubscriptionPackage)
            .where(SubscriptionPackage.name == name)
        )


@pytest.mark.asyncio
async def test_a_new_restaurant_is_on_the_one_plan_without_hq_choosing(restaurant):
    async with client() as http:
        first = await post(http)
        second = await post(http)

    assert first.status_code == 201, first.text
    assert first.json()["package"]["name"] == DEFAULT_PACKAGE_NAME
    # Made once, then reused.
    assert second.json()["package"]["id"] == first.json()["package"]["id"]
    assert await plans_named(DEFAULT_PACKAGE_NAME) == 1


@pytest.mark.asyncio
async def test_a_plan_can_still_be_given_for_when_there_are_tiers(restaurant):
    async with client() as http:
        response = await post(http, package_id=str(restaurant.package_id))

    assert response.status_code == 201
    assert response.json()["package"]["id"] == str(restaurant.package_id)
    async with AsyncSessionLocal() as db:
        made = await db.get(Restaurant, uuid.UUID(response.json()["id"]))
        assert made.package_id == restaurant.package_id


@pytest.mark.asyncio
async def test_an_unknown_plan_is_refused(restaurant):
    async with client() as http:
        response = await post(http, package_id=str(uuid.uuid4()))
    assert response.status_code == 400
    assert response.json()["detail"] == "Nie znaleziono pakietu."
