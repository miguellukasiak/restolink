-- 012: restaurant.panel_language — the owner panel's second language.
--
-- REQUIRED before the deploy that makes the owner panel English with an
-- optional second language. The model maps this column, so without it every
-- query on `restaurant` — the public menu included — fails with
-- UndefinedColumn (CLAUDE.md §2.1).
--
--     psql "<DATABASE_URL>" -f 012_add_panel_language.sql
--
-- Every restaurant that exists today is Polish, so the column is added with
-- 'pl' filled in for them — their panel keeps a switch to Polish — and the
-- default is dropped straight after, so a restaurant HQ creates later gets
-- only what HQ chooses (NULL: English only).
--
-- Safe to run more than once: when the column already exists, ADD COLUMN IF
-- NOT EXISTS does nothing (it does not re-fill rows HQ has since set to NULL),
-- and dropping an absent default is a no-op.

ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS panel_language VARCHAR(8) DEFAULT 'pl';
ALTER TABLE restaurant ALTER COLUMN panel_language DROP DEFAULT;
