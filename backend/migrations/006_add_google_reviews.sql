-- 006 — Google Maps reviews dashboard
--
-- PARTLY REQUIRED. `create_all` builds missing *tables* but never alters an
-- existing one, so:
--
--   * `google_review_cache` would be created automatically — the statement
--     below is here only so you can create it ahead of the deploy.
--   * `restaurant.google_place_id` would NOT be. Without it every query
--     touching the restaurant table fails with `UndefinedColumn`, which takes
--     the public menu down with it. Run this before the deploy lands.
--
--     psql "<DATABASE_URL>" -f 006_add_google_reviews.sql
--
-- Safe to run more than once.

BEGIN;

-- REQUIRED. The restaurant's listing on Google Maps. NULL = not connected yet.
ALTER TABLE restaurant
    ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255);

-- Optional (create_all would do this too).
--
-- One row per restaurant: this is a snapshot, not a history. The UNIQUE
-- constraint on restaurant_id is what makes the refresh an in-place update
-- rather than an ever-growing pile of daily copies.
CREATE TABLE IF NOT EXISTS google_review_cache (
    id            UUID PRIMARY KEY,
    restaurant_id UUID        NOT NULL UNIQUE REFERENCES restaurant (id),
    -- The listing this snapshot describes. Compared against the restaurant's
    -- current google_place_id on every read: an owner who pastes the wrong
    -- place and corrects it would otherwise keep seeing the other
    -- restaurant's reviews until the day-old cache expired.
    place_id      VARCHAR(255),
    -- NULL for a listing that has no ratings yet — distinct from 0.0, which
    -- would read as "rated, and terribly".
    rating        DOUBLE PRECISION,
    total_ratings INTEGER     NOT NULL DEFAULT 0,
    reviews_data  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- When the data was fetched. The 24-hour freshness check reads this, and
    -- the panel shows it as "last synced".
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_google_review_cache_restaurant_id
    ON google_review_cache (restaurant_id);

COMMIT;

-- Environment variable required by the endpoints (server-side only — the key
-- must never reach the browser, where it could be lifted and spent against
-- your quota):
--
--   GOOGLE_MAPS_API_KEY   a Google Cloud key with the Places API enabled
--
-- Without it GET /google-reviews answers 503 with a message naming the
-- variable, and the panel shows that instead of a blank screen. Restrict the
-- key to the Places API in the Cloud console; an unrestricted key is a blank
-- cheque if it ever leaks.
