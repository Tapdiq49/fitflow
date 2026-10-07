-- Every user has their own order of the whole food list (system foods and own foods can all be dragged).
-- This replaces the first idea (foods.position, own foods only) from 20261007000500; that migration is undone below.
drop function if exists public.reorder_foods(uuid[], integer[]);
drop trigger if exists foods_assign_position on public.foods;
drop function if exists public.assign_food_position();
alter table public.foods drop constraint if exists foods_position_valid;
alter table public.foods drop column if exists position;

-- One row per user and food that the user has put in a place. Foods without a row keep their default place, after the placed ones.
create table public.food_order (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  position integer not null check (position > 0),
  primary key (user_id, food_id)
);

alter table public.food_order enable row level security;

create policy "food_order: own rows" on public.food_order
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.food_order to authenticated;

-- The food list as the current visitor sees it: `foods` plus that visitor's place (null = not placed yet; always null for guests).
-- security_invoker: the RLS of `foods` and `food_order` applies to the caller.
create view public.food_list with (security_invoker = true) as
select f.id, f.user_id, f.code, f.names, f.unit, f.kcal, f.protein, f.carbs, f.fat,
       f.role, f.step, f.min_amount, f.max_amount, f.created_at, o.position
from public.foods f
left join public.food_order o on o.food_id = f.id and o.user_id = (select auth.uid());

grant select on public.food_list to anon, authenticated;

-- Moves one food to the place of another (the dragged row takes the target's place, the rows between shift by one).
-- The whole list is numbered 1..n in the order the caller sees it, so the first move also fixes the default order.
-- Same order as the app asks for: placed foods first, then system foods, then own foods, by Azerbaijani name.
-- NestJS equivalent: PATCH /foods/:id/move { targetId } doing the same renumbering for the current user.
create function public.move_food(p_id uuid, p_target uuid) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_id = p_target then
    return;
  end if;

  with ordered as (
    select id, row_number() over (order by position nulls last, user_id nulls first, names ->> 'az', id) as rn
    from public.food_list
  ),
  pair as (
    select (select rn from ordered where id = p_id) as src, (select rn from ordered where id = p_target) as dst
  ),
  renumbered as (
    select o.id,
           case
             when o.id = p_id then pair.dst
             when pair.src < pair.dst and o.rn between pair.src + 1 and pair.dst then o.rn - 1
             when pair.src > pair.dst and o.rn between pair.dst and pair.src - 1 then o.rn + 1
             else o.rn
           end::integer as pos
    from ordered o, pair
    where pair.src is not null and pair.dst is not null
  )
  insert into public.food_order (user_id, food_id, position)
  select v_user, id, pos from renumbered
  on conflict (user_id, food_id) do update set position = excluded.position;
end;
$$;

revoke all on function public.move_food(uuid, uuid) from public, anon;
grant execute on function public.move_food(uuid, uuid) to authenticated;
