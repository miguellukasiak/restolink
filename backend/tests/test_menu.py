"""The owner's menu board: saving the order of a drag, and who may move a dish.

Every test goes through the real ASGI app with a real owner token, so the
router-level access check and the response models are exercised as the
browser meets them, not bypassed by calling the handlers directly.
"""

import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.main import app
from app.models import MenuCategory, MenuItem, Restaurant, RestaurantStatus
from app.security import RESTAURANT_TOKEN_TTL, create_access_token

pytestmark = pytest.mark.asyncio


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def owner_headers(restaurant_id: uuid.UUID) -> dict[str, str]:
    token, _ = create_access_token(
        subject=str(restaurant_id), role="restaurant", expires_in=RESTAURANT_TOKEN_TTL
    )
    return {"Authorization": f"Bearer {token}"}


async def seed_menu(
    restaurant_id: uuid.UUID, layout: dict[str, list[str]]
) -> dict[str, uuid.UUID]:
    """Create categories and dishes in the given order; returns name -> id."""
    ids: dict[str, uuid.UUID] = {}
    async with AsyncSessionLocal() as db:
        for category_position, (category_name, dishes) in enumerate(
            layout.items(), start=1
        ):
            category = MenuCategory(
                id=uuid.uuid4(),
                restaurant_id=restaurant_id,
                name=category_name,
                sort_order=category_position,
            )
            db.add(category)
            ids[category_name] = category.id
            for dish_position, dish_name in enumerate(dishes, start=1):
                dish = MenuItem(
                    id=uuid.uuid4(),
                    category_id=category.id,
                    name=dish_name,
                    price=Decimal("10.00"),
                    sort_order=dish_position,
                )
                db.add(dish)
                ids[dish_name] = dish.id
        await db.commit()
    return ids


async def board(client: AsyncClient, restaurant_id: uuid.UUID) -> dict[str, list[str]]:
    """The menu as the panel reads it: category name -> dish names, in order."""
    response = await client.get(
        f"/api/v1/restaurants/{restaurant_id}/menu/categories",
        headers=owner_headers(restaurant_id),
    )
    assert response.status_code == 200
    return {
        category["name"]: [item["name"] for item in category["items"]]
        for category in response.json()
    }


async def put_order(
    client: AsyncClient, restaurant_id: uuid.UUID, categories: list[dict]
):
    return await client.put(
        f"/api/v1/restaurants/{restaurant_id}/menu/order",
        json={"categories": categories},
        headers=owner_headers(restaurant_id),
    )


def entry(category_id: uuid.UUID, *item_ids: uuid.UUID) -> dict:
    return {"id": str(category_id), "item_ids": [str(item_id) for item_id in item_ids]}


@pytest_asyncio.fixture
async def other_restaurant(restaurant) -> Restaurant:
    """A second tenant, sharing the first one's package."""
    other_id = uuid.uuid4()
    async with AsyncSessionLocal() as db:
        db.add(
            Restaurant(
                id=other_id,
                name="Bistro Obok",
                contact_email="obok@bistro.pl",
                contact_phone="+48 500 300 400",
                package_id=restaurant.package_id,
                status=RestaurantStatus.ACTIVE,
            )
        )
        await db.commit()
    async with AsyncSessionLocal() as db:
        return await db.get(Restaurant, other_id)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# --------------------------------------------------------------------------- #
# PUT /menu/order
# --------------------------------------------------------------------------- #


async def test_reorder_persists_categories_and_dishes(restaurant, client):
    ids = await seed_menu(
        restaurant.id,
        {"Przystawki": ["Bruschetta", "Carpaccio"], "Zupy": ["Żurek", "Rosół"]},
    )

    response = await put_order(
        client,
        restaurant.id,
        [
            entry(ids["Zupy"], ids["Rosół"], ids["Żurek"]),
            entry(ids["Przystawki"], ids["Carpaccio"], ids["Bruschetta"]),
        ],
    )

    assert response.status_code == 204
    assert await board(client, restaurant.id) == {
        "Zupy": ["Rosół", "Żurek"],
        "Przystawki": ["Carpaccio", "Bruschetta"],
    }
    # Dict equality ignores order, so check the category order explicitly.
    assert list(await board(client, restaurant.id)) == ["Zupy", "Przystawki"]


