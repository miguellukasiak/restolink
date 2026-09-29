"""Which languages the owner offers their guests.

The translations themselves live in `dictionary.py`; this is the switch that
decides which of them a guest can pick, plus the numbers the "Języki" screen
shows beside each language. Behind `verify_restaurant_access` at router level,
like every owner route.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from ..database import get_db
from ..dependencies import verify_restaurant_access
from ..menu_languages import MENU_LANGUAGES, offered_languages
from ..models import Restaurant
from ..schemas import LanguageProgress, MenuLanguagesResponse, MenuLanguagesUpdate
from ..translation_service import menu_phrases, translated_counts

router = APIRouter(
    prefix="/api/v1/panel/{restaurant_id}/languages",
    tags=["Languages"],
    dependencies=[Depends(verify_restaurant_access)],
)


async def _load(db: AsyncSession, restaurant_id: uuid.UUID) -> Restaurant:
    restaurant = await db.get(
        Restaurant, restaurant_id, options=[noload(Restaurant.package)]
    )
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Nie znaleziono restauracji.")
    return restaurant


async def _describe(db: AsyncSession, restaurant: Restaurant) -> MenuLanguagesResponse:
    offered = offered_languages(restaurant.menu_languages, restaurant.base_language)
    phrases = await menu_phrases(db, restaurant.id)
    counts = await translated_counts(db, restaurant.id, phrases)

    shown = [code for code in MENU_LANGUAGES if code in offered or counts.get(code)]
    return MenuLanguagesResponse(
        base_language=restaurant.base_language,
        languages=offered,
        available=[code for code in MENU_LANGUAGES if code != restaurant.base_language],
        phrases_total=len(phrases),
        progress=[
            LanguageProgress(code=code, translated=counts.get(code, 0)) for code in shown
        ],
    )


@router.get("", response_model=MenuLanguagesResponse)
async def get_languages(
    restaurant_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> MenuLanguagesResponse:
    return await _describe(db, await _load(db, restaurant_id))


@router.put("", response_model=MenuLanguagesResponse)
async def set_languages(
    restaurant_id: uuid.UUID,
    payload: MenuLanguagesUpdate,
    db: AsyncSession = Depends(get_db),
) -> MenuLanguagesResponse:
    """Replace the offered languages with `languages`, in that order.

    Translations are untouched: removing a language only hides it from guests,
    so adding it back brings back everything written for it.
    """
    restaurant = await _load(db, restaurant_id)

    codes: list[str] = []
    for raw in payload.languages:
        code = raw.strip().lower()
        # The base language is not a translation, and a repeat is a no-op —
        # neither is worth an error from a screen that should never send them.
        if code == restaurant.base_language or code in codes:
            continue
        if code not in MENU_LANGUAGES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Nieobsługiwany język: {raw.strip()[:16]}.",
            )
        codes.append(code)

    restaurant.menu_languages = codes
    await db.commit()
    await db.refresh(restaurant)
    return await _describe(db, restaurant)
