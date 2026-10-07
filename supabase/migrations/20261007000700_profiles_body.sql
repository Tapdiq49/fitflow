-- Height and starting weight belong to the person, so they live in the profile (the first app data moved off localStorage).
-- Plain Postgres on purpose; a later NestJS + Postgres move keeps the same columns.
-- Null = not entered yet (the app asks for them).
alter table public.profiles
  add column height_cm numeric(4, 1),
  add column start_weight_kg numeric(4, 1);

alter table public.profiles
  add constraint profiles_height_range check (height_cm is null or (height_cm >= 100 and height_cm <= 250)),
  add constraint profiles_start_weight_range check (start_weight_kg is null or (start_weight_kg >= 30 and start_weight_kg <= 300));

-- The owner may change them (RLS policy profiles_update_own).
grant update (height_cm, start_weight_kg) on public.profiles to authenticated;
