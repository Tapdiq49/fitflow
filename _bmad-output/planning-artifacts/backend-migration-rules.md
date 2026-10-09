# Backend migration rules: Supabase first, NestJS-ready

Status: decided 2026-10-07. **Phase 1, authentication: implemented 2026-10-07** (see "Authentication" below). **Phase 2, data migration (`StoreService` → Postgres): started 2026-10-09** — days, weights and exercise history now go to the account (see "Authentication" below); every change is sent to the backend first and written locally only after it said yes (rule 8).

## Authentication (phase 1, done)

- Sign in with e-mail or username + password, Google; sign up with e-mail, username, e-mail preferences; forgot / reset password; username setup after a first OAuth sign-in. Login is optional: **guests keep using the app** and see a dismissible notice (back after 7 days, `Settings.guestNoticeDismissedAt`) that their data lives only in this browser.
- Code: `core/auth/` (port `AuthService`, adapter `supabase-auth.service.ts`, `AuthStore`, guards, error mapping), `features/auth/` (pages), `supabase/` (migration, `login` Edge Function, setup README).
- Username login: the Edge Function `login` resolves username → e-mail with the service role and signs in server side, so e-mails are never readable by the public; unknown user and wrong password answer the same; failures are throttled in `login_attempts`. NestJS equivalent: `POST /auth/login`.
- With e-mail confirmation on, Supabase answers a sign-up for an existing address like a new one, so the UI cannot (and must not) say "email already registered".
- **Phase 2 started with the food reference list (Soraqçalar), 2026-10-07:** table `foods` (system rows `user_id IS NULL` seeded from `data/foods.ts`, user rows per `user_id`, RLS as in `20261007000300_foods.sql`), `FoodRepository` port + Supabase adapter, shared `SupabaseClientProvider`. Users add, edit and delete their own foods and put every food in their own order (`food_order` table, `food_list` view, RPC `move_food`); guests only read the system foods; adding a food needs a sign-in, and there is no local copy of user foods (`AppState.customFoods` was removed). Migrate the other data one table at a time the same way (port in `core/repositories/`, adapter, fake for specs, one `StoreService`-owning service).
- The menu generator now runs on the backend food list too: `foods` carries role/step/min_amount/max_amount for system foods, a copy is kept in `AppState.foodCache` for offline use, and every new meal item snapshots unit and macros (`MealItem.per`/`unit`) so saved menus stay frozen. `data/foods.ts` remains as the last-resort copy for a first visit without a connection.
- **Height and starting weight moved to the profile, 2026-10-07:** columns `profiles.height_cm` / `start_weight_kg` (`..._profiles_body.sql`), read with the user (`AuthUser`), written through `AuthService.setBodyBasics`; `BodyBasicsSyncService` copies them both ways (account wins at sign-in, local values are dropped when the account has none). Weights, days, plans and the rest are still local.
- **Weekly trainer plans moved to the account, 2026-10-07:** table `trainer_plans` (`..._trainer_plans.sql`; jsonb per user, kind and week), `PlanRepository` port + Supabase adapter + fake, `PlanSyncService` (account wins at sign-in, later changes are sent; guests stay on localStorage). Weights, days, history and settings are still local.
- **Settings moved to the account, 2026-10-07:** `profiles.settings` (`..._profiles_settings.sql`; every synced setting), `AuthService.setSettings`, `SettingsSyncService` (account wins at sign-in; guests stay on localStorage). Weights, days, history and the generated menus are still local.
- **Days, weights and exercise history moved to the account, 2026-10-09:** tables `days` (`record jsonb` = `DayRecord`), `weights`, `exercise_history` and the function `apply_user_data(jsonb)` (`..._user_data.sql`; RLS `user_id = auth.uid()`), `UserDataRepository` port + Supabase adapter + fake, `DataSyncService` (`commit` / `commitDay`: account first, local after; one change at a time; at sign-in the account wins, and a browser's data is uploaded once when the account holds none — rule 7). A write is one RPC call, so a change that touches several tables (saving a workout = history rows + the day's check mark) is one transaction. NestJS equivalent: one endpoint that runs the same statements in a transaction. Typing fields save on `change`, not on every keystroke. Past days stay frozen (rule 9): the settings that shape a day are copied into `DayRecord.snap` (saved to the account) before they change (`SettingsService.save`).
- Still local only: `foodCache` (a copy of the backend food list). Phase 2 still needs `AuthService.accessToken()` only if a NestJS API replaces the Supabase client.
- NestJS move for auth: implement `AuthService` over HTTP (`/auth/login`, `/auth/register`, …), port `profiles` to the new `users` table, keep `AuthStore` and the pages unchanged.

## Why a backend

All data (`AppState` in `common/interfaces/state/app-state.ts`) lives in one browser's localStorage under `fitflow.v1`. Opening the app on another device shows nothing. The goal is per-user data: sign in anywhere and see your own settings, days, menus, weights, weekly meal/workout plans and history.

## Decision

1. Build on **Supabase** (Auth + Postgres) first: least operations work for a single-user app, free tier is enough to start.
2. Keep the door open to move to **NestJS + Postgres** later, when the user asks. The rules below keep that move cheap (adapter swap, not a rewrite).

