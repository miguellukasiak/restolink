"""FastAPI application entrypoint: lifespan (schema + seed), CORS, routers."""

import os
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import AsyncSessionLocal, engine
from .models import Base
from .routers import admin, auth, billing, contact, dictionary, google_maps, panel, public
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Create tables (MVP; no migrations yet) and seed demo data if empty."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_if_empty(session)
        await session.commit()
    yield
    await engine.dispose()


def extra_cors_origins() -> list[str]:
    """Origins from `CORS_ALLOWED_ORIGINS`, comma-separated.

    This is how the landing page's own domain gets in: it lives on a static
    host outside Vercel, and its contact form posts JSON here. A browser sends
    `Origin` without a trailing slash, so one pasted with a slash is trimmed
    rather than left to never match.
    """
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


app = FastAPI(title="RestoLink SaaS API", version="1.0.0", lifespan=lifespan)

# CORS: explicit allow-list (local Vite dev + known Vercel domains + whatever
# `CORS_ALLOWED_ORIGINS` adds) PLUS a regex that matches every Vercel
# deployment/preview URL — those get random hashes like
# `restolink-<hash>-restolink.vercel.app`, so hard-coding one is never enough.
# `allow_credentials=False`, so the wildcard-style regex is safe (no cookies are
# sent cross-origin); if credentials were ever needed, drop the regex and list
# the exact domains instead.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://restolink-vert.vercel.app",
        "https://restolink-g0go1wnam-restolink.vercel.app",
        *extra_cors_origins(),
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(panel.router)
app.include_router(dictionary.router)
app.include_router(google_maps.router)
app.include_router(billing.router)
# Unauthenticated by necessity: Stripe holds no token of ours, so the
# signature check on the raw body is the whole of its security.
app.include_router(billing.webhook_router)
app.include_router(public.router)
# Also unauthenticated: the landing page's contact form. Rate-limited and
# honeypotted, because it is the one public route that sends an email.
app.include_router(contact.router)


@app.get("/health", tags=["Health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
