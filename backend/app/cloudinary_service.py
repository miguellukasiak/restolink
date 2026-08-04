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

import cloudinary
import cloudinary.uploader
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

#: Everything the app uploads lands under this Cloudinary folder.
UPLOAD_FOLDER = "restolink"

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


async def upload_image_if_needed(image: str | None, *, folder: str) -> str | None:
    """Return a hosted image URL for `image`, uploading it only when necessary.

    - ``None`` / empty  -> ``None`` (dish simply has no photo).
    - already an URL    -> returned untouched. This matters: editing a dish
      without touching its photo sends the *existing* ``https://`` URL back, and
      re-uploading that every save would be pure waste.
    - a Data URI        -> uploaded to Cloudinary; its ``secure_url`` is returned.

    The Cloudinary SDK is synchronous, so the call is pushed to a worker thread
    to avoid blocking the event loop (it would stall every other request).
    """
    if not image:
        return None

    if not _is_data_uri(image):
        return image

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
