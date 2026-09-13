-- 003 — retire access tokens issued before a password change
--
-- REQUIRED, for the same reason as 001: `create_all` never adds columns to a
-- table that already exists.
--
-- Access tokens are stateless JWTs that live for seven days, so until now a
-- password reset left every existing session running — including whoever the
-- reset was meant to evict. `get_current_restaurant` now refuses any token
-- minted before this timestamp.
--
-- Run against the production database:
--     psql "<DATABASE_URL>" -f 003_add_password_changed_at.sql
--
-- Safe to run more than once.

BEGIN;

-- Deliberately left NULL for existing rows. NULL means "never changed", and
-- every current token keeps working. Backfilling it with now() would instead
-- sign out every owner the moment this deploys — a rude surprise, and one that
-- buys nothing: those sessions predate the feature and no reset has happened
-- to invalidate them.
ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

COMMIT;
