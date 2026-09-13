-- 001 — sign-in credentials on `restaurant`
--
-- REQUIRED before the auth endpoints work against an existing database.
--
-- The app creates its schema with SQLAlchemy's `create_all`, which only ever
-- creates *missing tables*. It will happily create the new `password_reset`
-- table on the next deploy, but it will NOT add columns to `restaurant` —
-- that table already exists, so it is left untouched and every login would
-- fail with "column restaurant.email does not exist".
--
-- Run against the production database (Render → Connect → PSQL Command):
--     psql "<DATABASE_URL>" -f 001_add_auth_columns.sql
--
-- Safe to run more than once: every statement is IF NOT EXISTS.

BEGIN;

ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);

-- Unique, but nullable: restaurants created before auth existed have no
-- credentials yet, and Postgres allows any number of NULLs under a UNIQUE
-- index. A partial index would work too; this keeps it identical to what
-- `create_all` would have produced on a fresh database.
CREATE UNIQUE INDEX IF NOT EXISTS ix_restaurant_email ON restaurant (email);

COMMIT;
