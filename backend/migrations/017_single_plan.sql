-- 017: every restaurant on the one plan RestoLink sells.
--
-- OPTIONAL — data only, no schema change; the deploy works without it. HQ no
-- longer picks a plan: new restaurants go on "Standard" (app/plans.py), made
-- on first use. Restaurants created before were put on one of the demo
-- seed's tiers ("Podstawowy", "Wyższy", "Premium") by whoever filled in the
-- form. Nothing reads the plan today, but the day tiers mean something, a
-- "Premium" picked at random would hand out what nobody paid for. This puts
-- everyone on "Standard" and retires the demo tiers (soft-deleted, so any
-- history pointing at them stays valid).
--
--     psql "<DATABASE_URL>" -f 017_single_plan.sql
--
-- Safe to run more than once.

BEGIN;

INSERT INTO subscription_package (id, name)
SELECT gen_random_uuid(), 'Standard'
WHERE NOT EXISTS (
    SELECT 1 FROM subscription_package
    WHERE name = 'Standard' AND deleted_at IS NULL
);

UPDATE restaurant
SET package_id = (
    SELECT id FROM subscription_package
    WHERE name = 'Standard' AND deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1
)
WHERE package_id IS DISTINCT FROM (
    SELECT id FROM subscription_package
    WHERE name = 'Standard' AND deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1
);

UPDATE subscription_package
SET deleted_at = now()
WHERE deleted_at IS NULL
  AND id <> (
    SELECT id FROM subscription_package
    WHERE name = 'Standard' AND deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1
  );

COMMIT;
