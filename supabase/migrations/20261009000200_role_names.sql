-- Role names and descriptions in the three languages (az, en, ru), like the names of the foods.
-- `name` / `description` stay (the Azerbaijani text, the source language and the fallback); the function `admin-users` keeps them in step with
-- `names.az` / `descriptions.az` and answers with the text of the language the request names (`lang`).
-- NestJS equivalent: the same two jsonb columns on the roles table and the same `lang` query parameter.

alter table public.roles
  add column names        jsonb not null default '{}'::jsonb,
  add column descriptions jsonb not null default '{}'::jsonb;

alter table public.roles
  add constraint roles_names_object check (jsonb_typeof(names) = 'object'),
  add constraint roles_descriptions_object check (jsonb_typeof(descriptions) = 'object');

-- Roles that exist: the stored text becomes their Azerbaijani text.
update public.roles
set names = jsonb_build_object('az', name),
    descriptions = case when description = '' then '{}'::jsonb else jsonb_build_object('az', description) end;

-- The built-in roles are translated.
update public.roles set
  names = jsonb_build_object('az', 'Administrator', 'en', 'Administrator', 'ru', 'Администратор'),
  descriptions = jsonb_build_object(
    'az', 'Hər şeyə icazəsi var. Dəyişdirilə və silinə bilməz.',
    'en', 'Can do everything. Cannot be changed or deleted.',
    'ru', 'Имеет доступ ко всему. Нельзя изменить или удалить.')
where id = 'admin';

update public.roles set
  names = jsonb_build_object('az', 'İstifadəçi', 'en', 'User', 'ru', 'Пользователь'),
  descriptions = jsonb_build_object(
    'az', 'Bütün tətbiq. Yeni hesablar bu rolu alır.',
    'en', 'The whole app. New accounts get this role.',
    'ru', 'Всё приложение. Новые аккаунты получают эту роль.')
where id = 'user';
