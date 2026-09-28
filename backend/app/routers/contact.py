"""The landing page's contact form: a sales inquiry, emailed to our own inbox.

Unauthenticated by necessity — the visitor has no account — and it sends an
email, which makes it the one public endpoint an anonymous caller can use to
spend our Resend quota. That quota is shared with password resets and
activation links, so a flood here must not be able to lock owners out of their
panel. Hence:

* a honeypot field that only a bot fills in, answered with a fake success so
  the bot learns nothing;
* a per-client limit, keyed on the address the proxy reports;
* a global daily cap, which holds even when the per-client key is spoofed —
  `X-Forwarded-For` is whatever the caller says it is.

The limits live in process memory. Render runs one instance of this API, so
that is the whole picture; with several instances each would count its own
share, which loosens the limits but never blocks a real visitor.

A lead that could not be delivered is never answered with a success. The
visitor is told to try again, and the full inquiry goes to the log so it can
still be recovered from there — the one failure this endpoint exists to prevent
is a message that silently goes nowhere.
"""

import logging
import time
from collections import deque

from fastapi import APIRouter, HTTPException, Request, status

from ..email_service import EmailNotConfigured, EmailSendError, send_contact_inquiry
from ..schemas import ContactRequest, MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public", tags=["Public"])

_THANK_YOU = "Dziękujemy! Odezwiemy się wkrótce."

_HOUR = 60 * 60
_DAY = 24 * _HOUR

#: One person, one hour. Enough for a follow-up or a corrected typo.
_PER_CLIENT_LIMIT = 5
#: Everyone, one day. Far above any real volume of leads, far below a quota
#: that password resets and activation links also have to fit into.
_GLOBAL_LIMIT = 50

#: How many distinct clients the per-client window remembers. A hard bound,
#: because a spoofed `X-Forwarded-For` can mint a new key per request.
_MAX_TRACKED_CLIENTS = 10_000


class _SlidingWindow:
    """At most `limit` hits per `window` seconds for each key."""

    def __init__(self, limit: int, window: float) -> None:
        self.limit = limit
        self.window = window
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str, now: float) -> bool:
        """Record a hit for `key` and say whether it is within the limit."""
        cutoff = now - self.window
        if len(self._hits) >= _MAX_TRACKED_CLIENTS:
            self._hits = {
                k: hits for k, hits in self._hits.items() if hits and hits[-1] > cutoff
            }
            if len(self._hits) >= _MAX_TRACKED_CLIENTS:
                # That many live keys within one window are spoofed ones.
                # Forgetting them loosens nothing the global cap does not
                # still hold, and keeps this sweep from running on every call.
                self._hits.clear()

        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        return True


_per_client = _SlidingWindow(_PER_CLIENT_LIMIT, _HOUR)
_global = _SlidingWindow(_GLOBAL_LIMIT, _DAY)


def _too_many() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Wysłano zbyt wiele wiadomości. Spróbuj ponownie później.",
    )


def _client_key(request: Request) -> str:
    """The visitor's address as the proxy in front of us reports it.

    Render terminates connections itself, so the socket peer is the proxy and
    would put every visitor in one bucket. The left-most `X-Forwarded-For`
    entry is the original client — or a lie, which the global cap absorbs.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",", 1)[0].strip()
    if first:
        return first
    return request.client.host if request.client else "unknown"


def _for_the_log(payload: ContactRequest) -> str:
    """The whole inquiry on one line, so a lost lead can be read back out of
    the log. `%r` keeps a stranger's newlines from forging log lines."""
    return (
        f"name={payload.name!r} email={payload.email!r} "
        f"restaurant={payload.restaurant!r} language={payload.language!r} "
        f"message={payload.message!r}"
    )


@router.post("/contact", response_model=MessageResponse)
async def submit_contact(payload: ContactRequest, request: Request) -> MessageResponse:
    """Email a landing-page inquiry to the RestoLink inbox.

    200 once Resend has accepted it. 429 over a limit, 503 when the inbox or
    Resend is not configured, 502 when Resend fails. Every inquiry that is not
    delivered — except one over the per-client limit — is written to the log.
    """
    if payload.website:
        # Logged in full all the same: should a browser extension ever fill
        # the hidden field for a real person, their message is still here.
        logger.info("Contact form honeypot filled in; discarded: %s", _for_the_log(payload))
        return MessageResponse(message=_THANK_YOU)

    now = time.monotonic()
    client = _client_key(request)
    if not _per_client.allow(client, now):
        # The same sender has already had several messages through this hour,
        # so nothing new is lost by leaving this one out of the log.
        logger.warning("Contact form per-client limit reached for %s.", client)
        raise _too_many()
    if not _global.allow("*", now):
        logger.error(
            "Contact form daily cap reached — inquiry NOT sent: %s",
            _for_the_log(payload),
        )
        raise _too_many()

    try:
        await send_contact_inquiry(
            name=payload.name,
            email=payload.email,
            venue=payload.restaurant or None,
            message=payload.message,
            # Display-only, and unconstrained so it can never cost a lead.
            language=(payload.language or "")[:16] or None,
        )
    except EmailNotConfigured as exc:
        variable = str(exc)
        logger.error(
            "%s is not set — contact inquiry NOT sent: %s",
            variable,
            _for_the_log(payload),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Formularz kontaktowy jest chwilowo niedostępny "
                f"(brak konfiguracji: {variable})."
            ),
        ) from exc
    except EmailSendError as exc:
        logger.error("Contact inquiry NOT sent: %s", _for_the_log(payload))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.",
        ) from exc

    return MessageResponse(message=_THANK_YOU)
