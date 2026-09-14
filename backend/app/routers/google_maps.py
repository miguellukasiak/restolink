"""The owner's Google Maps reviews dashboard.

Two endpoints: one to connect a listing, one to read it. Every route here is
the restaurant owner looking at their own data, so the whole router sits behind
`verify_restaurant_access` — which checks both that the bearer token is valid
and that it belongs to the restaurant named in the path.

Data comes from **Places API (New)** — `places.googleapis.com/v1`. The legacy
`maps.googleapis.com/maps/api/place/details` endpoint is a separate product in
Google Cloud; a project that has only the new one enabled gets REQUEST_DENIED
from the old URL, which is exactly how the first version of this file failed.

**Why there is a cache table for two numbers and five reviews.** Google bills
Place Details per call, and asking for `reviews` puts the call in the priciest
tier. Fetching on every panel visit would charge for data that changes a
handful of times a month; an owner leaving the tab open and refreshing would be
paying for identical bytes. So the answer is served from the database and
refreshed at most once a day, which keeps a normal deployment inside the free
allowance regardless of how often anyone looks at it.
"""

import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

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

_PLACE_URL = "https://places.googleapis.com/v1/places/{place_id}"

#: Asking for exactly what the dashboard renders. Places API (New) has no
#: default field set — a request without a mask is refused outright — and every
#: field named here is billed.
_FIELD_MASK = "rating,userRatingCount,reviews"

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


#: Google stamps `publishTime` with up to nine fractional digits. `datetime`
#: holds six, and whether `fromisoformat` truncates the rest or rejects the
#: string has varied between Python versions — production runs 3.12, so the
#: extra digits are cut here rather than left to the interpreter.
_EXCESS_FRACTION = re.compile(r"(\.\d{6})\d+")


def _epoch_seconds(value: object) -> int:
    """RFC 3339 `publishTime` → epoch seconds, or 0 when it cannot be read.

    The cache and the panel keep the legacy `time` field (epoch seconds), so
    the new API's timestamp is converted rather than the schema changed. 0 on
    failure sorts a review last instead of dropping it: an unreadable date is
    no reason to hide what a guest wrote.
    """
    if not isinstance(value, str) or not value.strip():
        return 0

    normalised = _EXCESS_FRACTION.sub(r"\1", value.strip())
    if normalised[-1] in "Zz":
        normalised = normalised[:-1] + "+00:00"

    try:
        return int(as_utc(datetime.fromisoformat(normalised)).timestamp())
    except ValueError:
        return 0


def _localized_text(value: object) -> str:
    """The `text` out of a `LocalizedText` object (`{"text", "languageCode"}`)."""
    if isinstance(value, dict):
        return str(value.get("text") or "").strip()
    return ""


def _photo_url(value: object) -> str | None:
    """An author photo the panel can put in an `<img>`, or nothing.

    Accepts scheme-relative URIs (`//lh3.googleusercontent.com/…`) by pinning
    them to https, and refuses anything that is not a web URL at all.
    """
    if not isinstance(value, str):
        return None
    uri = value.strip()
    if uri.startswith("//"):
        return "https:" + uri
    return uri if uri.startswith("https://") else None


