-- 011: restaurant.menu_languages — which languages the guest menu offers.
--
-- REQUIRED before the deploy that ships the "Języki" map. The model maps this
-- column, so without it every query on `restaurant` — the public menu
-- included — fails with UndefinedColumn (CLAUDE.md §2.1).
--
--     psql "<DATABASE_URL>" -f 011_add_menu_languages.sql
--
-- Nullable, no default, deliberately: NULL means "from before this was a
-- choice" and keeps offering the four languages every guest menu listed until
-- now (en, de, fr, es), so no existing menu changes when this runs. Restaurants
-- created afterwards start with English, set by the application. Safe to run
-- more than once.

ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS menu_languages JSONB;
