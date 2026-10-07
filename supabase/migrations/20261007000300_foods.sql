-- Reference list "Soraqçalar" → foods: the built-in food database (system rows) and the foods users add (own rows).
-- Plain Postgres on purpose (backend-migration-rules.md). NestJS equivalent of the RLS policies: guard + `WHERE user_id IS NULL OR user_id = :currentUser`.
--
-- System rows (user_id NULL, code set) are readable by everyone, signed in or not, and writable by nobody from the client.
-- The menu generator keeps its own copy of the system foods in src/app/core/data/foods.ts (it needs role, step, min, max and
-- works offline): a change to a system food needs a new migration here AND the same change in that file.

create table public.foods (
  id         uuid primary key default gen_random_uuid(),
  -- NULL = system food. User foods belong to one user and go away with the account.
  user_id    uuid references auth.users (id) on delete cascade,
  -- Stable key of a system food (what saved menus refer to, e.g. 'chicken'); NULL for user foods.
  code       text,
  -- Name per language: {"az": "...", "en": "...", "ru": "..."}; Azerbaijani (the source language) is required.
  names      jsonb not null,
  unit       text not null,
  -- Per 100 g when unit is 'g', per single piece / scoop otherwise.
  kcal       numeric(7, 1) not null,
  protein    numeric(6, 1) not null,
  carbs      numeric(6, 1) not null,
  fat        numeric(6, 1) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foods_unit_valid check (unit in ('g', 'piece', 'scoop')),
  constraint foods_names_valid check (
    jsonb_typeof(names) = 'object'
    and length(btrim(coalesce(names ->> 'az', ''))) > 0
    and length(names::text) <= 800
  ),
  constraint foods_macros_valid check (kcal between 0 and 1000 and protein between 0 and 100 and carbs between 0 and 100 and fat between 0 and 100),
  -- A system row has a code and no owner; a user row has an owner and no code.
  constraint foods_owner_or_code check ((user_id is null) = (code is not null))
);

create unique index foods_system_code_key on public.foods (code) where user_id is null;
create index foods_user_idx on public.foods (user_id) where user_id is not null;

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

-- At most 500 own foods per user (keeps one account from filling the database).
create function public.enforce_food_limit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is not null and (select count(*) from public.foods where user_id = new.user_id) >= 500 then
    raise exception 'food limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger foods_limit
  before insert on public.foods
  for each row execute function public.enforce_food_limit();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.foods enable row level security;

revoke all on public.foods from anon, authenticated;
grant select on public.foods to anon, authenticated;
grant insert (user_id, names, unit, kcal, protein, carbs, fat) on public.foods to authenticated;
grant update (names, unit, kcal, protein, carbs, fat) on public.foods to authenticated;
grant delete on public.foods to authenticated;

-- Everyone (also guests) reads the system foods.
create policy foods_select_system on public.foods
  for select to anon, authenticated
  using (user_id is null);

