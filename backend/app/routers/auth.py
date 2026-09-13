"""Authentication: owner sign-in, password reset, and the hidden admin door.

Two rules shape most of what follows.

**Never confirm whether an account exists.** Login answers the same way for an
unknown email and a wrong password, and "forgot password" answers the same way
whether or not the address is registered. Anything else turns these endpoints
into a directory of RestoLink customers.

**Never store anything replayable.** Passwords are bcrypt hashes; reset tokens
are stored as SHA-256 digests and hard-deleted the moment they are spent.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from ..database import get_db
from ..email_service import EmailSendError, send_password_reset
from ..models import PasswordReset, Restaurant, RestaurantStatus
from ..schemas import (
    AdminLoginRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenResponse,
)
from ..security import (
    ADMIN_TOKEN_TTL,
    PASSWORD_RESET_TTL,
    RESTAURANT_TOKEN_TTL,
    create_access_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
    verify_superadmin_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

#: One message for every way a sign-in can fail.
_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Nieprawidłowy e-mail lub hasło.",
)

#: Returned by `forgot-password` in every case, including unknown addresses.
_RESET_SENT_MESSAGE = (
    "Jeśli konto o tym adresie istnieje, wysłaliśmy na nie link do zmiany hasła."
)


def _as_utc(value: datetime) -> datetime:
    """Force a timestamp to be timezone-aware UTC before comparing it.

    Postgres hands back aware datetimes for `TIMESTAMPTZ`, but that is a
    property of the driver, not something an expiry check should rest on. A
    naive value reaching the comparison raises `TypeError` mid-request, which
    would turn "this reset link expired" into a 500 — the one outcome a
    security check must never produce.
    """
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _normalize_email(email: str) -> str:
    """Emails are matched case-insensitively; addresses are not case-sensitive
    in practice, and an owner who signed up as `Anna@` will type `anna@`."""
    return email.strip().lower()


async def _find_by_email(db: AsyncSession, email: str) -> Restaurant | None:
    """Look up a live restaurant by login email.

    `noload(package)` because the relationship is `lazy="selectin"` and nothing
    here needs the subscription package — loading it would be a wasted query on
    a hot, unauthenticated path.
    """
    result = await db.scalars(
        select(Restaurant)
        .options(noload(Restaurant.package))
        .where(
            func.lower(Restaurant.email) == email,
            Restaurant.deleted_at.is_(None),
        )
    )
    return result.first()


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """Exchange email + password for an access token."""
    restaurant = await _find_by_email(db, _normalize_email(payload.email))

    # `verify_password` runs a real bcrypt comparison even when there is no
    # hash, so a missing account takes as long as a wrong password.
    if not verify_password(payload.password, restaurant.hashed_password if restaurant else None):
        raise _INVALID_CREDENTIALS

    assert restaurant is not None  # narrowed by the check above

    if restaurant.status is RestaurantStatus.BLOCKED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Konto restauracji jest zablokowane. Skontaktuj się z nami.",
        )

    token, expires_in = create_access_token(
        subject=str(restaurant.id),
        role="restaurant",
        expires_in=RESTAURANT_TOKEN_TTL,
    )
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        restaurant_id=restaurant.id,
        restaurant_name=restaurant.name,
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    """Start a password reset.

    Always reports success. An unknown address, a blocked account, even Resend
    failing outright — the caller cannot tell any of them apart from a sent
    email, because each distinguishable answer would confirm or deny that the
    address belongs to a customer. Failures are logged instead.
    """
    email = _normalize_email(payload.email)
    restaurant = await _find_by_email(db, email)

    if restaurant is None:
        logger.info("Password reset requested for an unknown address.")
        return MessageResponse(message=_RESET_SENT_MESSAGE)

    # Any earlier grant for this restaurant is void: requesting a new link
    # should invalidate the old one, so a forwarded or intercepted email stops
    # working as soon as the real owner asks again.
    await db.execute(
        delete(PasswordReset).where(PasswordReset.restaurant_id == restaurant.id)
    )

    raw_token, token_hash = generate_reset_token()
    db.add(
        PasswordReset(
            restaurant_id=restaurant.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + PASSWORD_RESET_TTL,
        )
    )
    # Committed before the email goes out: a link that arrives before its row
    # is visible would fail verification.
    await db.commit()

    try:
        await send_password_reset(
            to_email=restaurant.email or email,
            restaurant_name=restaurant.name,
            raw_token=raw_token,
        )
    except EmailSendError:
        logger.exception("Password reset email failed for restaurant %s", restaurant.id)

    return MessageResponse(message=_RESET_SENT_MESSAGE)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    """Consume a reset token and set a new password."""
    token_hash = hash_reset_token(payload.token)

    grant = (
        await db.scalars(
            select(PasswordReset).where(PasswordReset.token_hash == token_hash)
        )
    ).first()

    now = datetime.now(timezone.utc)
    if grant is None or _as_utc(grant.expires_at) <= now:
        if grant is not None:
            # Expired: clear it out rather than leaving it to accumulate.
            await db.delete(grant)
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link wygasł lub został już użyty. Poproś o nowy.",
        )

    restaurant = await db.get(
        Restaurant, grant.restaurant_id, options=[noload(Restaurant.package)]
    )
    if restaurant is None or restaurant.deleted_at is not None:
        await db.delete(grant)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link wygasł lub został już użyty. Poproś o nowy.",
        )

    restaurant.hashed_password = hash_password(payload.password)
    # Single use: the grant is deleted in the same transaction that sets the
    # password, so the link cannot be replayed even on a retry.
    await db.delete(grant)
    await db.commit()

    return MessageResponse(message="Hasło zostało zmienione. Możesz się zalogować.")


@router.post("/admin/login", response_model=TokenResponse)
async def admin_login(payload: AdminLoginRequest) -> TokenResponse:
    """The hidden super-admin door.

    Checks one environment variable and touches the database not at all, so
    there is no admin account to enumerate, phish or leak in a dump. An unset
    `SUPERADMIN_PASSWORD` refuses every attempt.
    """
    if not verify_superadmin_password(payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowe hasło.",
        )

    token, expires_in = create_access_token(
        subject="superadmin", role="admin", expires_in=ADMIN_TOKEN_TTL
    )
    return TokenResponse(access_token=token, expires_in=expires_in)
