-- 005 — owner-maintained translation dictionary
--
-- PARTLY REQUIRED. `create_all` builds missing *tables* but never alters an
-- existing one, so:
--
--   * `translation_dictionary` would be created automatically — the statement
--     below is here only so you can create it ahead of the deploy.
--   * `restaurant.base_language` would NOT be. Without it every query touching
--     the restaurant table fails with `UndefinedColumn`, which takes the public
--     menu down with it. Run this before the deploy lands.
--
--     psql "<DATABASE_URL>" -f 005_owner_translation_dictionary.sql
--
-- Safe to run more than once.

BEGIN;

-- REQUIRED. The language the menu is written in.
ALTER TABLE restaurant
    ADD COLUMN IF NOT EXISTS base_language VARCHAR(8) NOT NULL DEFAULT 'pl';

-- Optional (create_all would do this too).
CREATE TABLE IF NOT EXISTS translation_dictionary (
    id              UUID PRIMARY KEY,
    restaurant_id   UUID         NOT NULL REFERENCES restaurant (id),
    -- SHA-256 of original_text. Hashed rather than indexed directly: a btree
    -- entry is capped near 2.7 kB on Postgres and a long dish description in
    -- UTF-8 could reach it, turning a save into a hard error.
    source_hash     VARCHAR(64)  NOT NULL,
    original_text   TEXT         NOT NULL,
    target_lang     VARCHAR(8)   NOT NULL,
    translated_text TEXT         NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_dictionary_restaurant_source_lang
        UNIQUE (restaurant_id, source_hash, target_lang)
);

CREATE INDEX IF NOT EXISTS ix_dictionary_lookup
    ON translation_dictionary (restaurant_id, target_lang);

CREATE INDEX IF NOT EXISTS ix_translation_dictionary_restaurant_id
    ON translation_dictionary (restaurant_id);

COMMIT;

-- Cleanup, once you are satisfied the dictionary works. `translation_cache`
-- belonged to the background machine-translation worker, which is gone; nothing
-- reads or writes it any more. Left in place deliberately rather than dropped
-- here, because dropping a table is not something a migration should do to you
-- by surprise:
--
--   DROP TABLE IF EXISTS translation_cache;
--
-- Its contents are machine output and were never reviewed by an owner, so there
-- is nothing in there worth migrating into the new dictionary.