async def test_reorder_moves_a_dish_between_categories(restaurant, client):
    ids = await seed_menu(
        restaurant.id, {"Przystawki": ["Bruschetta", "Żurek"], "Zupy": ["Rosół"]}
    )

    response = await put_order(
        client,
        restaurant.id,
        [
            entry(ids["Przystawki"], ids["Bruschetta"]),
            entry(ids["Zupy"], ids["Żurek"], ids["Rosół"]),
        ],
    )

    assert response.status_code == 204
    assert await board(client, restaurant.id) == {
        "Przystawki": ["Bruschetta"],
        "Zupy": ["Żurek", "Rosół"],
    }


async def test_reorder_keeps_rows_the_body_left_out(restaurant, client):
    """A dish added from another tab mid-drag is neither lost nor fatal."""
    ids = await seed_menu(
        restaurant.id,
        {"Przystawki": ["Bruschetta", "Carpaccio", "Tatar"], "Zupy": ["Rosół"]},
    )

    response = await put_order(
        client, restaurant.id, [entry(ids["Przystawki"], ids["Carpaccio"])]
    )

    assert response.status_code == 204
    menu = await board(client, restaurant.id)
    assert list(menu) == ["Przystawki", "Zupy"]
    assert menu["Przystawki"] == ["Carpaccio", "Bruschetta", "Tatar"]
    assert menu["Zupy"] == ["Rosół"]


async def test_reorder_refuses_another_restaurants_dish(
    restaurant, other_restaurant, client
):
    ours = await seed_menu(restaurant.id, {"Przystawki": ["Bruschetta"]})
    theirs = await seed_menu(other_restaurant.id, {"Desery": ["Sernik"]})

    response = await put_order(
        client,
        restaurant.id,
        [entry(ours["Przystawki"], ours["Bruschetta"], theirs["Sernik"])],
    )

    assert response.status_code == 404
    async with AsyncSessionLocal() as db:
        sernik = await db.get(MenuItem, theirs["Sernik"])
        assert sernik.category_id == theirs["Desery"]


async def test_reorder_refuses_another_restaurants_category(
    restaurant, other_restaurant, client
):
    ours = await seed_menu(restaurant.id, {"Przystawki": ["Bruschetta"]})
    theirs = await seed_menu(other_restaurant.id, {"Desery": ["Sernik"]})

    response = await put_order(
        client,
        restaurant.id,
        [entry(ours["Przystawki"]), entry(theirs["Desery"], ours["Bruschetta"])],
    )

    assert response.status_code == 404
    assert await board(client, restaurant.id) == {"Przystawki": ["Bruschetta"]}


async def test_reorder_refuses_a_deleted_dish(restaurant, client):
    ids = await seed_menu(restaurant.id, {"Przystawki": ["Bruschetta", "Tatar"]})
    delete = await client.delete(
        f"/api/v1/restaurants/{restaurant.id}/menu/items/{ids['Tatar']}",
        headers=owner_headers(restaurant.id),
    )
    assert delete.status_code == 204

    response = await put_order(
        client, restaurant.id, [entry(ids["Przystawki"], ids["Tatar"], ids["Bruschetta"])]
    )

    assert response.status_code == 404


async def test_reorder_rejects_a_dish_listed_twice(restaurant, client):
    ids = await seed_menu(restaurant.id, {"Przystawki": ["Bruschetta"], "Zupy": []})

    response = await put_order(
        client,
        restaurant.id,
        [
            entry(ids["Przystawki"], ids["Bruschetta"]),
            entry(ids["Zupy"], ids["Bruschetta"]),
        ],
    )

    assert response.status_code == 422


