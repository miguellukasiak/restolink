-- 018: Google Maps reviews are gone from RestoLink.
--
-- OPTIONAL, and only AFTER the deploy that removes them is live. The code
-- that shipped with 006 reads `restaurant.google_place_id`; dropping the
-- column while that code still runs turns every query on `restaurant` into
-- UndefinedColumn — the public menu included. The new code no longer knows
-- either object, so leaving them in place is harmless too; this only tidies
-- up the column and the cached reviews (nothing else points at them).
--
--     psql "<DATABASE_URL>" -f 018_drop_google_reviews.sql
--
-- Safe to run more than once.

BEGIN;

DROP TABLE IF EXISTS google_review_cache;
ALTER TABLE restaurant DROP COLUMN IF EXISTS google_place_id;

COMMIT;
