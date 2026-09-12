"""Cloudinary image hosting.

Images used to be persisted as Base64 Data URIs straight into Postgres, which
made every menu payload enormous (a single dish photo can be megabytes) and was
the root cause of the slow menu loads. Now the browser still *sends* a Data URI
(the cropper output), but the API uploads it to Cloudinary and stores only the
short `secure_url` in the database.

Configuration comes exclusively from the environment — never hardcode keys:

    CLOUDINARY_CLOUD_NAME
    CLOUDINARY_API_KEY
    CLOUDINARY_API_SECRET
"""

import logging
import os
import re

import cloudinary
import cloudinary.uploader
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

#: Everything the app uploads lands under this Cloudinary folder.
UPLOAD_FOLDER = "restolink"

#: Params injected into every Cloudinary URL we hand out. `w_600` matches the
#: frontend cropper's output size, while `q_auto`/`f_auto` let Cloudinary choose
#: the quality and the codec (WebP/AVIF) per requesting browser.
DELIVERY_TRANSFORMATION = "w_600,q_auto,f_auto"

_CLOUDINARY_HOST = "res.cloudinary.com"
_UPLOAD_MARKER = "/image/upload/"
#: The `v1785868265` segment Cloudinary puts in front of the public id.
_VERSION_RE = re.compile(r"^v\d+$")

cloudinary.config(
    cloud_name=CLOUD_NAME,
    api_key=API_KEY,
    api_secret=API_SECRET,
    secure=True,
)


class ImageUploadError(RuntimeError):
    """Raised when Cloudinary rejects or fails an upload."""


def is_configured() -> bool:
    """True when all three Cloudinary credentials are present in the env."""
    return bool(CLOUD_NAME and API_KEY and API_SECRET)


def _is_data_uri(value: str) -> bool:
    """Data URIs are what the frontend cropper produces (`data:image/jpeg;base64,...`)."""
    return value.startswith("data:")


def _split_upload_url(url: str) -> tuple[str, str] | None:
    """Split a Cloudinary delivery URL around its `/image/upload/` marker.

    Returns ``(everything up to and including the marker, the rest)``, or
    ``None`` for anything that isn't a Cloudinary delivery URL — Data URIs,
    externally hosted images, or a URL shape we don't recognise. Callers treat
    ``None`` as "leave this value completely alone".
    """
    if _CLOUDINARY_HOST not in url:
        return None
    head, marker, tail = url.partition(_UPLOAD_MARKER)
    if not marker or not tail:
        return None
    return head + marker, tail


def _has_transformation(remainder: str) -> bool:
    """True when the path after `/image/upload/` already carries params.

    Cloudinary URLs are ``/upload/[<transformations>/]v<version>/<public_id>``,
    so the first segment is a transformation unless it's the version. Uploads
    from this app always include a version, which makes that check reliable
    here; anything ambiguous is reported as "already transformed" so we err
    towards leaving a URL untouched rather than mangling it.
    """
    first = remainder.split("/", 1)[0]
    if not first or _VERSION_RE.match(first):
        return False
    return "_" in first


def with_delivery_transformation(url: str | None) -> str | None:
    """Add on-the-fly resize/compression params to a Cloudinary URL.

    The backfill pushed the *originals* to Cloudinary — several are 2+ MB PNGs —
    and the stored URL serves them byte for byte. Injecting the transformation
    on the way out makes Cloudinary resize and re-encode on delivery (then cache
    the result), which took the Pepik Pub menu from 13.1 MB of images to 0.5 MB
    without re-uploading anything or touching the database.

    Applying this is always safe: non-Cloudinary values pass through untouched,
    and a URL that already carries params is returned as-is, so the function is
    idempotent even if a value goes through it more than once.
    """
    if not url:
        return url

    split = _split_upload_url(url)
    if split is None:
        return url

    prefix, remainder = split
    if _has_transformation(remainder):
        return url
    return f"{prefix}{DELIVERY_TRANSFORMATION}/{remainder}"


def without_delivery_transformation(url: str | None) -> str | None:
    """Strip our own delivery params, recovering the canonical stored URL.

    Saving a dish in the panel echoes its existing ``image_url`` straight back,
    and by then the value has already been through
    `with_delivery_transformation`. Normalising on write keeps the pristine
    original in the database, so the transformation stays a presentation detail
    that can be changed at any time. Only our exact param string is removed —
    a transformation someone added by hand is left alone.
    """
    if not url:
        return url

    split = _split_upload_url(url)
    if split is None:
        return url

    prefix, remainder = split
    first, separator, rest = remainder.partition("/")
    if first == DELIVERY_TRANSFORMATION and separator and rest:
        return prefix + rest
    return url


async def upload_image_if_needed(image: str | None, *, folder: str) -> str | None:
    """Return a hosted image URL for `image`, uploading it only when necessary.

    - ``None`` / empty  -> ``None`` (dish simply has no photo).
    - already an URL    -> returned as-is, minus any delivery params we added on
      the way out. This matters: editing a dish without touching its photo sends
      the *existing* URL back, and re-uploading that every save would be pure
      waste — while persisting it verbatim would bake presentation params into
      the database.
    - a Data URI        -> uploaded to Cloudinary; its ``secure_url`` is returned.

    The Cloudinary SDK is synchronous, so the call is pushed to a worker thread
    to avoid blocking the event loop (it would stall every other request).
    """
    if not image:
        return None

    if not _is_data_uri(image):
        return without_delivery_transformation(image)

    if not is_configured():
        # Don't hard-fail local/dev environments that have no credentials —
        # but make it obvious, because this silently reintroduces the very
        # payload bloat this module exists to remove.
        logger.warning(
            "Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / _API_KEY / "
            "_API_SECRET missing) — storing the raw Base64 image instead. "
            "Set these environment variables to enable image hosting."
        )
        return image

    try:
        result = await run_in_threadpool(
            cloudinary.uploader.upload,
            image,
            folder=f"{UPLOAD_FOLDER}/{folder}",
            resource_type="image",
        )
    except Exception as exc:  # noqa: BLE001 — SDK raises a variety of errors
        logger.exception("Cloudinary upload failed")
        raise ImageUploadError(str(exc)) from exc

    secure_url = result.get("secure_url")
    if not secure_url:
        raise ImageUploadError("Cloudinary response did not contain a secure_url.")
    return secure_url
