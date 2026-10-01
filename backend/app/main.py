"""FastAPI application entrypoint: lifespan (schema + seed), CORS, routers."""

import os
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .database import AsyncSessionLocal, engine
from . import panel_texts
from .messages import localize
from .panel_language import request_language
from .models import Base
from .routers import (
    admin,
    auth,
    billing,
    contact,
    dictionary,
    google_maps,
    languages,
    panel,
    panel_locales,
    public,
)
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Create tables (MVP; no migrations yet) and seed demo data if empty."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_if_empty(session)
        await session.commit()
    # The DeepL-made panel languages' messages and emails, for the handlers
    # below and the email service, which read them synchronously.
    async with AsyncSessionLocal() as session:
        await panel_texts.load(session)
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


# Messages are written in Polish where they are raised; the owner panel asks
# for English by default and gets each one swapped for its English version
# (messages.py). Only the text changes — status codes and shapes stay as they
# were, so no caller has to know this happens.


@app.exception_handler(StarletteHTTPException)
async def _localized_http_error(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, str):
        language = request_language(request.headers.get("accept-language"))
        exc = StarletteHTTPException(
            status_code=exc.status_code,
            detail=localize(exc.detail, language),
            headers=exc.headers,
        )
    return await http_exception_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def _localized_validation_error(request: Request, exc: RequestValidationError):
    """FastAPI's 422, with our own validators' messages localized.

    Pydantic prefixes a validator's message with "Value error, "; that prefix
    is dropped so the panel can show the sentence as it is.
    """
    language = request_language(request.headers.get("accept-language"))
    errors = []
    for error in exc.errors():
        error = dict(error)
        message = error.get("msg")
        if isinstance(message, str) and message.startswith("Value error, "):
            error["msg"] = localize(message.removeprefix("Value error, "), language)
        errors.append(error)
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(errors)})

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
app.include_router(languages.router)
app.include_router(google_maps.router)
app.include_router(billing.router)
# Unauthenticated by necessity: Stripe holds no token of ours, so the
# signature check on the raw body is the whole of its security.
app.include_router(billing.webhook_router)
app.include_router(public.router)
# HQ spends the DeepL quota on a panel language; anyone may read the result —
# it is interface text, and the sign-in pages need it before any session.
app.include_router(panel_locales.admin_router)
app.include_router(panel_locales.public_router)
# Also unauthenticated: the landing page's contact form. Rate-limited and
# honeypotted, because it is the one public route that sends an email.
app.include_router(contact.router)


@app.get("/health", tags=["Health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
