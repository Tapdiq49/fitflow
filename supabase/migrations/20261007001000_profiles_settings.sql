-- The app settings of a person (theme, language, menu mode, workout mode, targets, times, ...), all of them, so every device shows the same.
-- Plain Postgres (a jsonb document); a later NestJS + Postgres move keeps the same column. Null = nothing saved yet.
alter table public.profiles
  add column settings jsonb;

alter table public.profiles
  add constraint profiles_settings_shape check (settings is null or (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 20000));

-- The owner may change it (RLS policy profiles_update_own).
grant update (settings) on public.profiles to authenticated;
