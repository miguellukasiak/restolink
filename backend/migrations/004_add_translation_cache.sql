-- 004 — cache for machine-translated menu text
--
-- OPTIONAL, unlike 001 and 003. `translation_cache` is a brand-new table, and
-- SQLAlchemy's `create_all` — which this app runs on startup — does create
-- missing tables. It only refuses to touch tables that already exist, which is
-- why the earlier `ALTER TABLE` migrations had to be run by hand.
--
-- Run it only if you want the table to exist before the deploy lands, or if
-- `create_all` is ever disabled. It is identical to what the app would create.
--
--     psql "<DATABASE_URL>" -f 004_add_translation_cache.sql
--
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS translation_cache (
    id              UUID PRIMARY KEY,
    -- SHA-256 of the source string. Hashed rather than indexed directly: a
    -- btree entry is capped near 2.7 kB on Postgres and a long dish
    -- description in UTF-8 could reach it, turning a cache write into an error.
    source_hash     VARCHAR(64)  NOT NULL,
    original_text   TEXT         NOT NULL,
    target_lang     VARCHAR(8)   NOT NULL,
    translated_text TEXT         NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_translation_source_lang UNIQUE (source_hash, target_lang)
);

CREATE INDEX IF NOT EXISTS ix_translation_lookup
    ON translation_cache (source_hash, target_lang);

COMMIT;

-- Housekeeping, for later. Nothing expires these rows, which is the point —
-- but if a restaurant rewrites its menu, the old entries simply stop being
-- looked up. To reclaim the space:
--
--   DELETE FROM translation_cache WHERE created_at < now() - INTERVAL '1 year';
