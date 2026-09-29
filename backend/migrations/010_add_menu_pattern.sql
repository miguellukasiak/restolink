-- 010: restaurant.menu_pattern — the public menu's decorative background.
--
-- REQUIRED before the deploy that ships the theme gallery ("Wygląd menu").
-- The model maps this column, so without it every query on `restaurant` —
-- the public menu included — fails with UndefinedColumn (CLAUDE.md §2.1).
--
--     psql "<DATABASE_URL>" -f 010_add_menu_pattern.sql
--
-- Nullable, no default: NULL is a plain background, which is exactly what
-- every existing menu looks like today. Safe to run more than once.

ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS menu_pattern VARCHAR(32);
