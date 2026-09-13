"""Request-scoped auth dependencies.

`security.py` holds the cryptography; this module is the thin FastAPI layer
that turns an `Authorization: Bearer …` header into either a `Restaurant` row
or an authenticated admin.
"""

import uuid

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models import Restaurant, RestaurantStatus
from .security import TokenError, decode_access_token

#: `auto_error=False` so a missing header produces our own 401 with a readable
#: Polish message, rather than FastAPI's bare "Not authenticated".
_bearer = HTTPBearer(auto_error=False)

_UNAUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Wymagane zalogowanie.",
    headers={"WWW-Authenticate": "Bearer"},
)


def _credential_or_401(
    credentials: HTTPAuthorizationCredentials | None,
) -> str:
    if credentials is None or not credentials.credentials:
        raise _UNAUTHENTICATED
    return credentials.credentials


async def get_current_restaurant(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> Restaurant:
    """The restaurant that owns the bearer token, or 401.

    The row is re-read on every request rather than trusted from the token's
    claims, so deleting or blocking a restaurant takes effect immediately
    instead of whenever its week-long token happens to expire.
    """
    token = _credential_or_401(credentials)

    try:
        subject = decode_access_token(token, expected_role="restaurant")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    try:
        restaurant_id = uuid.UUID(subject)
    except ValueError as exc:
        raise _UNAUTHENTICATED from exc

    restaurant = await db.get(Restaurant, restaurant_id)
    if restaurant is None or restaurant.deleted_at is not None:
        raise _UNAUTHENTICATED

    if restaurant.status is RestaurantStatus.BLOCKED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Konto restauracji jest zablokowane.",
        )

    return restaurant


async def verify_restaurant_access(
    restaurant_id: uuid.UUID = Path(...),
    current: Restaurant = Depends(get_current_restaurant),
) -> Restaurant:
    """Authorisation, not just authentication.

    Every panel route is addressed as `/restaurants/{restaurant_id}/…`, so a
    valid token is only half the check: without comparing it to the path, any
    signed-in owner could read and edit any other restaurant's menu by editing
    the URL. 404 rather than 403 — a wrong id should not confirm that the
    restaurant exists.
    """
    if current.id != restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie znaleziono restauracji.",
        )
    return current


async def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Gate for the super-admin routes. Needs no database at all."""
    token = _credential_or_401(credentials)

    try:
        return decode_access_token(token, expected_role="admin")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
