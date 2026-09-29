"""The owner panel's languages: English for everyone, one more chosen by HQ.

Through the real ASGI app, so validation, the response models and the error
handlers are exercised the way the browser meets them.
"""

import json
import re
import uuid
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import AsyncSessionLocal
from app.email_service import EMAIL_COPY, welcome_email
from app.main import app
from app.messages import localize
from app.models import AdminUser
from app.panel_language import PANEL_LANGUAGES, request_language
from app.security import (
    ADMIN_TOKEN_TTL,
    RESTAURANT_TOKEN_TTL,
    create_access_token,
    hash_password,
)

APP = Path(__file__).resolve().parents[1] / "app"
FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src"


def client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def owner_headers(restaurant_id, language: str | None = None) -> dict[str, str]:
    token, _ = create_access_token(
        subject=str(restaurant_id), role="restaurant", expires_in=RESTAURANT_TOKEN_TTL
    )
    headers = {"Authorization": f"Bearer {token}"}
    if language:
        headers["Accept-Language"] = language
    return headers


async def admin_headers() -> dict[str, str]:
    admin_id = uuid.uuid4()
    async with AsyncSessionLocal() as db:
        db.add(
            AdminUser(
                id=admin_id,
                email=f"hq-{admin_id.hex[:6]}@restolink.test",
                hashed_password=hash_password("haslo-testowe-123"),
                is_superadmin=True,
            )
        )
        await db.commit()
    token, _ = create_access_token(
        subject=str(admin_id), role="admin", expires_in=ADMIN_TOKEN_TTL
    )
    return {"Authorization": f"Bearer {token}", "Accept-Language": "pl"}


async def create(http: AsyncClient, restaurant, **fields):
    body = {
        "name": "Hospoda U Karla",
        "contact_email": f"karel-{uuid.uuid4().hex[:6]}@example.com",
        "contact_phone": "+420 600 000 000",
        "package_id": str(restaurant.package_id),
        **fields,
    }
    return await http.post("/api/v1/admin/restaurants", json=body, headers=await admin_headers())


# --------------------------------------------------------------------------- #
# HQ sets it
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_hq_gives_a_restaurant_a_second_language(restaurant):
    async with client() as http:
        response = await create(http, restaurant, panel_language="pl")
    assert response.status_code == 201 or response.status_code == 200
    assert response.json()["panel_language"] == "pl"


@pytest.mark.asyncio
async def test_without_one_the_panel_is_english_only(restaurant):
    async with client() as http:
        response = await create(http, restaurant)
    assert response.json()["panel_language"] is None


@pytest.mark.parametrize("code", ["xx", "de", "PL "])
@pytest.mark.asyncio
async def test_a_language_without_a_translated_panel_is_refused(restaurant, code):
    async with client() as http:
        response = await create(http, restaurant, panel_language=code)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_hq_can_change_it_and_take_it_away(restaurant):
    async with client() as http:
        created = (await create(http, restaurant, panel_language="pl")).json()
        headers = await admin_headers()
        cleared = await http.put(
            f"/api/v1/admin/restaurants/{created['id']}",
            json={"panel_language": None},
            headers=headers,
        )
        assert cleared.status_code == 200
        assert cleared.json()["panel_language"] is None
        again = await http.put(
            f"/api/v1/admin/restaurants/{created['id']}",
            json={"panel_language": "pl"},
            headers=headers,
        )
    assert again.json()["panel_language"] == "pl"


@pytest.mark.asyncio
async def test_the_panel_learns_its_languages_from_the_restaurant(restaurant):
    async with client() as http:
        response = await http.get(
            f"/api/v1/restaurants/{restaurant.id}", headers=owner_headers(restaurant.id)
        )
    assert response.status_code == 200
    assert "panel_language" in response.json()


# --------------------------------------------------------------------------- #
# Messages follow the panel
# --------------------------------------------------------------------------- #


def test_the_request_language_is_english_unless_a_panel_language_is_asked_for():
    assert request_language(None) == "en"
    assert request_language("pl") == "pl"
    assert request_language("pl-PL,pl;q=0.9,en;q=0.8") == "pl"
    assert request_language("de-DE") == "en"


