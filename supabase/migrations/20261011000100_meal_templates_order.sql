-- Meal templates: the order of the pools through the day, so a paged list can be sorted by it in the database.
-- (breakfast, snack, lunch, pre-workout, post-workout, dinner — the order the menu uses them.)
alter table public.meal_templates
  add column slot_rank integer generated always as (
    case slot
      when 'breakfast' then 1
      when 'snack' then 2
      when 'lunch' then 3
      when 'pre' then 4
      when 'post' then 5
      when 'dinner' then 6
    end
  ) stored;

create index meal_templates_rank_idx on public.meal_templates (slot_rank, position, code);
