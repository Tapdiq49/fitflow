-- Reference list "Soraqçalar" → meals: the meal templates the menu generator and the weekly plan draw from.
-- Plain Postgres on purpose (backend-migration-rules.md). NestJS equivalent of the RLS policies: a read endpoint open to everyone and a
-- write guard that checks the permission `meals.edit` of the caller's role.
--
-- Everyone (also guests) reads the templates. Writing needs the permission `meals.edit`, which only the built-in `admin` role holds at
-- first; the roles page can give it to any other role. The templates are shared by all users: a change reaches every generated menu.
-- The app keeps a copy of the built-in templates in src/app/core/data/meals.ts as the last resort for a first visit without a
-- connection; a change to the seed below needs the same change there.

-- ---------------------------------------------------------------------------
-- The permission
-- ---------------------------------------------------------------------------
insert into public.permissions (id, module, action, sort) values ('meals.edit', 'meals', 'edit', 72);
insert into public.role_permissions (role_id, permission_id) values ('admin', 'meals.edit');

-- Whether the signed-in caller's role holds a permission. security definer: the caller may not read `profiles` of others, and the
-- check must not depend on what RLS lets them see.
create function public.has_permission(p_permission text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.role_permissions rp on rp.role_id = pr.role_id
    where pr.id = (select auth.uid()) and rp.permission_id = p_permission
  );
$$;

revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------
create table public.meal_templates (
  id         uuid primary key default gen_random_uuid(),
  -- Stable key saved menus refer to (Meal.templateId), e.g. 'b1'. Chosen by the app for a new template.
  code       text not null,
  -- Which pool the template belongs to: the meal slot it is offered for.
  slot       text not null,
  -- Place inside its slot (1, 2, …).
  position   integer not null,
  -- Name per language: {"az": "...", "en": "...", "ru": "..."}; Azerbaijani (the source language) is required.
  names      jsonb not null,
  -- Main protein source (a food code, e.g. 'egg'): the generator avoids it on consecutive days.
  main       text,
  -- Light enough for an evening meal after a training meal.
  light      boolean not null default false,
  -- The foods: [["oats", 80], ["banana", 1], …] = food code and amount (grams, or pieces / scoops for those units).
  items      jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_templates_code_valid check (code ~ '^[a-z0-9_]{1,30}$'),
  constraint meal_templates_slot_valid check (slot in ('breakfast', 'snack', 'lunch', 'pre', 'post', 'dinner')),
  constraint meal_templates_position_valid check (position > 0),
  constraint meal_templates_names_valid check (
    jsonb_typeof(names) = 'object'
    and length(btrim(coalesce(names ->> 'az', ''))) > 0
    and length(names::text) <= 1000
  ),
  constraint meal_templates_main_valid check (main is null or main ~ '^[a-z0-9_]{1,30}$'),
  constraint meal_templates_items_valid check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 12 and length(items::text) <= 1000
  ),
  constraint meal_templates_code_key unique (code)
);

create index meal_templates_slot_idx on public.meal_templates (slot, position);

create trigger meal_templates_set_updated_at
  before update on public.meal_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone reads; the permission `meals.edit` writes
-- ---------------------------------------------------------------------------
alter table public.meal_templates enable row level security;

revoke all on public.meal_templates from anon, authenticated;
grant select on public.meal_templates to anon, authenticated;
grant insert (code, slot, position, names, main, light, items) on public.meal_templates to authenticated;
grant update (slot, position, names, main, light, items) on public.meal_templates to authenticated;
grant delete on public.meal_templates to authenticated;

create policy meal_templates_select on public.meal_templates
  for select to anon, authenticated
  using (true);

create policy meal_templates_insert on public.meal_templates
  for insert to authenticated
  with check (public.has_permission('meals.edit'));

create policy meal_templates_update on public.meal_templates
  for update to authenticated
  using (public.has_permission('meals.edit'))
  with check (public.has_permission('meals.edit'));

create policy meal_templates_delete on public.meal_templates
  for delete to authenticated
  using (public.has_permission('meals.edit'));

