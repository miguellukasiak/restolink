"""FastAPI application entrypoint: lifespan (schema + seed), CORS, routers."""

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import AsyncSessionLocal, engine
from .models import Base
from .routers import admin, panel, public
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


app = FastAPI(title="RestoLink SaaS API", version="1.0.0", lifespan=lifespan)

# CORS: explicit allow-list (local Vite dev + known Vercel domains) PLUS a regex
# that matches every Vercel deployment/preview URL — those get random hashes like
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
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(panel.router)
app.include_router(public.router)


@app.get("/health", tags=["Health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
