-- 015: panel_locale — the owner panel in languages DeepL translates.
--
-- OPTIONAL. Only a new table, no existing one is altered, so the deploy
-- creates `panel_locale` on its own (create_all). Run it to create the table
-- ahead of time:
--
--     psql "<DATABASE_URL>" -f 015_add_panel_locales.sql
--
-- One row per panel language HQ has chosen beyond the hand-written Polish:
-- the panel's strings and the English they came from, the server's messages
-- and the owner emails, all as JSON.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS panel_locale (
    code       VARCHAR(8) PRIMARY KEY,
    strings    JSONB NOT NULL DEFAULT '{}'::jsonb,
    sources    JSONB NOT NULL DEFAULT '{}'::jsonb,
    messages   JSONB NOT NULL DEFAULT '{}'::jsonb,
    emails     JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
