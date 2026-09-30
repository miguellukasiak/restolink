"""Notes: the owner's own text between the menu's sections.

A note shares its numbering with the categories, so these tests read the menu
back the way a guest gets it — sections top to bottom — and check that every
path that places a section (adding one, dragging, an old client's drag) keeps
the notes where the owner put them.
"""

import uuid

import pytest
from httpx import AsyncClient

from app.database import AsyncSessionLocal
from app.models import MenuNote
from tests.test_menu import (  # noqa: F401 — fixtures are used by name
    client,
    entry,
    other_restaurant,
    owner_headers,
    put_order,
    seed_menu,
)

pytestmark = pytest.mark.asyncio

LUNCH = (
    "Menu obiadowe podawane jest od poniedziałku do piątku w godzinach 12:00 – 16:00.\n"
    "\n"
    "Na menu obiadowe składa się zupa + (danie dnia lub Smażony Hermelin)."
)


def notes_url(restaurant_id: uuid.UUID, note_id: str | uuid.UUID | None = None) -> str:
    base = f"/api/v1/restaurants/{restaurant_id}/menu/notes"
    return base if note_id is None else f"{base}/{note_id}"


async def add_note(
    client: AsyncClient, restaurant_id: uuid.UUID, body: str, at: str = "end"
) -> dict:
    response = await client.post(
        notes_url(restaurant_id),
        json={"body": body, "at": at},
        headers=owner_headers(restaurant_id),
    )
    assert response.status_code == 201, response.text
    return response.json()


async def sections(
    client: AsyncClient, restaurant_id: uuid.UUID, lang: str = ""
) -> list[str]:
    """The guest menu top to bottom: category names and note texts, merged by
    `order` exactly as the frontend merges them (a category first on a tie)."""
    query = f"?lang={lang}" if lang else ""
    response = await client.get(
        f"/api/v1/public/restaurants/{restaurant_id}/menu{query}"
    )
    assert response.status_code == 200
    menu = response.json()
    blocks = [(c["order"], 0, c["name"]) for c in menu["categories"]]
    blocks += [(n["order"], 1, n["body"]) for n in menu["notes"]]
    return [text for _, _, text in sorted(blocks, key=lambda block: block[:2])]


async def test_a_note_goes_to_the_top_or_the_bottom(restaurant, client):
    await seed_menu(restaurant.id, {"Zupy": ["Rosół"], "Desery": ["Sernik"]})

    await add_note(client, restaurant.id, "Na górze", at="start")
    await add_note(client, restaurant.id, "Na dole")

    assert await sections(client, restaurant.id) == [
        "Na górze",
        "Zupy",
        "Desery",
        "Na dole",
    ]


async def test_a_new_category_goes_below_a_note_at_the_end(restaurant, client):
    await seed_menu(restaurant.id, {"Zupy": []})
    await add_note(client, restaurant.id, "Ceny zawierają VAT.")

    response = await client.post(
        f"/api/v1/restaurants/{restaurant.id}/menu/categories",
        json={"name": "Desery"},
        headers=owner_headers(restaurant.id),
    )

    assert response.status_code == 201
    assert await sections(client, restaurant.id) == [
        "Zupy",
        "Ceny zawierają VAT.",
        "Desery",
    ]


async def test_the_layout_places_notes_between_categories(restaurant, client):
    ids = await seed_menu(restaurant.id, {"Zupy": ["Rosół"], "Obiady": ["Schabowy"]})
    note = await add_note(client, restaurant.id, LUNCH)

    response = await client.put(
        f"/api/v1/restaurants/{restaurant.id}/menu/order",
        json={
            "categories": [
                entry(ids["Zupy"], ids["Rosół"]),
                entry(ids["Obiady"], ids["Schabowy"]),
            ],
            "layout": [str(ids["Zupy"]), note["id"], str(ids["Obiady"])],
        },
        headers=owner_headers(restaurant.id),
    )

    assert response.status_code == 204
    assert await sections(client, restaurant.id) == ["Zupy", LUNCH, "Obiady"]


async def test_a_drag_without_a_layout_leaves_the_notes_in_place(restaurant, client):
    """A tab opened before notes existed still sends category-only drags."""
    ids = await seed_menu(restaurant.id, {"Zupy": [], "Obiady": [], "Desery": []})
    note = await add_note(client, restaurant.id, "Po zupach", at="end")
    await client.put(
        f"/api/v1/restaurants/{restaurant.id}/menu/order",
        json={
            "categories": [
                entry(ids["Zupy"]),
                entry(ids["Obiady"]),
                entry(ids["Desery"]),
            ],
            "layout": [
                str(ids["Zupy"]),
                note["id"],
                str(ids["Obiady"]),
                str(ids["Desery"]),
            ],
        },
        headers=owner_headers(restaurant.id),
    )

    response = await put_order(
        client,
        restaurant.id,
        [entry(ids["Desery"]), entry(ids["Zupy"]), entry(ids["Obiady"])],
    )

    assert response.status_code == 204
    # The categories swapped places; the note still holds the second slot.
    assert await sections(client, restaurant.id) == [
        "Desery",
        "Po zupach",
        "Zupy",
        "Obiady",
    ]


