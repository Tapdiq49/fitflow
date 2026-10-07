-- Profile picture: a small JPEG (the app resizes it to 160 x 160, about 10 kB) kept as a data URL in the profile row.
-- Plain Postgres on purpose: no Storage bucket needed, and nothing changes for a later NestJS + Postgres move.
alter table public.profiles add column avatar text;

alter table public.profiles
  add constraint profiles_avatar_format
  check (avatar is null or (avatar like 'data:image/jpeg;base64,%' and length(avatar) <= 60000));

-- Same rule as the other editable columns: the owner may change it (RLS policy profiles_update_own).
grant update (avatar) on public.profiles to authenticated;
