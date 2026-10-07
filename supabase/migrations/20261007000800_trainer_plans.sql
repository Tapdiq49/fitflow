-- The weekly trainer plans (meals and workout) of each user. One row per user, kind and week.
-- The plan is a jsonb document of the same shape the app used in localStorage (weekday number -> list of meals / exercises),
-- so nothing about it needs to be split into columns yet. Plain Postgres: a later NestJS + Postgres move keeps the same table.
create table public.trainer_plans (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('meal', 'workout')),
  -- The Monday of the week the plan starts in.
  week date not null check (extract(isodow from week) = 1),
  plan jsonb not null check (jsonb_typeof(plan) = 'object' and pg_column_size(plan) <= 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, week)
);

alter table public.trainer_plans enable row level security;

create policy "trainer_plans: own rows" on public.trainer_plans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.trainer_plans to authenticated;

create trigger trainer_plans_set_updated_at
  before update on public.trainer_plans
  for each row execute function public.set_updated_at();
