-- 007 — individual HQ accounts, replacing the shared master password
--
-- OPTIONAL. `create_all` builds missing *tables*, and this migration only adds
-- one — no existing table is altered — so a deploy would create `admin_user`
-- on its own. It is here so you can create it ahead of time, and because the
-- bootstrap note at the bottom has to live somewhere.
--
--     psql "<DATABASE_URL>" -f 007_admin_users_rbac.sql
--
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS admin_user (
    id                  UUID PRIMARY KEY,
    -- Stored lower-cased; the login matches case-insensitively.
    email               VARCHAR(255) NOT NULL UNIQUE,
    hashed_password     VARCHAR(255) NOT NULL,
    -- The whole access model. FALSE is a real state rather than a disabled
    -- account: the credentials still work, they simply open nothing, and the
    -- row stays as a record of who the person was.
    is_superadmin       BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Tokens issued before this moment are refused, so a password change ends
    -- every other session. Same contract as restaurant.password_changed_at.
    password_changed_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_admin_user_email ON admin_user (email);

COMMIT;

-- BOOTSTRAP. The table starts empty and there is no sign-up screen for it, so
-- until the first account exists nobody can reach the HQ panel at all. Create
-- it with the CLI, which prompts for the password rather than taking it as an
-- argument (arguments land in shell history and in `ps`):
--
--     cd backend && python scripts/promote_admin.py you@example.com
--
-- The same command promotes an account that already exists. To revoke access
-- without deleting the person:
--
--     python scripts/promote_admin.py them@example.com --demote
--
-- SUPERADMIN_PASSWORD is no longer read by anything. Remove it from the Render
-- environment once the first real account works — leaving a retired secret in
-- place is how it ends up being reused somewhere it still opens a door.