async def test_a_layout_that_leaves_a_note_out_keeps_it_after_the_rest(
    restaurant, client
):
    ids = await seed_menu(restaurant.id, {"Zupy": [], "Desery": []})
    await add_note(client, restaurant.id, "Dodany w innej karcie", at="start")

    response = await client.put(
        f"/api/v1/restaurants/{restaurant.id}/menu/order",
        json={
            "categories": [entry(ids["Desery"]), entry(ids["Zupy"])],
            "layout": [str(ids["Desery"]), str(ids["Zupy"])],
        },
        headers=owner_headers(restaurant.id),
    )

    assert response.status_code == 204
    assert await sections(client, restaurant.id) == [
        "Desery",
        "Zupy",
        "Dodany w innej karcie",
    ]


async def test_the_layout_refuses_another_restaurants_note(
    restaurant, other_restaurant, client
):
    ids = await seed_menu(restaurant.id, {"Zupy": []})
    theirs = await add_note(client, other_restaurant.id, "Nie wasze")

    response = await client.put(
        f"/api/v1/restaurants/{restaurant.id}/menu/order",
        json={
            "categories": [entry(ids["Zupy"])],
            "layout": [theirs["id"], str(ids["Zupy"])],
        },
        headers=owner_headers(restaurant.id),
    )

    assert response.status_code == 404
    assert await sections(client, other_restaurant.id) == ["Nie wasze"]


async def test_the_layout_rejects_an_id_listed_twice(restaurant, client):
    ids = await seed_menu(restaurant.id, {"Zupy": []})

    response = await client.put(
        f"/api/v1/restaurants/{restaurant.id}/menu/order",
        json={"categories": [entry(ids["Zupy"])], "layout": [str(ids["Zupy"])] * 2},
        headers=owner_headers(restaurant.id),
    )

    assert response.status_code == 422


async def test_the_text_is_tidied_and_bounded(restaurant, client):
    created = await add_note(
        client, restaurant.id, "  Pierwsza linia   \r\n\r\n\r\n\r\nDruga  "
    )
    assert created["body"] == "Pierwsza linia\n\nDruga"

    for body in ["   \n  ", "x" * 1001]:
        response = await client.post(
            notes_url(restaurant.id),
            json={"body": body},
            headers=owner_headers(restaurant.id),
        )
        assert response.status_code == 422


async def test_editing_and_deleting_a_note(restaurant, client):
    await seed_menu(restaurant.id, {"Zupy": []})
    note = await add_note(client, restaurant.id, "Stara treść", at="start")

    edited = await client.patch(
        notes_url(restaurant.id, note["id"]),
        json={"body": "Nowa treść"},
        headers=owner_headers(restaurant.id),
    )
    assert edited.status_code == 200
    assert edited.json() == {**note, "body": "Nowa treść"}
    assert await sections(client, restaurant.id) == ["Nowa treść", "Zupy"]

    deleted = await client.delete(
        notes_url(restaurant.id, note["id"]), headers=owner_headers(restaurant.id)
    )
    assert deleted.status_code == 204
    assert await sections(client, restaurant.id) == ["Zupy"]
    listed = await client.get(
        notes_url(restaurant.id), headers=owner_headers(restaurant.id)
    )
    assert listed.json() == []
    # Soft-deleted, like the rest of the menu.
    async with AsyncSessionLocal() as db:
        row = await db.get(MenuNote, uuid.UUID(note["id"]))
        assert row is not None and row.deleted_at is not None


async def test_another_restaurants_note_cannot_be_touched(
    restaurant, other_restaurant, client
):
    theirs = await add_note(client, other_restaurant.id, "Nie wasze")

    for method, body in [("PATCH", {"body": "Przejęte"}), ("DELETE", None)]:
        response = await client.request(
            method,
            notes_url(restaurant.id, theirs["id"]),
            json=body,
            headers=owner_headers(restaurant.id),
        )
        assert response.status_code == 404

    assert await sections(client, other_restaurant.id) == ["Nie wasze"]


async def test_notes_are_translated_with_the_menu(restaurant, client):
    await seed_menu(restaurant.id, {"Zupy": ["Rosół"]})
    await add_note(client, restaurant.id, LUNCH, at="start")
    headers = owner_headers(restaurant.id)

    dictionary = await client.get(
        f"/api/v1/panel/{restaurant.id}/dictionary?target_lang=en", headers=headers
    )
    phrases = [entry["original_text"] for entry in dictionary.json()["entries"]]
    # Listed where it sits on the menu: above the first category.
    assert phrases[:2] == [LUNCH, "Zupy"]

    english = "Lunch is served Monday to Friday, 12:00 – 16:00."
    saved = await client.put(
        f"/api/v1/panel/{restaurant.id}/dictionary",
        json={
            "target_lang": "en",
            "entries": [{"original_text": LUNCH, "translated_text": english}],
        },
        headers=headers,
    )
    assert saved.status_code == 200

    assert (await sections(client, restaurant.id, lang="en"))[0] == english
    assert (await sections(client, restaurant.id))[0] == LUNCH
