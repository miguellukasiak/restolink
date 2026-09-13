"""The owner's Google Maps reviews dashboard.

Two endpoints: one to connect a listing, one to read it. Every route here is
the restaurant owner looking at their own data, so the whole router sits behind
`verify_restaurant_access` — which checks both that the bearer token is valid
and that it belongs to the restaurant named in the path.

**Why there is a cache table for two numbers and five reviews.** Google bills
Place Details per call, and the `reviews` field sits in their most expensive
SKU. Fetching on every panel visit would charge for data that changes a handful
of times a month; an owner leaving the tab open and refreshing would be paying
for identical bytes. So the answer is served from the database and refreshed at
most once a day, which keeps a normal deployment inside the free allowance
regardless of how often anyone looks at it.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from ..database import get_db
from ..dependencies import verify_restaurant_access
from ..models import GoogleReviewCache, Restaurant
from ..schemas import GooglePlaceUpdate, GoogleReviewItem, GoogleReviewsResponse
from ..security import as_utc

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/panel/{restaurant_id}",
    tags=["Google Maps"],
    dependencies=[Depends(verify_restaurant_access)],
)

#: How long a snapshot is considered current. A day is the whole point of this
#: feature: reviews arrive slowly, and a rating that is a few hours behind is
#: indistinguishable from a live one to the person reading it.
CACHE_TTL = timedelta(hours=24)

_PLACES_URL = "https://maps.googleapis.com/maps/api/place/details/json"

#: Asking for exactly what the dashboard renders. Every extra field is billed,
#: and `reviews` alone already puts this call in the Atmosphere SKU.
_PLACE_FIELDS = "rating,user_ratings_total,reviews"

#: Google returns at most five reviews from Place Details; this is a guard for
#: the day that changes, not a filter that currently removes anything.
_REVIEW_LIMIT = 5

#: Render's free tier is slow to wake but Google is not — a request that has
#: not answered in ten seconds is not going to.
_HTTP_TIMEOUT = 10.0


# --------------------------------------------------------------------------- #
# Connecting a listing
# --------------------------------------------------------------------------- #


def _clean_place_id(raw: str) -> str | None:
    """Validate what the owner pasted, or explain what went wrong.

    Returns `None` for a deliberate disconnect (an empty field).

    Deliberately permissive about the id's *shape*: Google has minted several
    formats over the years and inventing a pattern here would eventually reject
    a valid listing for no reason. Google is the authority on its own ids, and
    a wrong one comes back from the API as a message this screen can show.

    The one thing worth catching locally is the overwhelmingly common mistake —
    pasting the Maps URL instead of the id. Naming it costs nothing and saves
    an owner a confusing round-trip through an error they cannot interpret.
    """
    candidate = raw.strip()
    if not candidate:
        return None

    if candidate.startswith(("http://", "https://")) or "google." in candidate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "To wygląda na adres z Google Maps, a nie na Place ID. "
                "Place ID to krótki identyfikator "
                "(np. ChIJN1t_tDeuEmsRUsoyG83frY4) — znajdziesz go "
                "w wyszukiwarce Place ID Finder."
            ),
        )

    if any(character.isspace() for character in candidate):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Place ID nie zawiera spacji — sprawdź, czy nie zostało "
                "skopiowane coś więcej niż sam identyfikator."
            ),
        )

    return candidate


async def _require_restaurant(db: AsyncSession, restaurant_id: uuid.UUID) -> Restaurant:
    restaurant = await db.get(
        Restaurant, restaurant_id, options=[noload(Restaurant.package)]
    )
    if restaurant is None or restaurant.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Nie znaleziono restauracji.")
    return restaurant


async def _load_cache(
    db: AsyncSession, restaurant_id: uuid.UUID
) -> GoogleReviewCache | None:
    return await db.scalar(
        select(GoogleReviewCache).where(
            GoogleReviewCache.restaurant_id == restaurant_id
        )
    )


@router.put("/google-place", response_model=GoogleReviewsResponse)
async def set_google_place(
    restaurant_id: uuid.UUID,
    payload: GooglePlaceUpdate,
    db: AsyncSession = Depends(get_db),
) -> GoogleReviewsResponse:
    """Connect (or disconnect) the restaurant's Google Maps listing.

    Answers with the dashboard's state rather than a bare `{"success": true}`,
    so the panel can switch from the setup screen to the dashboard on this one
    response instead of saving and then immediately asking again.
    """
    restaurant = await _require_restaurant(db, restaurant_id)
    restaurant.google_place_id = _clean_place_id(payload.google_place_id)
    await db.flush()

    logger.info(
        "Google place %s for restaurant %s",
        "cleared" if restaurant.google_place_id is None else "updated",
        restaurant_id,
    )

    if restaurant.google_place_id is None:
        return GoogleReviewsResponse(configured=False)

    # Falls through to the same read path as the GET, so connecting a listing
    # shows its reviews immediately. A snapshot of the *previous* listing is
    # refused there rather than served, so correcting a mistyped id does not
    # leave the owner looking at another restaurant's stars.
    return await _read_or_refresh(db, restaurant)


# --------------------------------------------------------------------------- #
# Reading the dashboard
# --------------------------------------------------------------------------- #


def _google_key() -> str:
    """The API key, or a 503 that names the variable that is missing.

    503 rather than 500: the feature is unavailable because the deployment has
    not been configured, not because a request went wrong. The panel shows this
    message verbatim, so it has to be something an owner can forward to whoever
    administers the server.
    """
    key = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    if not key:
        logger.error("GOOGLE_MAPS_API_KEY is not set — reviews are unavailable.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Klucz API Google Maps nie został skonfigurowany na serwerze",
        )
    return key


def _is_fresh(entry: GoogleReviewCache | None, place_id: str) -> bool:
    """Whether a cached snapshot can answer the question being asked.

    Two conditions, and the second is the one that is easy to forget: the data
    has to be recent *and* it has to be about the listing currently connected.
    An owner who pastes the wrong place and corrects it would otherwise stare
    at another restaurant's reviews for the rest of the day.
    """
    if entry is None or entry.place_id != place_id:
        return False
    return datetime.now(timezone.utc) - as_utc(entry.updated_at) < CACHE_TTL


def _cached_response(entry: GoogleReviewCache) -> GoogleReviewsResponse:
    return GoogleReviewsResponse(
        configured=True,
        place_id=entry.place_id,
        rating=entry.rating,
        total_ratings=entry.total_ratings,
        reviews=[GoogleReviewItem(**review) for review in entry.reviews_data or []],
        synced_at=as_utc(entry.updated_at),
    )


def _normalise_reviews(raw: object) -> list[GoogleReviewItem]:
    """Google's reviews, reduced to what the dashboard draws.

    Sorted newest-first and capped: the panel promises "the most recent", and
    Google's default ordering is by *relevance*, which is not the same thing.
    """
    if not isinstance(raw, list):
        return []

    items: list[GoogleReviewItem] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        try:
            rating = float(entry.get("rating"))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            # A review with no star rating has nothing this screen can draw.
            continue

        items.append(
            GoogleReviewItem(
                author_name=(
                    str(entry.get("author_name") or "").strip() or "Gość Google"
                ),
                profile_photo_url=entry.get("profile_photo_url") or None,
                rating=rating,
                text=str(entry.get("text") or "").strip(),
                relative_time_description=str(
                    entry.get("relative_time_description") or ""
                ),
                time=int(entry.get("time") or 0),
            )
        )

    items.sort(key=lambda review: review.time, reverse=True)
    return items[:_REVIEW_LIMIT]


class _UpstreamUnavailable(Exception):
    """Google could not answer *right now* — as opposed to answering "no".

    The distinction decides whether a day-old snapshot is better than an error
    page. A timeout or a 500 from Google says nothing about the listing, so
    stale data is still true data. A rejected place id says the listing itself
    is wrong, and showing the previous one instead would be a lie.
    """

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


async def _fetch_place_details(place_id: str, api_key: str) -> dict:
    """One Place Details call, with Google's own error envelope unwrapped.

    The API answers HTTP 200 for most failures and reports the real outcome in
    a `status` field, so `raise_for_status` alone would happily hand back an
    error body as if it were data.
    """
    params = {
        "place_id": place_id,
        "fields": _PLACE_FIELDS,
        "language": "pl",
        "key": api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            response = await client.get(_PLACES_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        # Never log `params` — it carries the API key.
        logger.warning("Google Places request failed: %s", exc)
        raise _UpstreamUnavailable(
            "Nie udało się połączyć z Google Maps. Spróbuj ponownie za chwilę."
        ) from exc
    except ValueError as exc:  # malformed JSON
        logger.warning("Google Places returned a non-JSON body: %s", exc)
        raise _UpstreamUnavailable(
            "Google Maps zwróciło nieczytelną odpowiedź. Spróbuj ponownie za chwilę."
        ) from exc

    api_status = str(payload.get("status", "")).upper()
    if api_status == "OK":
        result = payload.get("result")
        return result if isinstance(result, dict) else {}

    # Google puts the interesting part in `error_message`; it can name the
    # project or the key restriction, so it is logged and never returned.
    logger.warning(
        "Google Places answered %s: %s",
        api_status or "<no status>",
        payload.get("error_message", ""),
    )

    if api_status in {"NOT_FOUND", "INVALID_REQUEST", "ZERO_RESULTS"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Google nie rozpoznaje tego Place ID. Sprawdź identyfikator "
                "w wyszukiwarce Place ID Finder i zapisz go ponownie."
            ),
        )

    if api_status == "REQUEST_DENIED":
        # Our configuration, not the owner's: a bad key, or the Places API not
        # enabled on the project.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Google odrzuciło klucz API. Sprawdź konfigurację serwera "
                "(GOOGLE_MAPS_API_KEY oraz uprawnienia Places API)."
            ),
        )

    raise _UpstreamUnavailable(
        "Google Maps chwilowo nie odpowiada. Spróbuj ponownie za chwilę."
    )


async def _refresh(
    db: AsyncSession,
    restaurant_id: uuid.UUID,
    place_id: str,
    entry: GoogleReviewCache | None,
) -> GoogleReviewsResponse:
    """Pull fresh data from Google and store it as the new snapshot."""
    result = await _fetch_place_details(place_id, _google_key())

    reviews = _normalise_reviews(result.get("reviews"))

    raw_rating = result.get("rating")
    try:
        rating = float(raw_rating) if raw_rating is not None else None
    except (TypeError, ValueError):
        rating = None

    try:
        total_ratings = int(result.get("user_ratings_total") or 0)
    except (TypeError, ValueError):
        total_ratings = 0

    now = datetime.now(timezone.utc)

    if entry is None:
        entry = GoogleReviewCache(restaurant_id=restaurant_id)
        db.add(entry)

    entry.place_id = place_id
    entry.rating = rating
    entry.total_ratings = total_ratings
    entry.reviews_data = [review.model_dump() for review in reviews]
    # Set explicitly rather than relying on an `onupdate` default: a refresh
    # that returned an identical rating changes no other column, SQLAlchemy
    # would emit no UPDATE at all, and the row would stay stale forever — with
    # every page view then paying for a fresh Google call.
    entry.updated_at = now

    await db.flush()
    logger.info(
        "Google reviews refreshed for restaurant %s: %s stars / %d ratings / "
        "%d reviews",
        restaurant_id,
        rating,
        total_ratings,
        len(reviews),
    )

    return GoogleReviewsResponse(
        configured=True,
        place_id=place_id,
        rating=rating,
        total_ratings=total_ratings,
        reviews=reviews,
        synced_at=now,
    )


async def _read_or_refresh(
    db: AsyncSession, restaurant: Restaurant
) -> GoogleReviewsResponse:
    place_id = (restaurant.google_place_id or "").strip()
    if not place_id:
        return GoogleReviewsResponse(configured=False)

    entry = await _load_cache(db, restaurant.id)
    if entry is not None and _is_fresh(entry, place_id):
        return _cached_response(entry)

    try:
        return await _refresh(db, restaurant.id, place_id, entry)
    except _UpstreamUnavailable as exc:
        # Google is unreachable, but yesterday's snapshot of *this* listing is
        # still an honest answer, and a rating that is a day old beats an error
        # page. Only a snapshot of the listing currently connected will do.
        if entry is not None and entry.place_id == place_id:
            logger.info(
                "Serving stale Google reviews for restaurant %s (%s)",
                restaurant.id,
                exc.detail,
            )
            return _cached_response(entry)

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.detail
        ) from exc


@router.get("/google-reviews", response_model=GoogleReviewsResponse)
async def get_google_reviews(
    restaurant_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> GoogleReviewsResponse:
    """The rating, the review count and the five most recent reviews.

    Served from the day-old cache when there is one, fetched from Google when
    there is not. "Not connected yet" comes back as `configured: false` rather
    than as an error — it is a normal state for a restaurant that has not
    pasted a Place ID, and the panel renders the setup screen for it.
    """
    restaurant = await _require_restaurant(db, restaurant_id)
    return await _read_or_refresh(db, restaurant)
