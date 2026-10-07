-- Fields the menu generator needs for a system food: which kind of food it is (role), the portion step and the allowed
-- portion range. They live next to the food so the generator can use the backend list (and a cached copy of it offline).
-- User foods never have them. Units: same as foods.unit (grams for 'g', pieces / scoops otherwise).
alter table public.foods
  add column role text,
  add column step numeric(6, 1),
  add column min_amount numeric(6, 1),
  add column max_amount numeric(6, 1);

update public.foods as f
set role = v.role, step = v.step, min_amount = v.min_amount, max_amount = v.max_amount
from (values
  ('egg', 'protein', 1, 1, 4),
  ('eggwhite', 'protein', 1, 1, 6),
  ('chicken', 'protein', 20, 80, 250),
  ('thigh', 'protein', 20, 80, 220),
  ('beef', 'protein', 20, 80, 220),
  ('fish', 'protein', 25, 100, 300),
  ('tuna', 'protein', 20, 80, 200),
  ('cottage', 'protein', 25, 100, 300),
  ('yogurt', 'dairy', 50, 100, 300),
  ('kefir', 'dairy', 50, 150, 400),
  ('milk', 'dairy', 50, 100, 300),
  ('cheese', 'fat', 10, 10, 40),
  ('oats', 'carb', 10, 40, 100),
  ('rice', 'carb', 25, 100, 350),
  ('potato', 'carb', 50, 150, 400),
  ('buckwheat', 'carb', 25, 100, 300),
  ('pasta', 'carb', 25, 100, 280),
  ('bulgur', 'carb', 25, 100, 300),
  ('bread', 'carb', 20, 40, 120),
  ('lavash', 'carb', 10, 40, 100),
  ('banana', 'fruit', 1, 1, 2),
  ('apple', 'fruit', 1, 1, 1),
  ('kiwi', 'fruit', 1, 1, 3),
  ('orange', 'fruit', 1, 1, 2),
  ('berries', 'fruit', 50, 50, 200),
  ('dates', 'carb', 10, 20, 60),
  ('honey', 'carb', 5, 5, 25),
  ('almond', 'fat', 5, 10, 30),
  ('walnut', 'fat', 5, 10, 25),
  ('hazelnut', 'fat', 5, 10, 25),
  ('oil', 'fat', 5, 5, 15),
  ('salad', 'veg', 50, 100, 250),
  ('vegs', 'veg', 50, 100, 250),
  ('broccoli', 'veg', 50, 100, 200),
  ('lentil', 'carb', 25, 100, 200),
  ('pb', 'fat', 5, 10, 20),
  ('whey', 'supp', 1, 1, 2)
) as v (code, role, step, min_amount, max_amount)
where f.user_id is null and f.code = v.code;

alter table public.foods
  add constraint foods_role_valid check (role is null or role in ('protein', 'carb', 'fat', 'fruit', 'veg', 'dairy', 'supp')),
  -- A system row is complete (the generator needs every field); a user row has none of them.
  add constraint foods_generator_fields check (
    (user_id is null and role is not null and step > 0 and min_amount > 0 and max_amount >= min_amount)
    or (user_id is not null and role is null and step is null and min_amount is null and max_amount is null)
  );