@pytest.mark.asyncio
async def test_errors_are_english_by_default_and_polish_on_request(restaurant):
    other = uuid.uuid4()
    async with client() as http:
        english = await http.get(
            f"/api/v1/panel/{other}/languages", headers=owner_headers(restaurant.id)
        )
        polish = await http.get(
            f"/api/v1/panel/{other}/languages", headers=owner_headers(restaurant.id, "pl")
        )
    assert english.status_code == polish.status_code == 404
    assert english.json()["detail"] == "Restaurant not found."
    assert polish.json()["detail"] == "Nie znaleziono restauracji."


@pytest.mark.asyncio
async def test_our_validation_messages_follow_the_panel_too(restaurant):
    async with client() as http:
        response = await http.post(
            f"/api/v1/restaurants/{restaurant.id}/menu/items",
            json={
                "category_id": str(uuid.uuid4()),
                "name": "Chałka",
                "price": 1,
                "tags": [f"Tag {n}" for n in range(30)],
            },
            headers=owner_headers(restaurant.id),
        )
    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == "At most 20 per dish."


def _raised_messages() -> list[str]:
    """Every fixed message the server can put in front of a person."""
    messages: list[str] = []
    for path in [*APP.glob("routers/*.py"), APP / "dependencies.py", APP / "security.py"]:
        source = path.read_text(encoding="utf-8")
        calls = re.finditer(
            r"(?:detail=|TokenError\(|_UpstreamError\(\s*status\.\w+,\s*)\(?\s*((?:\"[^\"]*\"\s*)+)",
            source,
        )
        for match in calls:
            messages.append("".join(re.findall(r"\"([^\"]*)\"", match.group(1))))
        constants = re.finditer(
            r"^_[A-Z_]+ = \(\s*((?:\"[^\"]*\"\s*)+)\)", source, flags=re.MULTILINE
        )
        for match in constants:
            messages.append("".join(re.findall(r"\"([^\"]*)\"", match.group(1))))
    polish = re.compile(r"[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|Nie |Brak ")
    return sorted({message for message in messages if polish.search(message)})


def test_every_message_the_server_raises_has_an_english_version():
    raised = _raised_messages()
    assert len(raised) > 30  # the scan itself is working
    untranslated = [message for message in raised if localize(message, "en") == message]
    assert untranslated == []


# --------------------------------------------------------------------------- #
# Emails and the frontend follow the same list
# --------------------------------------------------------------------------- #


def test_every_panel_language_has_its_emails():
    for code in ("en", *PANEL_LANGUAGES):
        assert EMAIL_COPY[code].keys() == EMAIL_COPY["en"].keys(), code


def test_welcome_email_is_in_the_restaurants_language_and_escapes_its_name():
    polish = welcome_email("Karczma <b>", "https://x/activate?token=t&lang=pl", 7, "pl")
    english = welcome_email("Karczma", "https://x/activate?token=t&lang=en", 7, None)
    assert polish["subject"].startswith("Witamy")
    assert english["subject"].startswith("Welcome")
    assert "<b>" not in polish["html"] and "&lt;b&gt;" in polish["html"]


def test_every_panel_language_has_a_translated_panel():
    # Plural forms differ by language (English has one and other, Polish adds
    # few and many), so strings are compared by their key without the suffix.
    # The frontend's own test checks each language has the forms it needs.
    plural = re.compile(r"_(zero|one|two|few|many|other)$")

    def keys(tree, prefix=""):
        out = set()
        for key, value in tree.items():
            if isinstance(value, dict):
                out |= keys(value, f"{prefix}{key}.")
            else:
                out.add(plural.sub("", prefix + key))
        return out

    folder = FRONTEND / "i18n" / "panel"
    reference = keys(json.loads((folder / "en.json").read_text(encoding="utf-8")))
    for code in PANEL_LANGUAGES:
        translated = json.loads((folder / f"{code}.json").read_text(encoding="utf-8"))
        assert keys(translated) == reference, code
