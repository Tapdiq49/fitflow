-- Phase 2 of the backend migration: the daily records, the weights and the exercise history of each user.
-- Plain Postgres on purpose (backend-migration-rules.md). NestJS equivalent of every policy: guard + `WHERE user_id = :currentUser`.
--
-- The app writes through ONE function, apply_user_data(jsonb): a whole change (for example "save the workout" = history rows + the
-- day's check mark) is applied in one transaction, so the three tables never go out of step. NestJS equivalent: one endpoint that
-- runs the same statements in a transaction.

-- ---------------------------------------------------------------------------
-- days: one row per user and local calendar day. `record` is the app's DayRecord (menu, water, sleep, checks, workout, cardio, snap).
-- ---------------------------------------------------------------------------
create table public.days (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  record     jsonb not null check (jsonb_typeof(record) = 'object' and pg_column_size(record) <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- weights: one row per user and day (the app keeps one entry per day).
-- ---------------------------------------------------------------------------
create table public.weights (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  kg         numeric(4, 1) not null check (kg between 30 and 300),
  waist      numeric(4, 1) check (waist is null or waist between 40 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- exercise_history: the sets logged for one exercise on one day (what the progression advice reads).
-- ---------------------------------------------------------------------------
create table public.exercise_history (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null check (length(exercise_id) between 1 and 200),
  day         date not null,
  sets        jsonb not null check (jsonb_typeof(sets) = 'array' and pg_column_size(sets) <= 20000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, exercise_id, day)
);

create trigger days_set_updated_at before update on public.days
  for each row execute function public.set_updated_at();
create trigger weights_set_updated_at before update on public.weights
  for each row execute function public.set_updated_at();
create trigger exercise_history_set_updated_at before update on public.exercise_history
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone reads and writes only their own rows.
-- ---------------------------------------------------------------------------
alter table public.days enable row level security;
alter table public.weights enable row level security;
alter table public.exercise_history enable row level security;

create policy "days: own rows" on public.days
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "weights: own rows" on public.weights
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "exercise_history: own rows" on public.exercise_history
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.days to authenticated;
grant select, insert, update, delete on public.weights to authenticated;
grant select, insert, update, delete on public.exercise_history to authenticated;

-- ---------------------------------------------------------------------------
-- apply_user_data(p_changes): one transaction for one change of the app.
--
--   {
--     "clear":   true,                                            -- optional: delete all three tables of the caller first
--     "days":    { "2026-10-09": { ...DayRecord... }, "2026-10-08": null },   -- object = save, null = delete
--     "weights": { "2026-10-09": { "kg": 82.4, "waist": 90 }, "2026-10-01": null },
--     "history": [ { "exercise_id": "squat", "day": "2026-10-09", "sets": [ { "w": 80, "r": 8 } ] },
--                  { "exercise_id": "squat", "day": "2026-10-02", "sets": null } ]
--   }
--
-- SECURITY INVOKER: Row Level Security applies, so a caller can only ever touch their own rows.
-- ---------------------------------------------------------------------------
create function public.apply_user_data(p_changes jsonb) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'invalid changes' using errcode = '22023';
  end if;

  if coalesce((p_changes ->> 'clear')::boolean, false) then
    delete from public.days where user_id = uid;
    delete from public.weights where user_id = uid;
    delete from public.exercise_history where user_id = uid;
  end if;

  for k, v in select * from jsonb_each(coalesce(p_changes -> 'days', '{}'::jsonb)) loop
    if jsonb_typeof(v) = 'null' then
      delete from public.days where user_id = uid and day = k::date;
    else
      insert into public.days (user_id, day, record) values (uid, k::date, v)
      on conflict (user_id, day) do update set record = excluded.record;
    end if;
  end loop;

  for k, v in select * from jsonb_each(coalesce(p_changes -> 'weights', '{}'::jsonb)) loop
    if jsonb_typeof(v) = 'null' then
      delete from public.weights where user_id = uid and day = k::date;
    else
      insert into public.weights (user_id, day, kg, waist)
      values (uid, k::date, (v ->> 'kg')::numeric, nullif(v ->> 'waist', '')::numeric)
      on conflict (user_id, day) do update set kg = excluded.kg, waist = excluded.waist;
    end if;
  end loop;

  for v in select * from jsonb_array_elements(coalesce(p_changes -> 'history', '[]'::jsonb)) loop
    if jsonb_typeof(v -> 'sets') = 'array' then
      insert into public.exercise_history (user_id, exercise_id, day, sets)
      values (uid, v ->> 'exercise_id', (v ->> 'day')::date, v -> 'sets')
      on conflict (user_id, exercise_id, day) do update set sets = excluded.sets;
    else
      delete from public.exercise_history
      where user_id = uid and exercise_id = v ->> 'exercise_id' and day = (v ->> 'day')::date;
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_user_data(jsonb) from public, anon;
grant execute on function public.apply_user_data(jsonb) to authenticated;
