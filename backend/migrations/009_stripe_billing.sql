-- 009 — Stripe subscription billing
--
-- PARTLY REQUIRED. `create_all` builds missing *tables* but never alters an
-- existing one, and this migration alters two:
--
--   * `restaurant.stripe_customer_id` would NOT be created. Without it every
--     query touching the restaurant table fails with `UndefinedColumn`, which
--     takes the public menu down with it. Run this before the deploy lands.
--   * the unique index on `payment_history.external_transaction_id` would not
--     be created either, and it is what makes the webhook idempotent.
--
--     psql "<DATABASE_URL>" -f 009_stripe_billing.sql
--
-- Safe to run more than once.

BEGIN;

-- REQUIRED. The Stripe customer a restaurant pays as, remembered at the first
-- successful checkout. Renewals arrive as `invoice.payment_succeeded`, and an
-- invoice carries no client_reference_id — that field exists only on the
-- Checkout Session. Without this column, every month-two payment would be an
-- event we can verify but not attribute to anyone.
ALTER TABLE restaurant
    ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS ix_restaurant_stripe_customer_id
    ON restaurant (stripe_customer_id);

-- REQUIRED for correctness rather than for the app to boot. Stripe retries a
-- webhook until it gets a 2xx, and one payment legitimately arrives twice over
-- (checkout.session.completed and invoice.payment_succeeded both describe the
-- first month). The handler stores the event id here and refuses to act on an
-- id it has seen; this index is what makes that a guarantee instead of a race
-- between two retries landing in the same second.
--
-- Partial, because manual payments have no external id and several NULLs must
-- stay legal.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_external_transaction_id
    ON payment_history (external_transaction_id)
    WHERE external_transaction_id IS NOT NULL;

COMMIT;

-- Environment variables required by the endpoints (server-side only — the
-- secret key and the signing secret must never reach the browser):
--
--   STRIPE_API_KEY          sk_… secret key
--   STRIPE_WEBHOOK_SECRET   whsec_… signing secret for THIS endpoint
--   STRIPE_PRICE_ID         price_… the recurring price to subscribe to
--   APP_BASE_URL            already set; builds the success and cancel URLs
--
-- The webhook endpoint is POST /api/v1/webhooks/stripe. Register it in the
-- Stripe dashboard for `checkout.session.completed` and
-- `invoice.payment_succeeded`, and take the signing secret from there — each
-- endpoint has its own, and the key from a different one will never verify.
--
-- Without STRIPE_WEBHOOK_SECRET the endpoint answers 500 and refuses to act.
-- That is deliberate: a webhook that skipped signature verification would be
-- an unauthenticated way to mark any restaurant as paid.