Supabase free plan (checked 2026-10-07, <https://supabase.com/pricing>): 500 MB database, 50 000 monthly active users, 5 GB egress. Caveats: the project is paused after one week of inactivity (<https://supabase.com/docs/guides/platform/free-project-pausing>) and there are no downloadable backups. Pro (about $25/month) removes the pausing and adds 7 daily backups. Move to Pro once other people use it or the data matters.

## Rules while implementing

1. **One seam.** Every read/write already goes through `StoreService` (`mutate`, `mutateDay`, `replace`, `reset`, `updateSettings`). Put persistence behind a small repository interface used by `StoreService`. The Supabase SDK is imported in the adapter file(s) only — never in components, pages or other services. Moving to NestJS then means writing a second adapter that calls an HTTP API.
2. **Plain Postgres.** Schema lives in versioned SQL migrations in the repo. UUID primary keys, `created_at` / `updated_at`, and a `user_id` column on every table. No Supabase-only column types or functions. Storage and further Edge Functions need the user's approval; Realtime is approved (decision 2026-10-09, rule 12).
3. **Keep the data shape.** Do not redesign `AppState`. Suggested tables: `settings` (one row per user), `days` (`user_id`, `date`, `record jsonb` = `DayRecord`), `weights`, `week_plans` and `workout_plans` (`week` Monday key + `plan jsonb`), `history` (`exercise_id`, `date`, `sets jsonb`). `jsonb` for the nested parts keeps `fitflow.v1` backups importable unchanged.
4. **Auth behind an interface.** An `AuthService` exposes "current user id", "session token", sign in and sign out. Supabase Auth issues a JWT; a NestJS API can issue one too. UI code must not touch Supabase user objects or metadata.
5. **Authorization as one rule.** Row Level Security policy: `user_id = auth.uid()` for select/insert/update/delete on every table. Put a comment above each policy: "NestJS equivalent: guard + `WHERE user_id = :currentUser`". Never rely on the client to filter by user.
6. **Secrets.** Only the public (anon) key may be in the client. The service-role key and database password never go into the repo or the Angular bundle. The project URL and the publishable key live in `src/environments/environment*.ts` and are committed (they are public by design).
7. **First sign-in import.** Existing browser data must be uploaded once: reuse the JSON import path (`StoreService.replace` → `normalize`) and the same `fitflow.v1` shape; keep the Export (JSON) button working as a manual backup.
8. **Offline and conflicts (decided 2026-10-09).** Offline use is not required and there is one device per user, so there is no write queue and no conflict resolution. A change is sent to the backend first; only when it answers with success (HTTP 2xx) is `localStorage` updated, as `PlanSyncService.persist` and `BodyBasicsSyncService.persist` already do. A failed request changes nothing and the UI shows the offline / server error.
12. **Realtime (decided 2026-10-09).** If live updates are needed later, use Supabase Realtime. Keep it behind a port (for example `core/repositories/*-changes.ts`: `subscribe(table, handler)` returning an unsubscribe function) and import the SDK in the adapter only, so a NestJS move is an adapter swap (WebSocket / Socket.IO gateway or SSE with the same port). Never leak Supabase channel or payload types into services or components. Realtime is not built yet; Firebase is not used.
9. **Past days stay frozen.** The backend must not recompute stored past days when settings or plans change; keep the existing rule (`DayRecord.snap`, menus of past days untouched).
10. **Translations.** `az/en/ru.json` stay bundled. If they ever move to the backend, the bundled Azerbaijani file remains the fallback and `translate.spec.ts` keeps checking the bundled files.
11. **Free-plan safety net.** Add a periodic JSON export (or a scheduled dump) so the missing free-plan backups are not a single point of failure.
13. **Language in the URL (decided 2026-10-09).** The backend returns text that belongs to built-in data (names of the built-in roles today; later system foods, categories and the like) already translated, in the language the request names. The language is part of the request URL, as the query parameter `lang=az|en|ru` on GET reads (`GET …/admin-users?page=1&pageSize=10&search=&lang=en`); a missing or unknown value means `az`. It is a query parameter, not a path segment, because Supabase routes `/functions/v1/<name>` by its first segment (`/functions/v1/az-AZ/admin-users` would look for a function called `az-AZ`); a NestJS API can keep the same query parameter. The adapter adds `lang: activeLang()` while it builds the request, so a list read through `pagedResource` asks again when the language changes, and other lists reload on a language switch. The UI shows the name as it comes and does not translate it again; text a person typed (a role they created) has only that one name and is returned as stored. A new backend list or function that returns such built-in text follows this rule.

## Moving to NestJS later: checklist

- `pg_dump` of the database; users from Supabase Auth (password hashes can be exported, or each user resets the password once).
- Implement the repository interface over HTTP; keep `StoreService` unchanged.
- Port each RLS policy to a NestJS guard and a `user_id` filter in the data layer.
- Replace Supabase Auth with NestJS-issued JWTs; keep the `AuthService` interface.
- Host, back up and monitor the API and database; plan the cut-over (read-only window, final dump, switch the adapter).

## Open questions for the user

- ~~Login method~~ — decided: e-mail/username + password, Google; offline is not needed for auth (needs a connection; guests keep working offline).
- ~~Offline use~~ — decided 2026-10-09: not needed; backend first, `localStorage` after a 2xx answer (rule 8).
- ~~Realtime~~ — decided 2026-10-09: Supabase Realtime when needed, behind a port (rule 12).
- Create the Supabase project (free account) now or when the migration starts?
