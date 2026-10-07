-- Age and sex complete the body data the daily calorie and protein suggestion is calculated from (with height and weight).
-- Plain Postgres: a later NestJS + Postgres move keeps the same columns. Null = not entered yet.
alter table public.profiles
  add column age smallint,
  add column sex text;

alter table public.profiles
  add constraint profiles_age_range check (age is null or (age >= 14 and age <= 90)),
  add constraint profiles_sex_valid check (sex is null or sex in ('male', 'female'));

-- The owner may change them (RLS policy profiles_update_own).
grant update (age, sex) on public.profiles to authenticated;
