-- 013: menu_note — the owner's own text between the menu's sections
-- (lunch hours, what a set menu consists of, a word about allergies).
--
-- OPTIONAL. Only a new table, no existing one is altered, so the deploy
-- creates `menu_note` on its own (create_all). Run it to create the table
-- ahead of time:
--
--     psql "<DATABASE_URL>" -f 013_add_menu_notes.sql
--
-- `sort_order` shares its numbering with menu_category.sort_order of the
-- same restaurant: one sequence places every section and every note.
--
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS menu_note (
    id            UUID PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurant(id),
    body          TEXT NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_menu_note_restaurant_id ON menu_note (restaurant_id);

COMMIT;
