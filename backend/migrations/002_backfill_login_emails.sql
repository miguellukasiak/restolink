-- 002 — seed login identities from existing contact data
--
-- OPTIONAL, and a judgement call rather than a mechanical migration. Read this
-- before running it.
--
-- After 001 every existing restaurant has `email = NULL` and
-- `hashed_password = NULL`, which means none of them can sign in and none of
-- them can even request a password reset — "forgot password" looks up an
-- account *by* `email`.
--
-- This copies `contact_email` into `email`, which turns the reset flow into
-- the bootstrap: the owner asks for a reset, receives the mail at their
-- existing contact address, and sets a first password.
--
-- Consider before running:
--   * `contact_email` is public-facing contact data. If any row holds a shared
--     or generic address (kontakt@, info@, a marketing inbox), whoever reads
--     that inbox can take over the panel.
--   * Duplicates will abort the statement — the unique index is doing its job.
--     Inspect them first with the query at the bottom and fix by hand.
--
-- Run:  psql "<DATABASE_URL>" -f 002_backfill_login_emails.sql

BEGIN;

UPDATE restaurant
SET email = lower(trim(contact_email))
WHERE email IS NULL
  AND deleted_at IS NULL
  AND contact_email IS NOT NULL
  AND trim(contact_email) <> '';

COMMIT;

-- Find addresses shared by more than one live restaurant. Anything listed here
-- must be resolved by hand before the statement above can succeed.
--
--   SELECT lower(trim(contact_email)) AS address, count(*), array_agg(name)
--   FROM restaurant
--   WHERE deleted_at IS NULL
--   GROUP BY 1
--   HAVING count(*) > 1;
