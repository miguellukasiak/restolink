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

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from ..database import get_db
from ..email_service import EmailSendError, send_password_reset
from ..messages import localize
from ..models import AdminUser, PasswordReset, Restaurant, RestaurantStatus
from ..panel_language import request_language
from ..schemas import (
    ActivateRequest,
    AdminLoginRequest,
    AdminProfile,
    AdminTokenResponse,
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
    as_utc,
    create_access_token,
    generate_reset_token,
    hash_password,
    hash_reset_token,
    verify_password,
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


def _reset_sent(request: Request) -> str:
    return localize(
        _RESET_SENT_MESSAGE, request_language(request.headers.get("accept-language"))
    )


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
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
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
        return MessageResponse(message=_reset_sent(request))

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
            language=restaurant.panel_language,
        )
    except EmailSendError:
        logger.exception("Password reset email failed for restaurant %s", restaurant.id)

    return MessageResponse(message=_reset_sent(request))


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
    if grant is None or as_utc(grant.expires_at) <= now:
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
    # Stamping this retires every access token issued earlier — see
    # `token_predates_password_change`. A reset is usually requested precisely
    # because someone else may be signed in, so leaving their week-long token
    # alive would defeat the exercise.
    restaurant.password_changed_at = now
    # Single use: the grant is deleted in the same transaction that sets the
    # password, so the link cannot be replayed even on a retry.
    await db.delete(grant)
    await db.commit()

    return MessageResponse(
        message="Hasło zostało zmienione. Wszystkie inne sesje zostały wylogowane."
    )


#: Correct credentials, wrong person. Deliberately distinct from
#: `_INVALID_CREDENTIALS`: the caller has already proved they own the account,
#: so naming the reason tells them nothing they did not supply themselves — and
#: "wrong email or password" for someone whose password is right is the kind of
#: error message people spend an afternoon on.
_NO_ADMIN_RIGHTS = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Brak uprawnień administracyjnych.",
)


async def _find_admin_by_email(db: AsyncSession, email: str) -> AdminUser | None:
    result = await db.scalars(
        select(AdminUser).where(func.lower(AdminUser.email) == email)
    )
    return result.first()


async def _owner_credentials_match(
    db: AsyncSession, email: str, password: str
) -> bool:
    """Whether these credentials belong to a restaurant owner.

    Asked only after the HQ lookup has already failed, and only to choose the
    error message. It confirms nothing the caller has not just proved by typing
    the right password, so it is not the account oracle the rest of this module
    works to avoid — and it is what turns "wrong email or password" into "you
    are in the wrong place", for the person most likely to end up here by
    mistake: an owner who bookmarked the wrong door.
    """
    restaurant = await _find_by_email(db, email)
    return verify_password(password, restaurant.hashed_password if restaurant else None)


@router.post("/admin/login", response_model=AdminTokenResponse)
async def admin_login(
    payload: AdminLoginRequest, db: AsyncSession = Depends(get_db)
) -> AdminTokenResponse:
    """HQ sign-in, with individual accounts.

    This replaced a single shared `SUPERADMIN_PASSWORD`. That door could not
    say who had walked through it, could not be closed for one person without
    changing the secret for everyone, and stayed open to every ex-employee
    until somebody remembered to rotate it.

    Two ways to fail, and they are different on purpose. Credentials that match
    nothing get the same answer as everywhere else in this module. Credentials
    that are *right* but lack the flag get 403 — at that point there is no
    account to protect from the person who just authenticated as it.
    """
    email = _normalize_email(payload.email)
    admin = await _find_admin_by_email(db, email)

    # Real bcrypt work even when there is no row, so a missing HQ account takes
    # as long as a wrong password.
    if not verify_password(payload.password, admin.hashed_password if admin else None):
        if await _owner_credentials_match(db, email, payload.password):
            logger.info("Restaurant owner attempted to sign in at the HQ door.")
            raise _NO_ADMIN_RIGHTS
        raise _INVALID_CREDENTIALS

    assert admin is not None  # narrowed by the check above

    if not admin.is_superadmin:
        logger.warning("HQ sign-in refused for %s: not a superadmin.", admin.id)
        raise _NO_ADMIN_RIGHTS

    token, expires_in = create_access_token(
        subject=str(admin.id), role="admin", expires_in=ADMIN_TOKEN_TTL
    )
    logger.info("HQ sign-in for admin %s.", admin.id)
    return AdminTokenResponse(
        access_token=token,
        expires_in=expires_in,
        admin=AdminProfile.model_validate(admin),
    )


