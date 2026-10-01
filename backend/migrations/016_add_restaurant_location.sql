-- 016: where a restaurant is — country, address and the menu's currency.
--
-- REQUIRED before the deploy that ships it. These are new columns on an
-- existing table, which create_all never adds: without them every query on
-- `restaurant` fails with UndefinedColumn, the public menu included.
--
--     psql "<DATABASE_URL>" -f 016_add_restaurant_location.sql
--
-- Every existing restaurant is in Poland and prices in złoty, which is what
-- the app assumed until now; HQ corrects any that are not.
--
-- Safe to run more than once.

ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS country  VARCHAR(2) NOT NULL DEFAULT 'PL';
ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS address  VARCHAR(300);
ALTER TABLE restaurant ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'PLN';
