-- Roles and permissions. Every page and action of the app is a row of `permissions` (`<module>.<action>`, e.g. workout.view);
-- a role is a named set of permissions; every account has exactly one role (profiles.role_id).
-- Plain Postgres on purpose (backend-migration-rules.md). NestJS equivalent: the same three tables and a guard that reads the
-- permissions of the caller's role; the checks on the server are in the Edge Function `admin-users` today.
--
-- Built-in roles: `admin` (everything, cannot be changed or deleted) and `user` (the whole app, no administration; every new
-- account gets it). More roles are created on the roles page. A new permission = a new row here AND the same id in
-- src/app/common/interfaces/permissions/permissions.ts.
--
-- Nobody can change these tables or their own role from the app: `authenticated` may only read them; writes go through the Edge
-- Function (service role). The first administrator is made in the SQL Editor:
--   update public.profiles set role_id = 'admin' where email = 'you@example.com';

create table public.permissions (
  id     text primary key check (id ~ '^[a-z]+\.[a-z_]+$'),
  module text not null,
  action text not null,
  sort   integer not null
);

create table public.roles (
  id          text primary key check (id ~ '^[a-z0-9_]{2,30}$'),
  name        text not null check (length(btrim(name)) between 1 and 60),
  description text not null default '' check (length(description) <= 200),
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role_id       text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create index role_permissions_permission_idx on public.role_permissions (permission_id);

-- Built-in roles cannot be deleted. (That the administrator role keeps every permission is enforced by the Edge Function, the
-- only writer of these tables.)
create function public.protect_system_roles() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_system then
    raise exception 'built-in role' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger roles_protect_delete
  before delete on public.roles
  for each row execute function public.protect_system_roles();

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone signed in may read; nobody writes from the client
-- ---------------------------------------------------------------------------
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;

create policy permissions_read on public.permissions for select to authenticated using (true);
create policy roles_read on public.roles for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);

grant select on public.permissions, public.roles, public.role_permissions to authenticated;

-- ---------------------------------------------------------------------------
-- The catalog
-- ---------------------------------------------------------------------------
insert into public.permissions (id, module, action, sort) values
  ('today.view', 'today', 'view', 10),
  ('today.edit', 'today', 'edit', 11),
  ('workout.view', 'workout', 'view', 20),
  ('workout.edit', 'workout', 'edit', 21),
  ('plan.view', 'plan', 'view', 30),
  ('plan.edit', 'plan', 'edit', 31),
  ('body.view', 'body', 'view', 40),
  ('body.edit', 'body', 'edit', 41),
  ('supplements.view', 'supplements', 'view', 50),
  ('supplements.edit', 'supplements', 'edit', 51),
  ('calendar.view', 'calendar', 'view', 60),
  ('references.view', 'references', 'view', 70),
  ('references.edit', 'references', 'edit', 71),
  ('settings.view', 'settings', 'view', 80),
  ('settings.edit', 'settings', 'edit', 81),
  ('settings.export', 'settings', 'export', 82),
  ('settings.import', 'settings', 'import', 83),
  ('settings.reset', 'settings', 'reset', 84),
  ('profile.view', 'profile', 'view', 90),
  ('profile.edit', 'profile', 'edit', 91),
  ('display.edit', 'display', 'edit', 100),
  ('users.view', 'users', 'view', 110),
  ('users.edit_email', 'users', 'edit_email', 111),
  ('users.edit_password', 'users', 'edit_password', 112),
  ('users.edit_avatar', 'users', 'edit_avatar', 113),
  ('users.assign_role', 'users', 'assign_role', 114),
  ('users.delete', 'users', 'delete', 115),
  ('roles.view', 'roles', 'view', 120),
  ('roles.create', 'roles', 'create', 121),
  ('roles.edit', 'roles', 'edit', 122),
  ('roles.delete', 'roles', 'delete', 123);

insert into public.roles (id, name, description, is_system) values
  ('admin', 'Administrator', 'Hər şeyə icazəsi var. Dəyişdirilə və silinə bilməz.', true),
  ('user', 'İstifadəçi', 'Bütün tətbiq. Yeni hesablar bu rolu alır.', true);

insert into public.role_permissions (role_id, permission_id) select 'admin', id from public.permissions;
insert into public.role_permissions (role_id, permission_id) select 'user', id from public.permissions where module not in ('users', 'roles');

-- ---------------------------------------------------------------------------
-- Every account has one role. Existing accounts get `user`; the administrators of the first version (profiles.is_admin) get `admin`.
-- ---------------------------------------------------------------------------
alter table public.profiles add column role_id text not null default 'user' references public.roles (id);
create index profiles_role_idx on public.profiles (role_id);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin') then
    update public.profiles set role_id = 'admin' where is_admin;
    alter table public.profiles drop column is_admin;
  end if;
end;
$$;
