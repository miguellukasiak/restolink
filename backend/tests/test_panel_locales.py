"""A panel language made by DeepL: HQ picks it, the panel, its emails and the
server's messages follow.

DeepL itself is replaced by a stand-in that marks each text and keeps its
placeholders, so the tests can see exactly what was sent and what came back.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app import panel_texts
from app.deepl_client import protect, restore
from app.email_service import EMAIL_COPY, welcome_email
from app.main import app
from app.messages import ENGLISH, localize
from app.routers import panel_locales
from tests.test_panel_language import admin_headers, create, owner_headers

pytestmark = pytest.mark.asyncio


@pytest.fixture
def deepl(monkeypatch) -> list[list[str]]:
    """Every batch sent to "DeepL"; each text comes back as "[uk] …"."""
    monkeypatch.setenv("DEEPL_API_KEY", "test-key")
    calls: list[list[str]] = []

    def fake(texts: list[str], target_lang: str, auth_key: str) -> list[str]:
        calls.append(list(texts))
        return [f"[{target_lang.lower()}] {text}" for text in texts]

    monkeypatch.setattr(panel_locales, "translate_interface", fake)
    return calls


@pytest.fixture(autouse=True)
def forget_languages():
    yield
    panel_texts._MESSAGES.clear()
    panel_texts._EMAILS.clear()


def client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_placeholders_survive_the_trip():
    text = "Delete “{{name}}”? {0} & <more>"
    fenced = protect(text)
    assert "<x>{{name}}</x>" in fenced and "<x>{0}</x>" in fenced
    assert "&lt;more&gt;" in fenced
    assert restore(fenced) == text


async def test_hq_translates_a_batch_and_saves_the_language(restaurant, deepl):
    headers = await admin_headers()
    async with client() as http:
        batch = await http.post(
            "/api/v1/admin/panel-locales/uk/translate",
            json={"texts": ["Menu builder", "{{count}} dishes"]},
            headers=headers,
        )
        assert batch.status_code == 200
        assert batch.json()["translations"] == [
            "[uk] Menu builder",
            "[uk] {{count}} dishes",
        ]

        saved = await http.put(
            "/api/v1/admin/panel-locales/uk",
            json={
                "strings": {"nav.builder": "Конструктор меню"},
                "sources": {"nav.builder": "Menu builder"},
            },
            headers=headers,
        )
        assert saved.status_code == 200
        assert saved.json()["strings"] == 1

        public = await http.get("/api/v1/public/panel-locales/uk")
        listed = await http.get("/api/v1/admin/panel-locales", headers=headers)

    assert public.json()["strings"] == {"nav.builder": "Конструктор меню"}
    assert public.json()["sources"] == {"nav.builder": "Menu builder"}
    assert [row["code"] for row in listed.json()] == ["uk"]
    # Saving also made the server's side: every message and email line.
    sent = [text for call in deepl[1:] for text in call]
    assert set(ENGLISH.values()) <= set(sent)
    assert set(EMAIL_COPY["en"].values()) <= set(sent)


async def test_the_server_speaks_the_new_language_and_never_polish(restaurant, deepl):
    other = "00000000-0000-0000-0000-000000000000"
    async with client() as http:
        # Before Ukrainian exists, an owner asking for it reads English.
        before = await http.get(
            f"/api/v1/panel/{other}/languages",
            headers=owner_headers(restaurant.id, "uk"),
        )
        await http.put(
            "/api/v1/admin/panel-locales/uk",
            json={"strings": {}, "sources": {}},
            headers=await admin_headers(),
        )
        after = await http.get(
            f"/api/v1/panel/{other}/languages",
            headers=owner_headers(restaurant.id, "uk"),
        )

    assert before.json()["detail"] == "Restaurant not found."
    assert after.json()["detail"] == "[uk] Restaurant not found."
    # Patterns keep their fields.
    assert (
        localize("Najwyżej 20 pozycji na danie.", "uk") == "[uk] At most 20 per dish."
    )
    # A language never saved falls back to English, not to Polish.
    assert localize("Nie znaleziono dania.", "tr") == "Dish not found."


async def test_a_second_save_translates_only_what_is_new(restaurant, deepl):
    headers = await admin_headers()
    async with client() as http:
        for _ in range(2):
            await http.put(
                "/api/v1/admin/panel-locales/uk",
                json={"strings": {}, "sources": {}},
                headers=headers,
            )
    assert len(deepl) >= 1
    total = sum(len(call) for call in deepl)
    assert total == len(ENGLISH) + len(panel_locales.message_sources()[1]) + len(
        EMAIL_COPY["en"]
    )


async def test_the_owners_email_is_written_in_it(restaurant, deepl):
    async with client() as http:
        await http.put(
            "/api/v1/admin/panel-locales/uk",
            json={"strings": {}, "sources": {}},
            headers=await admin_headers(),
        )
    email = welcome_email("Borscht Bar", "https://x/activate?token=t&lang=uk", 7, "uk")
    assert email["subject"] == "[uk] " + EMAIL_COPY["en"]["welcome_subject"]
    assert "[uk] Welcome to RestoLink, Borscht Bar!" in email["html"]


async def test_a_field_lost_in_translation_falls_back_to_english(restaurant):
    panel_texts.remember("uk", {}, {"welcome_greeting": "Вітаємо, {ім'я}!"})
    email = welcome_email("Borscht Bar", "https://x", 7, "uk")
    assert "Welcome to RestoLink, Borscht Bar!" in email["html"]


async def test_only_hq_spends_the_quota(restaurant, deepl):
    async with client() as http:
        anonymous = await http.post(
            "/api/v1/admin/panel-locales/uk/translate", json={"texts": ["Hi"]}
        )
        owner = await http.post(
            "/api/v1/admin/panel-locales/uk/translate",
            json={"texts": ["Hi"]},
            headers=owner_headers(restaurant.id),
        )
    assert anonymous.status_code == 401
    assert owner.status_code in (401, 403)
    assert deepl == []


@pytest.mark.parametrize("code", ["pl", "en", "ar", "xx"])
async def test_only_machine_made_languages_are_translated(restaurant, deepl, code):
    async with client() as http:
        response = await http.post(
            f"/api/v1/admin/panel-locales/{code}/translate",
            json={"texts": ["Hi"]},
            headers=await admin_headers(),
        )
    assert response.status_code == 404
    assert deepl == []


async def test_hq_can_give_a_restaurant_any_catalogue_language(restaurant):
    async with client() as http:
        response = await create(http, restaurant, panel_language="tr")
    assert response.json()["panel_language"] == "tr"


async def test_an_unfinished_language_is_not_served(restaurant):
    async with client() as http:
        response = await http.get("/api/v1/public/panel-locales/tr")
    assert response.status_code == 404
