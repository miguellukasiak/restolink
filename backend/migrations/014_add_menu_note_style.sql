-- 014: menu_note.style — how a note looks (icon, frame, alignment).
--
-- REQUIRED before the deploy that brings the richer note editor. The model
-- maps this column, so without it every query on `menu_note` — the public
-- menu included — fails with UndefinedColumn (CLAUDE.md §2.1). The table
-- itself came with the previous deploy (create_all, or 013).
--
--     psql "<DATABASE_URL>" -f 014_add_menu_note_style.sql
--
-- Existing notes get '{}', which reads as the look they have today: the info
-- icon, the tinted frame, left-aligned (NoteStyle's defaults).
--
-- Safe to run more than once.

ALTER TABLE menu_note ADD COLUMN IF NOT EXISTS style JSONB NOT NULL DEFAULT '{}'::jsonb;
