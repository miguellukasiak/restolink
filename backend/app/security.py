"""Password hashing, JWT issuing/decoding, and reset-token primitives.

Deliberately free of FastAPI and SQLAlchemy imports so it stays unit-testable
on its own; the request-scoped dependencies that use it live in
`app/dependencies.py`.

Configuration comes exclusively from the environment — never hardcode secrets:

    JWT_SECRET_KEY        signing key for access tokens
    SUPERADMIN_PASSWORD   the only credential for the hidden admin login
"""

import hashlib
import hmac
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
from passlib.context import CryptContext

logger = logging.getLogger(__name__)

# bcrypt with the library default of 12 rounds.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"

#: Owners stay signed in for a week; the panel is a low-risk back office and a
#: shorter window would mean re-typing a password mid-shift.
RESTAURANT_TOKEN_TTL = timedelta(days=7)
#: The admin token is far more powerful, so it expires the same day.
ADMIN_TOKEN_TTL = timedelta(hours=12)
#: Long enough to walk to a laptop, short enough that a forwarded email rots.
PASSWORD_RESET_TTL = timedelta(minutes=30)

#: bcrypt hashes at most 72 bytes and silently ignores the rest, which would
#: make two different long passwords interchangeable. Callers must reject
#: anything longer instead of letting it through.
MAX_PASSWORD_BYTES = 72

#: RFC 7518 §3.2 minimum for an HS256 signing key.
MIN_SECRET_KEY_BYTES = 32

TokenRole = Literal["restaurant", "admin"]


def _load_secret_key() -> str:
    """The JWT signing key, or a throwaway one in development.

    A hardcoded fallback would be worse than no fallback: it would ship a
    publicly known signing key that anyone could use to mint admin tokens. When
    the variable is missing we generate a random key for this process only —
    the app still runs locally, and every restart invalidates previously issued
    tokens, which is exactly the nuisance that gets the variable set.
    """
    configured = os.getenv("JWT_SECRET_KEY", "")
    if configured:
        # RFC 7518 §3.2: an HS256 key should be at least as long as the hash it
        # feeds — 32 bytes. A short one is brute-forceable offline from a single
        # captured token, and forging an admin token needs nothing else.
        if len(configured.encode()) < MIN_SECRET_KEY_BYTES:
            logger.error(
                "JWT_SECRET_KEY is only %d bytes; HS256 needs at least %d. "
                "Tokens signed with it can be brute-forced offline. Replace it "
                "with: python -c \"import secrets; print(secrets.token_urlsafe(48))\"",
                len(configured.encode()),
                MIN_SECRET_KEY_BYTES,
            )
        return configured

    logger.warning(
        "JWT_SECRET_KEY is not set — generating an ephemeral key for this "
        "process. Every restart will sign out all users. Set the variable in "
        "any environment you care about."
    )
    return secrets.token_urlsafe(64)


SECRET_KEY = _load_secret_key()


def is_superadmin_configured() -> bool:
    return bool(os.getenv("SUPERADMIN_PASSWORD", ""))


def verify_superadmin_password(candidate: str) -> bool:
    """Constant-time check of the hidden admin password.

    `compare_digest` keeps the comparison from leaking the password's length or
    its matching prefix through response timing. An unset variable always fails
    — the admin door does not open just because nobody configured a lock.
    """
    expected = os.getenv("SUPERADMIN_PASSWORD", "")
    if not expected:
        logger.warning("SUPERADMIN_PASSWORD is not set — admin login refused.")
        return False
    return hmac.compare_digest(candidate.encode(), expected.encode())


# --------------------------------------------------------------------------- #
# Passwords
# --------------------------------------------------------------------------- #


def password_too_long(password: str) -> bool:
    return len(password.encode("utf-8")) > MAX_PASSWORD_BYTES


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    """Check a password, in constant time whether or not the account exists.

    A missing hash still runs a real bcrypt verification against a dummy value.
    Returning early instead would make "no such account" measurably faster than
    "wrong password" and hand out a way to enumerate registered emails.
    """
    if not hashed:
        _pwd_context.dummy_verify()
        return False
    return _pwd_context.verify(password, hashed)


# --------------------------------------------------------------------------- #
# Reset tokens
# --------------------------------------------------------------------------- #


def generate_reset_token() -> tuple[str, str]:
    """Return `(raw_token, token_hash)` for a new password reset.

    The raw token goes in the email and is never persisted; the database only
    ever sees the hash. SHA-256 is the right tool here rather than bcrypt: the
    token is 256 bits of `secrets` output, so it has no guessable structure to
    slow an attacker down over, and reset verification has to be fast.
    """
    raw = secrets.token_urlsafe(32)
    return raw, hash_reset_token(raw)


def hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# --------------------------------------------------------------------------- #
# JWT
# --------------------------------------------------------------------------- #


def create_access_token(
    *, subject: str, role: TokenRole, expires_in: timedelta
) -> tuple[str, int]:
    """Sign an access token. Returns `(token, seconds_until_expiry)`."""
    now = datetime.now(timezone.utc)
    expires_at = now + expires_in
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, int(expires_in.total_seconds())


class TokenError(Exception):
    """Raised when a token is missing, malformed, expired or the wrong role."""


def decode_access_token(token: str, *, expected_role: TokenRole) -> str:
    """Validate a token and return its subject.

    `algorithms` is pinned to a single entry on purpose: accepting a list the
    caller does not control is how "alg: none" and HMAC-vs-RSA confusion attacks
    get in. The role is checked here too, so an owner's token can never be
    replayed against an admin route.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Sesja wygasła. Zaloguj się ponownie.") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Nieprawidłowy token sesji.") from exc

    if payload.get("role") != expected_role:
        raise TokenError("Token nie uprawnia do tego zasobu.")

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise TokenError("Nieprawidłowy token sesji.")

    return subject