-- ---------------------------------------------------------------------------
-- The built-in templates (same data as src/app/core/data/meals.ts and the meal.* texts in core/i18n/*.json)
-- ---------------------------------------------------------------------------
insert into public.meal_templates (code, slot, position, names, main, light, items) values
  ('b1', 'breakfast', 1, '{"az":"Yulaf sıyığı + yumurta + banan","en":"Oatmeal + eggs + banana","ru":"Овсяная каша + яйца + банан"}'::jsonb, 'egg', false, '[["oats",80],["banana",1],["walnut",10],["egg",3]]'::jsonb),
  ('b2', 'breakfast', 2, '{"az":"Omlet + tam taxıl çörək + salat","en":"Omelet + whole-grain bread + salad","ru":"Омлет + цельнозерновой хлеб + салат"}'::jsonb, 'egg', false, '[["egg",3],["eggwhite",3],["bread",80],["salad",150],["cheese",20]]'::jsonb),
  ('b3', 'breakfast', 3, '{"az":"Kəsmik kasası (yulaf + giləmeyvə + bal)","en":"Cottage cheese bowl (oats + berries + honey)","ru":"Творожная миска (овсянка + ягоды + мёд)"}'::jsonb, 'cottage', false, '[["cottage",200],["oats",60],["berries",100],["honey",10]]'::jsonb),
  ('b4', 'breakfast', 4, '{"az":"Qarabaşaq + qaynadılmış yumurta","en":"Buckwheat + boiled eggs","ru":"Гречка + варёные яйца"}'::jsonb, 'egg', false, '[["buckwheat",200],["egg",3],["eggwhite",2],["salad",100]]'::jsonb),
  ('b5', 'breakfast', 5, '{"az":"Toyuqlu lavaş dürmək + yumurta","en":"Chicken lavash wrap + eggs","ru":"Лаваш с курицей + яйца"}'::jsonb, 'chicken', false, '[["lavash",70],["chicken",100],["egg",2],["salad",100]]'::jsonb),
  ('b6', 'breakfast', 6, '{"az":"Overnight oats (qatıq + kəsmik)","en":"Overnight oats (yogurt + cottage cheese)","ru":"Овсянка на ночь (йогурт + творог)"}'::jsonb, 'cottage', false, '[["oats",70],["yogurt",200],["cottage",100],["banana",1],["almond",10]]'::jsonb),
  ('s1', 'snack', 1, '{"az":"Kəsmik + kivi","en":"Cottage cheese + kiwi","ru":"Творог + киви"}'::jsonb, null, false, '[["cottage",200],["kiwi",2]]'::jsonb),
  ('s2', 'snack', 2, '{"az":"Qatıq + badam + banan","en":"Yogurt + almonds + banana","ru":"Йогурт + миндаль + банан"}'::jsonb, null, false, '[["yogurt",250],["almond",15],["banana",1]]'::jsonb),
  ('s3', 'snack', 3, '{"az":"Tuna sendviç","en":"Tuna sandwich","ru":"Сэндвич с тунцом"}'::jsonb, null, false, '[["bread",60],["tuna",100],["salad",80]]'::jsonb),
  ('s4', 'snack', 4, '{"az":"Kefir + qoz + portağal","en":"Kefir + walnuts + orange","ru":"Кефир + грецкие орехи + апельсин"}'::jsonb, null, false, '[["kefir",300],["walnut",15],["orange",1]]'::jsonb),
  ('s5', 'snack', 5, '{"az":"Qaynadılmış yumurta + çörək + portağal","en":"Boiled eggs + bread + orange","ru":"Варёные яйца + хлеб + апельсин"}'::jsonb, null, false, '[["egg",2],["eggwhite",2],["bread",50],["orange",1]]'::jsonb),
  ('s6', 'snack', 6, '{"az":"Mini toyuq + düyü","en":"Small chicken + rice","ru":"Небольшая порция курицы + рис"}'::jsonb, null, false, '[["chicken",120],["rice",150],["salad",80]]'::jsonb),
  ('l1', 'lunch', 1, '{"az":"Toyuq döşü + düyü + salat","en":"Chicken breast + rice + salad","ru":"Куриная грудка + рис + салат"}'::jsonb, 'chicken', false, '[["chicken",200],["rice",250],["salad",150],["oil",10]]'::jsonb),
  ('l2', 'lunch', 2, '{"az":"Mal əti + kartof + salat","en":"Beef + potato + salad","ru":"Говядина + картофель + салат"}'::jsonb, 'beef', false, '[["beef",170],["potato",300],["salad",150],["oil",5]]'::jsonb),
  ('l3', 'lunch', 3, '{"az":"Balıq + düyü + bişmiş tərəvəz","en":"Fish + rice + cooked vegetables","ru":"Рыба + рис + варёные овощи"}'::jsonb, 'fish', false, '[["fish",250],["rice",250],["vegs",150],["oil",10]]'::jsonb),
  ('l4', 'lunch', 4, '{"az":"Toyuq + qarabaşaq + salat","en":"Chicken + buckwheat + salad","ru":"Курица + гречка + салат"}'::jsonb, 'chicken', false, '[["chicken",200],["buckwheat",250],["salad",150],["oil",10]]'::jsonb),
  ('l5', 'lunch', 5, '{"az":"Mal əti + bulqur plov + salat","en":"Beef + bulgur pilaf + salad","ru":"Говядина + плов из булгура + салат"}'::jsonb, 'beef', false, '[["beef",170],["bulgur",250],["salad",150],["oil",5]]'::jsonb),
  ('l6', 'lunch', 6, '{"az":"Toyuq budu + makaron + tərəvəz","en":"Chicken thigh + pasta + vegetables","ru":"Куриное бедро + макароны + овощи"}'::jsonb, 'thigh', false, '[["thigh",180],["pasta",200],["vegs",150]]'::jsonb),
  ('l7', 'lunch', 7, '{"az":"Tunalı makaron + salat","en":"Tuna pasta + salad","ru":"Макароны с тунцом + салат"}'::jsonb, 'tuna', false, '[["tuna",150],["pasta",220],["salad",150],["oil",10]]'::jsonb),
  ('l8', 'lunch', 8, '{"az":"Sobada toyuq + kartof + tərəvəz","en":"Oven-baked chicken + potato + vegetables","ru":"Курица в духовке + картофель + овощи"}'::jsonb, 'chicken', false, '[["chicken",200],["potato",350],["vegs",150],["oil",5]]'::jsonb),
  ('p1', 'pre', 1, '{"az":"Banan + qatıq + bal","en":"Banana + yogurt + honey","ru":"Банан + йогурт + мёд"}'::jsonb, null, false, '[["banana",1],["yogurt",200],["honey",10]]'::jsonb),
  ('p2', 'pre', 2, '{"az":"Yüngül düyü + toyuq","en":"Light rice + chicken","ru":"Лёгкий рис + курица"}'::jsonb, null, false, '[["rice",150],["chicken",100]]'::jsonb),
  ('p3', 'pre', 3, '{"az":"Çörək + bal + kəsmik","en":"Bread + honey + cottage cheese","ru":"Хлеб + мёд + творог"}'::jsonb, null, false, '[["bread",60],["honey",15],["cottage",100]]'::jsonb),
  ('p4', 'pre', 4, '{"az":"Suda yulaf + banan","en":"Oats in water + banana","ru":"Овсянка на воде + банан"}'::jsonb, null, false, '[["oats",50],["banana",1]]'::jsonb),
  ('p5', 'pre', 5, '{"az":"Xurma + kefir","en":"Dates + kefir","ru":"Финики + кефир"}'::jsonb, null, false, '[["dates",40],["kefir",250]]'::jsonb),
  ('pw1', 'post', 1, '{"az":"Toyuq + düyü + salat","en":"Chicken + rice + salad","ru":"Курица + рис + салат"}'::jsonb, 'chicken', false, '[["chicken",180],["rice",250],["salad",100]]'::jsonb),
  ('pw2', 'post', 2, '{"az":"Balıq + kartof + salat","en":"Fish + potato + salad","ru":"Рыба + картофель + салат"}'::jsonb, 'fish', false, '[["fish",220],["potato",300],["salad",100]]'::jsonb),
  ('pw3', 'post', 3, '{"az":"Mal əti + düyü + tərəvəz","en":"Beef + rice + vegetables","ru":"Говядина + рис + овощи"}'::jsonb, 'beef', false, '[["beef",160],["rice",220],["vegs",100]]'::jsonb),
  ('pw4', 'post', 4, '{"az":"Omlet + çörək + banan","en":"Omelet + bread + banana","ru":"Омлет + хлеб + банан"}'::jsonb, 'egg', false, '[["egg",2],["eggwhite",4],["bread",80],["banana",1]]'::jsonb),
  ('pw5', 'post', 5, '{"az":"Toyuq + qarabaşaq + salat","en":"Chicken + buckwheat + salad","ru":"Курица + гречка + салат"}'::jsonb, 'chicken', false, '[["chicken",180],["buckwheat",250],["salad",100]]'::jsonb),
  ('d1', 'dinner', 1, '{"az":"Kəsmik + qoz + giləmeyvə","en":"Cottage cheese + walnuts + berries","ru":"Творог + грецкие орехи + ягоды"}'::jsonb, 'cottage', true, '[["cottage",250],["walnut",15],["berries",100]]'::jsonb),
  ('d2', 'dinner', 2, '{"az":"Balıq + kartof + salat","en":"Fish + potato + salad","ru":"Рыба + картофель + салат"}'::jsonb, 'fish', false, '[["fish",220],["potato",250],["salad",150],["oil",5]]'::jsonb),
  ('d3', 'dinner', 3, '{"az":"Yumurta + salat + çörək","en":"Eggs + salad + bread","ru":"Яйца + салат + хлеб"}'::jsonb, 'egg', true, '[["egg",3],["eggwhite",2],["salad",200],["bread",50]]'::jsonb),
  ('d4', 'dinner', 4, '{"az":"Toyuq + bişmiş tərəvəz + qarabaşaq","en":"Chicken + cooked vegetables + buckwheat","ru":"Курица + варёные овощи + гречка"}'::jsonb, 'chicken', false, '[["chicken",180],["vegs",200],["buckwheat",150],["oil",5]]'::jsonb),
  ('d5', 'dinner', 5, '{"az":"Qatıq + kəsmik + kivi","en":"Yogurt + cottage cheese + kiwi","ru":"Йогурт + творог + киви"}'::jsonb, 'cottage', true, '[["yogurt",200],["cottage",150],["kiwi",1]]'::jsonb),
  ('d6', 'dinner', 6, '{"az":"Mal əti + bulqur + salat","en":"Beef + bulgur + salad","ru":"Говядина + булгур + салат"}'::jsonb, 'beef', false, '[["beef",150],["bulgur",150],["salad",150],["oil",5]]'::jsonb),
  ('d7', 'dinner', 7, '{"az":"Tuna salatı + kartof","en":"Tuna salad + potato","ru":"Салат с тунцом + картофель"}'::jsonb, 'tuna', true, '[["tuna",120],["potato",200],["salad",200],["oil",5]]'::jsonb)
on conflict (code) do nothing;
