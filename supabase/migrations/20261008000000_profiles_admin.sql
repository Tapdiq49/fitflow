-- Administrators: a flag on the profile. Only an administrator may call the Edge Function `admin-users` (list users, change e-mail /
-- password / picture, delete). The function checks this flag on the server; the app only uses it to show or hide the menu entry.
-- Roles with finer permissions can replace the flag later (a `role` column or a roles table); the function is the single place that checks it.
-- Plain Postgres on purpose (backend-migration-rules.md).
--
-- Nobody can give themselves the flag: `authenticated` has UPDATE only on the columns granted in earlier migrations (username, avatar, ...),
-- and this column is not among them. Make the first administrator in the SQL Editor (see supabase/README.md):
--   update public.profiles set is_admin = true where email = 'you@example.com';
alter table public.profiles add column is_admin boolean not null default false;