def _normalise_reviews(raw: object) -> list[GoogleReviewItem]:
    """Places API (New) reviews, mapped onto the shape the cache already holds.

    The new API nests what the legacy one returned flat — the author under
    `authorAttribution.displayName`, the text under `text.text` — and dates
    reviews with an RFC 3339 string instead of epoch seconds. Mapping it here
    keeps the database rows and the panel exactly as they were, so snapshots
    written by the old endpoint still render after this deploy.

    `text` is preferred to `originalText`: the request asks for Polish, so
    `text` is the review as the owner can read it, and `originalText` is the
    fallback for the reviews Google did not translate.

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

        author = entry.get("authorAttribution")
        author = author if isinstance(author, dict) else {}

        items.append(
            GoogleReviewItem(
                author_name=(
                    str(author.get("displayName") or "").strip() or "Gość Google"
                ),
                profile_photo_url=_photo_url(author.get("photoUri")),
                rating=rating,
                text=(
                    _localized_text(entry.get("text"))
                    or _localized_text(entry.get("originalText"))
                ),
                relative_time_description=str(
                    entry.get("relativePublishTimeDescription") or ""
                ),
                time=_epoch_seconds(entry.get("publishTime")),
            )
        )

    items.sort(key=lambda review: review.time, reverse=True)
    return items[:_REVIEW_LIMIT]


class _UpstreamError(Exception):
    """Google did not produce a Place, and what the panel should say about it.

    Every failure of the call is turned into one of these, so the caller has a
    single place to decide between a stale snapshot and an error response.
    `transient` records whose problem it is: a timeout or a 5xx will clear up
    on its own, while a rejected key or an unknown Place ID will not — which
    only changes how loudly a stale fallback is logged, since serving old data
    over a permanent failure hides it from everyone but the logs.
    """

    def __init__(self, status_code: int, detail: str, *, transient: bool) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.transient = transient


_UNKNOWN_PLACE = (
    "Google nie rozpoznaje tego Place ID. Sprawdź identyfikator "
    "w wyszukiwarce Place ID Finder i zapisz go ponownie."
)
_KEY_REJECTED = (
    "Google odrzuciło klucz API. Sprawdź konfigurację serwera "
    "(GOOGLE_MAPS_API_KEY oraz włączone Places API (New))."
)


def _error_reasons(body: object) -> set[str]:
    """`ErrorInfo.reason` values from a `google.rpc.Status` error body."""
    error = body.get("error") if isinstance(body, dict) else None
    details = error.get("details") if isinstance(error, dict) else None
    if not isinstance(details, list):
        return set()
    return {
        str(detail["reason"])
        for detail in details
        if isinstance(detail, dict) and detail.get("reason")
    }


def _classify_http_error(response: httpx.Response) -> _UpstreamError:
    """Map an HTTP error from Places API (New) to what the panel should show.

    Unlike the legacy API, which answered 200 and hid the outcome in a
    `status` field, the new one uses real HTTP codes with a `google.rpc.Status`
    body. The status code alone is not quite enough, though: an invalid key
    comes back as **400 INVALID_ARGUMENT** — the same code as a malformed Place
    ID — and only `ErrorInfo.reason` tells them apart. Without that check a bad
    server key would tell the owner their Place ID is wrong.
    """
    try:
        body = response.json()
    except ValueError:
        body = None

    error = body.get("error") if isinstance(body, dict) else None
    reasons = _error_reasons(body)

    # Google's message can name the project, the key restriction or the
    # billing account, so it is logged and never returned.
    logger.warning(
        "Places API (New) answered HTTP %d %s: %s %s",
        response.status_code,
        error.get("status", "") if isinstance(error, dict) else "",
        error.get("message", "") if isinstance(error, dict) else "",
        sorted(reasons),
    )

    code = response.status_code

    if code in (401, 403) or any(reason.startswith("API_KEY") for reason in reasons):
        # Our configuration, not the owner's: a bad or restricted key, the
        # API not enabled on the project, or billing switched off.
        return _UpstreamError(
            status.HTTP_503_SERVICE_UNAVAILABLE, _KEY_REJECTED, transient=False
        )

    if code in (400, 404):
        return _UpstreamError(
            status.HTTP_400_BAD_REQUEST, _UNKNOWN_PLACE, transient=False
        )

    if code == 429:
        return _UpstreamError(
            status.HTTP_502_BAD_GATEWAY,
            "Wyczerpano limit zapytań do Google Maps. Spróbuj ponownie później.",
            transient=True,
        )

    return _UpstreamError(
        status.HTTP_502_BAD_GATEWAY,
        "Google Maps chwilowo nie odpowiada. Spróbuj ponownie za chwilę.",
        transient=True,
    )


async def _fetch_place_details(place_id: str, api_key: str) -> dict:
    """One Place Details (New) call. Raises `_UpstreamError` on any failure.

    The key and the field mask travel as headers, which the new API requires —
    and which also keeps the key out of the request URL, where it would
    otherwise surface in any log line or exception message that prints one.

    The Place ID is percent-encoded as a single path segment. It is the owner's
    input, and left raw a `/` in it would address a different resource on
    Google's API than the one this code believes it is reading.
    """
    url = _PLACE_URL.format(place_id=quote(place_id, safe=""))
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": _FIELD_MASK,
    }

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            response = await client.get(
                url, params={"languageCode": "pl"}, headers=headers
            )
    except httpx.HTTPError as exc:
        # Never log `headers` — they carry the API key.
        logger.warning("Places API (New) request failed: %s", exc)
        raise _UpstreamError(
            status.HTTP_502_BAD_GATEWAY,
            "Nie udało się połączyć z Google Maps. Spróbuj ponownie za chwilę.",
            transient=True,
        ) from exc

    if response.is_error:
        raise _classify_http_error(response)

    try:
        payload = response.json()
    except ValueError as exc:
        logger.warning("Places API (New) returned a non-JSON body: %s", exc)
        raise _UpstreamError(
            status.HTTP_502_BAD_GATEWAY,
            "Google Maps zwróciło nieczytelną odpowiedź. Spróbuj ponownie za chwilę.",
            transient=True,
        ) from exc

    # A listing nobody has rated comes back as `{}` — the fields are simply
    # omitted — which is a valid Place, not an error.
    return payload if isinstance(payload, dict) else {}


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
        total_ratings = int(result.get("userRatingCount") or 0)
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
    except _UpstreamError as exc:
        # Any failure of the Google call falls back to the last snapshot of
        # *this* listing when there is one: a rating a day old beats an error
        # page. The place_id match is what keeps that honest — a snapshot of a
        # different listing is never served, whatever went wrong.
        if entry is not None and entry.place_id == place_id:
            log = logger.info if exc.transient else logger.warning
            log(
                "Serving stale Google reviews for restaurant %s (HTTP %d: %s)",
                restaurant.id,
                exc.status_code,
                exc.detail,
            )
            return _cached_response(entry)

        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


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