# --------------------------------------------------------------------------- #
# Activation (the welcome email's landing endpoint)
# --------------------------------------------------------------------------- #

#: One message for an activation link that cannot be used, whatever the reason.
#: The caller is holding a link, not guessing at one, so there is nothing to
#: conceal — but there is also nothing useful to distinguish: expired, already
#: spent and never-existed all have the same fix, which is to ask for a new one.
_LINK_UNUSABLE = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="Link aktywacyjny wygasł lub został już użyty. Poproś nas o nowy.",
)


@router.post("/activate", response_model=TokenResponse)
async def activate(
    payload: ActivateRequest, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """Turn a welcome link into a working account, and sign the owner in.

    This is where a restaurant created in HQ becomes usable. Two things happen
    that the reset endpoint does not do, because until now the row had neither:
    a password is set, and the **login identity** is filled in from
    `contact_email`.

    Deriving the login email here rather than at creation is what makes HQ's
    rescue work. An operator who mistypes the address, or an owner who cannot
    reach that inbox, is fixed by correcting `contact_email` and re-sending the
    link — and the address they will sign in with follows automatically, because
    it is read at this moment and not weeks earlier.
    """
    grant = (
        await db.scalars(
            select(PasswordReset).where(
                PasswordReset.token_hash == hash_reset_token(payload.token)
            )
        )
    ).first()

    now = datetime.now(timezone.utc)
    if grant is None or as_utc(grant.expires_at) <= now:
        if grant is not None:
            await db.delete(grant)
            await db.commit()
        raise _LINK_UNUSABLE

    restaurant = await db.get(
        Restaurant, grant.restaurant_id, options=[noload(Restaurant.package)]
    )
    if restaurant is None or restaurant.deleted_at is not None:
        await db.delete(grant)
        await db.commit()
        raise _LINK_UNUSABLE

    if restaurant.status is RestaurantStatus.BLOCKED:
        # Checked before anything is written, and the grant is deliberately
        # left alive: the link is not the problem here, the account is, and
        # burning it would strip the owner of the one thing that still works
        # once HQ unblocks them.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Konto restauracji jest zablokowane. Skontaktuj się z nami.",
        )

    restaurant.hashed_password = hash_password(payload.new_password)
    restaurant.password_changed_at = now
    if not restaurant.email:
        restaurant.email = _normalize_email(restaurant.contact_email)
    # Single use: spent in the same transaction that sets the password.
    await db.delete(grant)

    # Read out before the commit, and used for everything after it. A rollback
    # expires every instance in the session regardless of `expire_on_commit`,
    # so touching `restaurant.id` in the failure branch below would trigger a
    # lazy reload — synchronous IO in an async context, which SQLAlchemy raises
    # `MissingGreenlet` for. That turns the clean 409 this branch exists to
    # return into a 500 about greenlets.
    activated_id = restaurant.id
    activated_name = restaurant.name

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        # `email` is unique, so two restaurants sharing one contact address can
        # only have one login identity. Rare, but it has to say something an
        # owner can act on rather than a 500.
        logger.warning(
            "Activation for restaurant %s collided on the login email.",
            activated_id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Ten adres e-mail jest już używany przez inne konto. "
                "Skontaktuj się z nami, żebyśmy przypisali inny."
            ),
        ) from exc

    logger.info("Restaurant %s activated.", activated_id)

    token, expires_in = create_access_token(
        subject=str(activated_id),
        role="restaurant",
        expires_in=RESTAURANT_TOKEN_TTL,
    )
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        restaurant_id=activated_id,
        restaurant_name=activated_name,
    )
