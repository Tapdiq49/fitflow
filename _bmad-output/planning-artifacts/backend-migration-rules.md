# Backend migration rules: Supabase first, NestJS-ready

Status: decided 2026-10-07, **not started**. Until the user says to begin, the app stays on localStorage and no Supabase SDK, client or env config is added (see `AGENTS.md` → Policy).

## Why a backend

All data (`AppState` in `core/models.ts`) lives in one browser's localStorage under `fitflow.v1`. Opening the app on another device shows nothing. The goal is per-user data: sign in anywhere and see your own settings, days, menus, weights, weekly meal/workout plans and history.

## Decision

1. Build on **Supabase** (Auth + Postgres) first: least operations work for a single-user app, free tier is enough to start.
2. Keep the door open to move to **NestJS + Postgres** later, when the user asks. The rules below keep that move cheap (adapter swap, not a rewrite).

Supabase free plan (checked 2026-10-07, <https://supabase.com/pricing>): 500 MB database, 50 000 monthly active users, 5 GB egress. Caveats: the project is paused after one week of inactivity (<https://supabase.com/docs/guides/platform/free-project-pausing>) and there are no downloadable backups. Pro (about $25/month) removes the pausing and adds 7 daily backups. Move to Pro once other people use it or the data matters.

## Rules while implementing

1. **One seam.** Every read/write already goes through `StoreService` (`mutate`, `mutateDay`, `replace`, `reset`, `updateSettings`). Put persistence behind a small repository interface used by `StoreService`. The Supabase SDK is imported in the adapter file(s) only — never in components, pages or other services. Moving to NestJS then means writing a second adapter that calls an HTTP API.
2. **Plain Postgres.** Schema lives in versioned SQL migrations in the repo. UUID primary keys, `created_at` / `updated_at`, and a `user_id` column on every table. No Supabase-only column types or functions. Do not use Realtime, Storage or Edge Functions without asking the user.
3. **Keep the data shape.** Do not redesign `AppState`. Suggested tables: `settings` (one row per user), `days` (`user_id`, `date`, `record jsonb` = `DayRecord`), `weights`, `week_plans` and `workout_plans` (`week` Monday key + `plan jsonb`), `history` (`exercise_id`, `date`, `sets jsonb`). `jsonb` for the nested parts keeps `fitflow.v1` backups importable unchanged.
4. **Auth behind an interface.** An `AuthService` exposes "current user id", "session token", sign in and sign out. Supabase Auth issues a JWT; a NestJS API can issue one too. UI code must not touch Supabase user objects or metadata.
5. **Authorization as one rule.** Row Level Security policy: `user_id = auth.uid()` for select/insert/update/delete on every table. Put a comment above each policy: "NestJS equivalent: guard + `WHERE user_id = :currentUser`". Never rely on the client to filter by user.
6. **Secrets.** Only the public (anon) key may be in the client. The service-role key and database password never go into the repo or the Angular bundle. Use environment config files that are not committed for keys.
7. **First sign-in import.** Existing browser data must be uploaded once: reuse the JSON import path (`StoreService.replace` → `normalize`) and the same `fitflow.v1` shape; keep the Export (JSON) button working as a manual backup.
8. **Offline and conflicts.** Decide before building (open question below). Default proposal: write locally first, queue writes, send when online, last write wins per `days` row using `updated_at`.
9. **Past days stay frozen.** The backend must not recompute stored past days when settings or plans change; keep the existing rule (`DayRecord.snap`, menus of past days untouched).
10. **Translations.** `az/en/ru.json` stay bundled. If they ever move to the backend, the bundled Azerbaijani file remains the fallback and `translate.spec.ts` keeps checking the bundled files.
11. **Free-plan safety net.** Add a periodic JSON export (or a scheduled dump) so the missing free-plan backups are not a single point of failure.

## Moving to NestJS later: checklist

- `pg_dump` of the database; users from Supabase Auth (password hashes can be exported, or each user resets the password once).
- Implement the repository interface over HTTP; keep `StoreService` unchanged.
- Port each RLS policy to a NestJS guard and a `user_id` filter in the data layer.
- Replace Supabase Auth with NestJS-issued JWTs; keep the `AuthService` interface.
- Host, back up and monitor the API and database; plan the cut-over (read-only window, final dump, switch the adapter).

## Open questions for the user

- Login method: e-mail + password, Google, or both?
- Is offline use needed (gym with weak signal), or can we assume a connection?
- Create the Supabase project (free account) now or when the migration starts?
