"""Shared test fixtures.

The suite runs against a throwaway SQLite file rather than Postgres, so it needs
no container and no credentials. Two Postgres-only column types are taught a
local equivalent, which lets the real models be used verbatim instead of
mirrored — a mirrored schema is a second source of truth that drifts.

Requires the dev extras:

    pip install -r requirements-dev.txt
"""

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import pytest_asyncio

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

# Set before importing anything that reads configuration at import time.
_DB_FILE = Path(__file__).resolve().parent / "_test.db"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///" + _DB_FILE.as_posix()
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-at-least-32-bytes-long!!")

from sqlalchemy.dialects.postgresql import JSONB, UUID  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402

compiles(JSONB, "sqlite")(lambda type_, compiler, **kw: "JSON")
compiles(UUID, "sqlite")(lambda type_, compiler, **kw: "CHAR(36)")

from app.database import AsyncSessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    Base,
    Restaurant,
    RestaurantStatus,
    SubscriptionPackage,
)


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest_asyncio.fixture
async def db_engine():
    """A fresh schema per test, so no test can depend on another's leftovers.

    The schema is dropped and rebuilt rather than the file being deleted:
    SQLAlchemy's pool keeps the SQLite file open, and on Windows an open handle
    makes `unlink` fail outright. Disposing the pool afterwards releases the
    handle so the next test starts clean; the engine builds a new pool lazily.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session(db_engine):
    async with AsyncSessionLocal() as db:
        yield db


@pytest_asyncio.fixture
async def restaurant(db_engine) -> Restaurant:
    """A PENDING restaurant with an expiry already in the past.

    Both halves matter: PENDING is what hides the public menu, and a stale
    expiry is what a renewal has to extend from without shortening anything.
    """
    package_id = uuid.uuid4()
    restaurant_id = uuid.uuid4()
    async with AsyncSessionLocal() as db:
        db.add(SubscriptionPackage(id=package_id, name="Premium"))
        db.add(
            Restaurant(
                id=restaurant_id,
                name="Karczma Pod Lipą",
                contact_email="wlasciciel@karczma.pl",
                contact_phone="+48 500 100 200",
                package_id=package_id,
                status=RestaurantStatus.PENDING,
                subscription_valid_until=datetime.now(timezone.utc)
                - timedelta(days=3),
                email="wlasciciel@karczma.pl",
                hashed_password="$2b$12$placeholder",
            )
        )
        await db.commit()

    async with AsyncSessionLocal() as db:
        return await db.get(Restaurant, restaurant_id)
