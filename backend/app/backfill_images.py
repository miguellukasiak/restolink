"""One-off backfill: move Base64 images already in the database to Cloudinary.

Rows written *before* the Cloudinary integration still carry multi-megabyte
Data URIs in `menu_item.image_url` / `restaurant.logo_url`. This walks those
rows, uploads each image, and swaps in the short hosted URL.

SAFETY GUARANTEES (this script is deliberately paranoid — it runs against live
restaurant data that would be painful to recreate):

* It only ever issues ``UPDATE`` on the two image columns. There is no DELETE,
  no DROP, no schema change, and no other column is read-modify-written.
* Dry run by default. Nothing is written unless you pass ``--apply``.
* Before the first write it dumps every original value to a timestamped JSON
  backup; ``--restore <file>`` puts them all back verbatim.
* A row is updated only *after* its upload succeeds. If an upload fails the
  original Base64 stays exactly where it is and the script moves on.
* Idempotent and resumable: rows already holding an ``http(s)`` URL are skipped,
  so re-running it is harmless.

Usage (from the backend/ directory)::

    # 1. See what would change — touches nothing
    docker compose run --rm api python -m app.backfill_images

    # 2. Migrate a single row first, to be safe
    docker compose run --rm api python -m app.backfill_images --apply --limit 1

    # 3. Migrate everything
    docker compose run --rm api python -m app.backfill_images --apply

    # Undo, if you ever need to
    docker compose run --rm api python -m app.backfill_images --restore backup.json

To target production, point ``DATABASE_URL`` at the Render database (and set the
three ``CLOUDINARY_*`` variables) before running the same command.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from .cloudinary_service import ImageUploadError, is_configured, upload_image_if_needed
from .models import MenuItem, Restaurant

#: (model, primary-key column, image column, Cloudinary sub-folder)
TARGETS = [
    (MenuItem, "image_url", "dishes"),
    (Restaurant, "logo_url", "logos"),
]


def _normalize_db_url(raw: str) -> tuple[str, dict[str, Any]]:
    """Make a Render/Heroku-style URL usable by asyncpg.

    Those providers hand out ``postgres://...?sslmode=require``; SQLAlchemy needs
    the ``+asyncpg`` driver and asyncpg rejects ``sslmode`` as a query parameter
    (it wants ``ssl`` passed via connect args instead).
    """
    parts = urlsplit(raw)
    scheme = parts.scheme
    if scheme in {"postgres", "postgresql"}:
        scheme = "postgresql+asyncpg"

    query = dict(parse_qsl(parts.query))
    sslmode = query.pop("sslmode", None)
    connect_args: dict[str, Any] = {}
    if sslmode and sslmode not in {"disable", "allow"}:
        connect_args["ssl"] = True

    rebuilt = urlunsplit(
        (scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )
    return rebuilt, connect_args


def _is_base64(value: str | None) -> bool:
    return bool(value) and str(value).startswith("data:")


def _short(value: str, width: int = 46) -> str:
    return value if len(value) <= width else f"{value[:width]}…"


async def _collect(session) -> list[dict[str, Any]]:
    """Every live row whose image column still holds a Data URI."""
    found: list[dict[str, Any]] = []
    for model, column, folder in TARGETS:
        rows = (
            await session.scalars(
                select(model).where(model.deleted_at.is_(None))
            )
        ).all()
        for row in rows:
            value = getattr(row, column)
            if _is_base64(value):
                found.append(
                    {
                        "model": model,
                        "table": model.__tablename__,
                        "id": str(row.id),
                        "pk": row.id,
                        "column": column,
                        "folder": folder,
                        "value": value,
                        "name": getattr(row, "name", ""),
                    }
                )
    return found


def _write_backup(entries: list[dict[str, Any]], path: str) -> None:
    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "note": "Original Base64 image values captured before the Cloudinary backfill.",
        "entries": [
            {
                "table": e["table"],
                "id": e["id"],
                "column": e["column"],
                "value": e["value"],
            }
            for e in entries
        ],
    }
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle)


async def _run_backfill(session, args: argparse.Namespace) -> int:
    pending = await _collect(session)
    if args.limit:
        pending = pending[: args.limit]

    if not pending:
        print("Nothing to do — no Base64 images left in the database. ✅")
        return 0

    total_bytes = sum(len(e["value"]) for e in pending)
    print(f"Found {len(pending)} Base64 image(s), ~{total_bytes / 1_000_000:.2f} MB total:\n")
    for entry in pending:
        print(
            f"  • {entry['table']}.{entry['column']} "
            f"[{entry['name'] or entry['id']}] "
            f"{len(entry['value']) / 1000:.0f} kB"
        )

    if not args.apply:
        print(
            "\nDRY RUN — nothing was written. "
            "Re-run with --apply to perform the migration."
        )
        return 0

    if not is_configured():
        print(
            "\nERROR: Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET before using --apply.",
            file=sys.stderr,
        )
        return 1

    _write_backup(pending, args.backup)
    print(f"\nBackup of original values written to: {args.backup}")
    print("Migrating…\n")

    migrated = failed = 0
    for entry in pending:
        label = f"{entry['table']}[{entry['name'] or entry['id']}]"
        try:
            url = await upload_image_if_needed(entry["value"], folder=entry["folder"])
        except ImageUploadError as exc:
            failed += 1
            print(f"  ✗ {label}: upload failed, left untouched ({exc})")
            continue

        if not url or _is_base64(url):
            failed += 1
            print(f"  ✗ {label}: no URL returned, left untouched")
            continue

        # Writes exactly one column on exactly one row, then commits — so an
        # error later can never roll back work that already succeeded.
        await session.execute(
            update(entry["model"])
            .where(entry["model"].id == entry["pk"])
            .values(**{entry["column"]: url})
        )
        await session.commit()
        migrated += 1
        print(f"  ✓ {label}: {len(entry['value']) / 1000:.0f} kB → {_short(url)}")

    print(f"\nDone. Migrated {migrated}, failed {failed}, nothing deleted.")
    if failed:
        print("Failed rows kept their original Base64 — just re-run to retry them.")
    return 0


async def _run_restore(session, path: str) -> int:
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)

    by_table = {model.__tablename__: model for model, _, _ in TARGETS}
    restored = 0
    for entry in payload["entries"]:
        model = by_table.get(entry["table"])
        if model is None:
            print(f"  ! unknown table {entry['table']}, skipped")
            continue
        await session.execute(
            update(model)
            .where(model.id == entry["id"])
            .values(**{entry["column"]: entry["value"]})
        )
        await session.commit()
        restored += 1

    print(f"Restored {restored} original image value(s) from {path}.")
    return 0


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="actually write to the database (default is a dry run)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="only process the first N images (handy for a cautious first run)",
    )
    parser.add_argument(
        "--backup",
        default=f"backfill_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
        help="where to write the pre-migration backup of original values",
    )
    parser.add_argument(
        "--restore",
        metavar="FILE",
        help="restore original image values from a backup file and exit",
    )
    args = parser.parse_args()

    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        print("ERROR: DATABASE_URL is not set.", file=sys.stderr)
        return 1

    url, connect_args = _normalize_db_url(raw_url)
    engine = create_async_engine(url, echo=False, connect_args=connect_args)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as session:
            if args.restore:
                return await _run_restore(session, args.restore)
            return await _run_backfill(session, args)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
