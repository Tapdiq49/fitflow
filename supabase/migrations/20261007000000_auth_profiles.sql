-- FitFlow auth: profiles, username rules, RLS, new-user trigger, login throttle.
-- Plain Postgres on purpose (see _bmad-output/planning-artifacts/backend-migration-rules.md): the only
-- Supabase-specific pieces are `auth.users` (the account table) and `auth.uid()` (the current user id).
-- NestJS move: keep `profiles`, replace `auth.users` with an own `users` table and `auth.uid()` with the
-- user id the API takes from its JWT.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  -- NULL until the user picks one (OAuth sign-ups); lower-case only, so a plain unique index is enough.
  -- No '@' allowed: the login form tells e-mail and username apart by the '@'.
  username          text,
  email             text not null,
  email_preferences boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_.]{3,30}$')
);

create unique index profiles_username_key on public.profiles (username);
create index profiles_email_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user -> profile
-- ---------------------------------------------------------------------------
-- E-mail sign-up sends username / marketing_opt_in as sign-up metadata. OAuth sign-ups get no username
-- (provider metadata is never trusted for it); the app asks for one right after the first sign-in.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email' then
    v_username := nullif(lower(btrim(new.raw_user_meta_data ->> 'username')), '');
  end if;

  insert into public.profiles (id, username, email, email_preferences)
  values (
    new.id,
    v_username,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', 'false') = 'true'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keeps profiles.email equal to the account e-mail.
create function public.handle_user_email_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Username availability (boolean only; reveals nothing else)
-- ---------------------------------------------------------------------------
create function public.is_username_available(p_username text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_username ~ '^[a-zA-Z0-9_.]{3,30}$'
     and not exists (select 1 from public.profiles where username = lower(p_username));
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: a user sees and edits only their own profile
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Only these columns can be changed from the client; id, email and timestamps cannot.
grant update (username, email_preferences) on public.profiles to authenticated;

-- NestJS equivalent: guard + `WHERE id = :currentUser`.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- NestJS equivalent: guard + `UPDATE ... WHERE id = :currentUser`.
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert policy (only handle_new_user inserts) and no delete policy (rows go with the auth user).

-- ---------------------------------------------------------------------------
-- Login throttle, used only by the `login` Edge Function (service role)
-- ---------------------------------------------------------------------------
create table public.login_attempts (
  id           bigint generated always as identity primary key,
  key          text not null,            -- sha-256 of "id:<identifier>" or "ip:<address>"
  attempted_at timestamptz not null default now()
);

create index login_attempts_key_idx on public.login_attempts (key, attempted_at desc);

-- RLS on with no policy: nobody but the service role (which bypasses RLS) can read or write.
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
