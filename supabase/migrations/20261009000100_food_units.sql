-- More units for foods: millilitres, tablespoons and teaspoons next to grams, pieces and scoops.
-- In the app: ml, x/q (tablespoon, "yemək qaşığı") and ç.q (teaspoon, "çay qaşığı"); see Unit in src/app/common/interfaces/food/food.ts.
-- The numbers of a food in 'g' and 'ml' are per 100 of them; in every other unit they are per one. Plain Postgres: only the check changes.
alter table public.foods drop constraint foods_unit_valid;
alter table public.foods add constraint foods_unit_valid check (unit in ('g', 'ml', 'piece', 'tbsp', 'tsp', 'scoop'));