-- A user also reads their own foods.
create policy foods_select_own on public.foods
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy foods_insert_own on public.foods
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy foods_update_own on public.foods
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy foods_delete_own on public.foods
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- System foods (same data as src/app/core/data/foods.ts and the food.* texts in core/i18n/*.json)
-- ---------------------------------------------------------------------------
insert into public.foods (code, names, unit, kcal, protein, carbs, fat) values
  ('egg', '{"az":"Yumurta","en":"Egg","ru":"Яйцо"}'::jsonb, 'piece', 78, 6.3, 0.6, 5.3),
  ('eggwhite', '{"az":"Yumurta ağı","en":"Egg white","ru":"Яичный белок"}'::jsonb, 'piece', 17, 3.6, 0.2, 0.1),
  ('chicken', '{"az":"Toyuq döşü (bişmiş)","en":"Chicken breast (cooked)","ru":"Куриная грудка (варёная)"}'::jsonb, 'g', 165, 31, 0, 3.6),
  ('thigh', '{"az":"Toyuq budu, dərisiz (bişmiş)","en":"Chicken thigh, skinless (cooked)","ru":"Куриное бедро без кожи (варёное)"}'::jsonb, 'g', 177, 24, 0, 8.5),
  ('beef', '{"az":"Mal əti, yağsız (bişmiş)","en":"Beef, lean (cooked)","ru":"Говядина, постная (варёная)"}'::jsonb, 'g', 190, 27, 0, 8.5),
  ('fish', '{"az":"Ağ balıq — xek/sudak (bişmiş)","en":"White fish — hake/pike-perch (cooked)","ru":"Белая рыба — хек/судак (варёная)"}'::jsonb, 'g', 105, 22, 0, 1.5),
  ('tuna', '{"az":"Tuna konservi (öz suyunda)","en":"Canned tuna (in its own juice)","ru":"Тунец консервированный (в собственном соку)"}'::jsonb, 'g', 116, 26, 0, 1),
  ('cottage', '{"az":"Kəsmik (2–5%)","en":"Cottage cheese (2–5%)","ru":"Творог (2–5%)"}'::jsonb, 'g', 110, 17, 3, 3.5),
  ('yogurt', '{"az":"Qatıq (2.5%)","en":"Yogurt (2.5%)","ru":"Йогурт (2,5%)"}'::jsonb, 'g', 60, 3.3, 4.5, 2.5),
  ('kefir', '{"az":"Kefir (1%)","en":"Kefir (1%)","ru":"Кефир (1%)"}'::jsonb, 'g', 40, 3.4, 4.7, 1),
  ('milk', '{"az":"Süd (2.5%)","en":"Milk (2.5%)","ru":"Молоко (2,5%)"}'::jsonb, 'g', 52, 3, 4.7, 2.5),
  ('cheese', '{"az":"Ağ pendir (az duzlu)","en":"White cheese (low salt)","ru":"Белый сыр (малосолёный)"}'::jsonb, 'g', 260, 17, 1, 21),
  ('oats', '{"az":"Yulaf (quru)","en":"Oats (dry)","ru":"Овсянка (сухая)"}'::jsonb, 'g', 379, 13, 67, 6.5),
  ('rice', '{"az":"Düyü (bişmiş)","en":"Rice (cooked)","ru":"Рис (варёный)"}'::jsonb, 'g', 130, 2.7, 28, 0.3),
  ('potato', '{"az":"Kartof (qaynadılmış/sobada)","en":"Potato (boiled/baked)","ru":"Картофель (варёный/запечённый)"}'::jsonb, 'g', 87, 1.9, 20, 0.1),
  ('buckwheat', '{"az":"Qarabaşaq (bişmiş)","en":"Buckwheat (cooked)","ru":"Гречка (варёная)"}'::jsonb, 'g', 92, 3.4, 20, 0.6),
  ('pasta', '{"az":"Makaron, bərk buğda (bişmiş)","en":"Pasta, durum wheat (cooked)","ru":"Макароны из твёрдых сортов (варёные)"}'::jsonb, 'g', 158, 5.8, 31, 0.9),
  ('bulgur', '{"az":"Bulqur (bişmiş)","en":"Bulgur (cooked)","ru":"Булгур (варёный)"}'::jsonb, 'g', 83, 3.1, 18.6, 0.2),
  ('bread', '{"az":"Tam taxıl çörək","en":"Whole-grain bread","ru":"Цельнозерновой хлеб"}'::jsonb, 'g', 247, 13, 41, 3.4),
  ('lavash', '{"az":"Lavaş (nazik)","en":"Lavash (thin)","ru":"Лаваш (тонкий)"}'::jsonb, 'g', 275, 9, 56, 1.2),
  ('banana', '{"az":"Banan","en":"Banana","ru":"Банан"}'::jsonb, 'piece', 105, 1.3, 27, 0.4),
  ('apple', '{"az":"Alma","en":"Apple","ru":"Яблоко"}'::jsonb, 'piece', 95, 0.5, 25, 0.3),
  ('kiwi', '{"az":"Kivi","en":"Kiwi","ru":"Киви"}'::jsonb, 'piece', 42, 0.8, 10, 0.4),
  ('orange', '{"az":"Portağal","en":"Orange","ru":"Апельсин"}'::jsonb, 'piece', 62, 1.2, 15, 0.2),
  ('berries', '{"az":"Giləmeyvə (çiyələk/moruq)","en":"Berries (strawberry/raspberry)","ru":"Ягоды (клубника/малина)"}'::jsonb, 'g', 32, 0.7, 7.7, 0.3),
  ('dates', '{"az":"Xurma","en":"Dates","ru":"Финики"}'::jsonb, 'g', 282, 2.5, 75, 0.4),
  ('honey', '{"az":"Bal","en":"Honey","ru":"Мёд"}'::jsonb, 'g', 304, 0.3, 82, 0),
  ('almond', '{"az":"Badam","en":"Almonds","ru":"Миндаль"}'::jsonb, 'g', 579, 21, 22, 50),
  ('walnut', '{"az":"Qoz","en":"Walnuts","ru":"Грецкие орехи"}'::jsonb, 'g', 654, 15, 14, 65),
  ('hazelnut', '{"az":"Fındıq","en":"Hazelnuts","ru":"Фундук"}'::jsonb, 'g', 628, 15, 17, 61),
  ('oil', '{"az":"Zeytun yağı","en":"Olive oil","ru":"Оливковое масло"}'::jsonb, 'g', 884, 0, 0, 100),
  ('salad', '{"az":"Xiyar + pomidor + göyərti salatı","en":"Cucumber + tomato + herb salad","ru":"Салат из огурца, помидора и зелени"}'::jsonb, 'g', 18, 0.9, 3.6, 0.2),
  ('vegs', '{"az":"Bişmiş tərəvəz (balqabaq, yerkökü, kabak)","en":"Cooked vegetables (pumpkin, carrot, zucchini)","ru":"Варёные овощи (тыква, морковь, кабачок)"}'::jsonb, 'g', 35, 1.2, 7, 0.3),
  ('broccoli', '{"az":"Brokoli / gül kələm","en":"Broccoli / cauliflower","ru":"Брокколи / цветная капуста"}'::jsonb, 'g', 35, 2.4, 7, 0.4),
  ('lentil', '{"az":"Mərci (bişmiş)","en":"Lentils (cooked)","ru":"Чечевица (варёная)"}'::jsonb, 'g', 116, 9, 20, 0.4),
  ('pb', '{"az":"Fıstıq pastası (şəkərsiz)","en":"Peanut butter (no sugar)","ru":"Арахисовая паста (без сахара)"}'::jsonb, 'g', 588, 25, 20, 50),
  ('whey', '{"az":"Whey protein (1 ölçü ≈ 30 q)","en":"Whey protein (1 scoop ≈ 30 g)","ru":"Whey-протеин (1 мерка ≈ 30 г)"}'::jsonb, 'scoop', 120, 24, 3, 1.5)
on conflict (code) where user_id is null do nothing;
