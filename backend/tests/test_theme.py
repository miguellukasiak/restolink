"""The menu theme: what the owner saves and what the guest's menu receives.

Through the real ASGI app, so the request validation and the public
response model are exercised as the browser meets them.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.security import RESTAURANT_TOKEN_TTL, create_access_token

pytestmark = pytest.mark.asyncio


def owner_headers(restaurant_id) -> dict[str, str]:
    token, _ = create_access_token(
        subject=str(restaurant_id), role="restaurant", expires_in=RESTAURANT_TOKEN_TTL
    )
    return {"Authorization": f"Bearer {token}"}


async def save_theme(client: AsyncClient, restaurant, body: dict):
    return await client.put(
        f"/api/v1/restaurants/{restaurant.id}/theme",
        json=body,
        headers=owner_headers(restaurant.id),
    )


async def public_theme(client: AsyncClient, restaurant) -> dict:
    response = await client.get(f"/api/v1/public/restaurants/{restaurant.id}/menu")
    assert response.status_code == 200
    return response.json()["restaurant"]["theme"]


async def test_a_new_menu_has_no_pattern(restaurant):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await public_theme(client, restaurant))["menu_pattern"] is None


async def test_a_saved_pattern_reaches_the_guest_menu(restaurant):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await save_theme(
            client,
            restaurant,
            {
                "primary_color": "#E4572E",
                "background_color": "#FFF6E5",
                "font_family": "Pacifico",
                "menu_pattern": "palms",
            },
        )
        assert response.status_code == 200
        theme = await public_theme(client, restaurant)

    assert theme["menu_pattern"] == "palms"
    assert theme["font_family"] == "Pacifico"
    assert theme["background_color"] == "#FFF6E5"


async def test_saving_other_fields_keeps_the_pattern(restaurant):
    """The update is partial: a colour change must not wipe the pattern."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await save_theme(client, restaurant, {"menu_pattern": "waves"})
        await save_theme(client, restaurant, {"primary_color": "#1F5FAD"})
        assert (await public_theme(client, restaurant))["menu_pattern"] == "waves"


async def test_the_pattern_can_be_cleared(restaurant):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await save_theme(client, restaurant, {"menu_pattern": "grid"})
        response = await save_theme(client, restaurant, {"menu_pattern": None})
        assert response.status_code == 200
        assert (await public_theme(client, restaurant))["menu_pattern"] is None


@pytest.mark.parametrize(
    "pattern",
    ['"/><script>alert(1)</script>', "Palms", "a" * 33, "", "palms url(x)"],
)
async def test_a_pattern_must_be_a_short_slug(restaurant, pattern):
    """The value ends up in the guest page; only a name is accepted."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await save_theme(client, restaurant, {"menu_pattern": pattern})
        assert response.status_code == 422
        assert (await public_theme(client, restaurant))["menu_pattern"] is None


async def test_the_panel_header_wears_the_restaurants_look(restaurant):
    """The owner panel shows the logo, or a monogram in the brand colour,
    beside the name in the menu's heading face — read with the header info."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await save_theme(
            client,
            restaurant,
            {"primary_color": "#E4572E", "font_family": "Pacifico"},
        )
        response = await client.get(
            f"/api/v1/restaurants/{restaurant.id}", headers=owner_headers(restaurant.id)
        )

    assert response.status_code == 200
    info = response.json()
    assert info["primary_color"] == "#E4572E"
    assert info["font_family"] == "Pacifico"
    assert info["logo_url"] is None
