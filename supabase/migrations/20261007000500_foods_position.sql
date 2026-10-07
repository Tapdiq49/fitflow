-- Order of a user's own foods (the user drags them around). System foods keep their fixed order and have no position.
alter table public.foods add column position integer;

-- Existing own foods: number them per user in the order they were added.
update public.foods f
set position = n.rn
from (
  select id, row_number() over (partition by user_id order by created_at, id) as rn
  from public.foods
  where user_id is not null
) as n
where f.id = n.id;

-- A new own food goes to the end of the user's list.
create function public.assign_food_position() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is not null and new.position is null then
    new.position := coalesce((select max(position) from public.foods where user_id = new.user_id), 0) + 1;
  end if;
  return new;
end;
$$;

create trigger foods_assign_position
  before insert on public.foods
  for each row execute function public.assign_food_position();

-- System rows have no position; user rows always have one (the trigger above fills it in before this is checked).
alter table public.foods
  add constraint foods_position_valid check (
    (user_id is null and position is null) or (user_id is not null and position is not null and position > 0)
  );

grant update (position) on public.foods to authenticated;

-- Applies a new order in one request and one transaction. `p_positions[i]` is the position for `p_ids[i]`.
-- Runs with the caller's rights: row level security (and the user_id check) allow it to touch own foods only.
-- NestJS equivalent: PATCH /foods/order with the same two lists, applied WHERE user_id = :currentUser.
create function public.reorder_foods(p_ids uuid[], p_positions integer[]) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(p_ids, 1), 0) <> coalesce(array_length(p_positions, 1), 0) then
    raise exception 'ids and positions must have the same length' using errcode = '22023';
  end if;
  update public.foods f
  set position = v.pos
  from unnest(p_ids, p_positions) as v (id, pos)
  where f.id = v.id and f.user_id = (select auth.uid());
end;
$$;

revoke all on function public.reorder_foods(uuid[], integer[]) from public, anon;
grant execute on function public.reorder_foods(uuid[], integer[]) to authenticated;