async def test_reorder_is_scoped_to_the_token(restaurant, other_restaurant, client):
    """Another owner's token cannot address this restaurant's board at all."""
    ids = await seed_menu(restaurant.id, {"Przystawki": ["Bruschetta"]})

    response = await client.put(
        f"/api/v1/restaurants/{restaurant.id}/menu/order",
        json={"categories": [entry(ids["Przystawki"], ids["Bruschetta"])]},
        headers=owner_headers(other_restaurant.id),
    )

    assert response.status_code == 404


# --------------------------------------------------------------------------- #
# POST /menu/items — the upsert
# --------------------------------------------------------------------------- #


def dish_body(category_id: uuid.UUID, name: str, **extra) -> dict:
    return {"category_id": str(category_id), "name": name, "price": 24.9, **extra}


async def test_upsert_refuses_another_restaurants_dish(
    restaurant, other_restaurant, client
):
    """Dish ids are public; naming one must not pull it into your menu."""
    ours = await seed_menu(restaurant.id, {"Przystawki": []})
    theirs = await seed_menu(other_restaurant.id, {"Desery": ["Sernik"]})

    response = await client.post(
        f"/api/v1/restaurants/{restaurant.id}/menu/items",
        json=dish_body(ours["Przystawki"], "Przejęty sernik", id=str(theirs["Sernik"])),
        headers=owner_headers(restaurant.id),
    )

    assert response.status_code == 404
    async with AsyncSessionLocal() as db:
        sernik = await db.get(MenuItem, theirs["Sernik"])
        assert sernik.name == "Sernik"
        assert sernik.category_id == theirs["Desery"]


async def test_upsert_moving_a_dish_puts_it_last_in_its_new_category(
    restaurant, client
):
    ids = await seed_menu(
        restaurant.id, {"Przystawki": ["Żurek", "Tatar"], "Zupy": ["Rosół", "Barszcz"]}
    )

    response = await client.post(
        f"/api/v1/restaurants/{restaurant.id}/menu/items",
        json=dish_body(ids["Zupy"], "Żurek", id=str(ids["Żurek"])),
        headers=owner_headers(restaurant.id),
    )

    assert response.status_code == 200
    assert response.json()["category_id"] == str(ids["Zupy"])
    assert await board(client, restaurant.id) == {
        "Przystawki": ["Tatar"],
        "Zupy": ["Rosół", "Barszcz", "Żurek"],
    }


async def test_upsert_edit_in_place_keeps_the_position(restaurant, client):
    ids = await seed_menu(restaurant.id, {"Zupy": ["Rosół", "Żurek", "Barszcz"]})

    response = await client.post(
        f"/api/v1/restaurants/{restaurant.id}/menu/items",
        json=dish_body(ids["Zupy"], "Żurek staropolski", id=str(ids["Żurek"])),
        headers=owner_headers(restaurant.id),
    )

    assert response.status_code == 200
    assert await board(client, restaurant.id) == {
        "Zupy": ["Rosół", "Żurek staropolski", "Barszcz"]
    }


async def test_upsert_creates_a_dish_at_the_end(restaurant, client):
    ids = await seed_menu(restaurant.id, {"Zupy": ["Rosół"]})

    response = await client.post(
        f"/api/v1/restaurants/{restaurant.id}/menu/items",
        json=dish_body(ids["Zupy"], "Pomidorowa", allergens=["Seler"], tags=["Nowość"]),
        headers=owner_headers(restaurant.id),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Pomidorowa"
    assert body["allergens"] == ["Seler"]
    assert await board(client, restaurant.id) == {"Zupy": ["Rosół", "Pomidorowa"]}
    async with AsyncSessionLocal() as db:
        created = await db.scalar(select(MenuItem).where(MenuItem.name == "Pomidorowa"))
        assert created is not None and created.sort_order == 2
