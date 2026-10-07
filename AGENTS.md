<!-- bmad:context -->
<!-- Verified 2026-10-06 against the working tree (not a git repository, no SHA). Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## fitflow

Single-user fitness tracker: workouts, generated daily menu, weight, digestion, supplements. Angular 22 (standalone, signals), Chart.js, Vitest. No backend yet — all data lives in browser localStorage; Supabase is the planned backend. BMAD planning output goes to `_bmad-output/`.

## Policy

- Do not change exercises, progression increments, phase/RIR limits or `SAFETY` text in `src/app/core/data/program.ts` and `ProgramService.phase()` without the user's explicit approval — they encode post-surgery (varicocele) loading caution. Propose the change instead.
- Do not add Supabase (client, SDK, env config) or any other backend yet — persistence stays static in localStorage until the user starts that migration. Keep every read/write behind `StoreService` so the swap stays in one place.
- Ask before adding a runtime dependency to `package.json`.

## Where things are

- Persisted state shape: `AppState` in `src/app/core/models.ts`; owned by `src/app/core/services/store.service.ts`.
- Day orchestration (plan creation, timeline, score): `src/app/core/services/day.service.ts`.
- Static catalogs (foods, meal templates, exercise program, tips): `src/app/core/data/`.
- Reference lists ("Soraqçalar", `features/references/`): the data behind a select. `/references` is a grid with one card per list, driven by `REFERENCE_LISTS` in `reference-lists.ts`; a card opens `/references/<id>`. A new list = one registry entry, its own page and route, and a service owning its data; never put a list directly on the index page. Today only the food database (`food-references.page.ts`); system entries come from `data/`, the user's own are persisted (`AppState.customFoods`, via `FoodCatalogService`). Entries carry `isSystem`, system ones can never be deleted, and user foods have `names` per language so backend data of that shape can replace the system part later. The menu generator reads only the system `FOODS`; a user food is added to a meal as a self-contained item. Selects driven by code behaviour (meals per day, menu/workout mode, theme, language) are not reference lists.

## Running and verifying

- `ng` is not on PATH; use `npx ng …` or the npm scripts.
- Run tests once with `npx ng test --watch=false`; `npm test -- --watch=false` fails under npm 12 (`Unknown cli flag`).
- After touching `MenuService`, `data/foods.ts` or `data/meals.ts`, run `menu.service.spec.ts` — it pins every generated day to 2600–2800 kcal and 170–190 g protein.
- Never run `prettier --write` on existing files — the code is hand-formatted and matches no `printWidth` in `.prettierrc`, so it rewrites whole files. Match the surrounding formatting instead.

## Conventions that differ from defaults

- Change state only through `StoreService.mutate()` / `mutateDay()`, called from a service in `core/services/` — never from a component, never by writing `localStorage` directly.
- Edit only the draft passed to the `mutate` callback; it is a `structuredClone`, and every `computed` depends on getting a new reference.
- A new `AppState`, `Settings` or `DayRecord` field needs a default in `StoreService.normalize()` / `DEFAULT_SETTINGS` / `newDay()`; keep the `fitflow.v1` key — existing data and JSON backups load through it.
- Business rules (progression, menu scaling, score, bloat triggers, body advice) live in `core/services/` or the pure helpers in `core/nutrition.ts` / `core/utils.ts`, not in components; a change to one gets a test in the co-located `*.spec.ts`.
- Dates are local `YYYY-MM-DD` keys built with `DateU` (`core/utils.ts`), weekday 1 = Monday; never derive them from `toISOString()` (UTC shifts the day).
- User-facing text goes through `t('area.englishName')` / `| t` (`core/i18n/translate.ts`); every text is a named key in the flat maps `core/i18n/{az,en,ru}.json`, Azerbaijani being the source language. Built-in content (foods, meals, tips, exercise notes, phases) keeps its Azerbaijani text in code and saved menus; it has keys with a content prefix (`food.`, `meal.`, `tip.`, …) and is translated at display with `td()` / `| td`. A new text needs its key in all three JSON files (`translate.spec.ts` checks this). Identifiers and comments stay English.
- Components are standalone, `OnPush`, with inline templates and `inject()`; a new page is a lazy `loadComponent` route plus a `NAV` entry in `app.routes.ts`.
- Form controls come from `shared/forms/`, built on Angular Aria (`@angular/aria`) with CDK Overlay (`@angular/cdk`) for the popup: dropdowns use `<app-select [label] [options] [(value)]>` (options are `{ value, label }` with the label already translated, so build them in a `computed` that calls `t()`), times use `<app-time-picker [label] [(value)]>`. Never add a native `<select>`, and do not write another custom popup; extend `shared/forms/` instead. Tabs use `ngTabs`, multi-choice toggles `ngListbox [multi]`. Aria has no checkbox or text input, so those stay native `<input>`; a custom checkbox-looking button needs `role="checkbox"` and `aria-checked`.
- `@angular/aria` and `@angular/cdk` add about 100 kB to the bundle. Keep them out of the initial chunk: a component that uses `app-select` / `app-time-picker` and sits in the app shell (`app.ts`) goes in a `@defer` block; page components are lazy routes and are fine. `bundle initial` has a 500 kB budget.
- Header and modals: the app header is `sticky` and publishes its height as `--header-h`; anything else sticky under it uses `top-[var(--header-h,0px)]` and an opaque background (rounded corners and gaps must be covered, or scrolled content shows through). `ModalComponent` hides the page scrollbar by setting `overflow` on `<body>`, never on `<html>` (that would make `<body>` its own scroller and the sticky sidebar scrolls away).

## Known pitfalls

- `settings.page.ts` and `supplements.page.ts` still call `store.mutate()` directly — do not copy that pattern; move the mutation into a service when you touch those files.

<!-- /bmad:context -->

## Backend migration (kept outside the managed block)

When the user starts the Supabase migration, follow `_bmad-output/planning-artifacts/backend-migration-rules.md` (Supabase first, adapter-only SDK use, plain Postgres, so a later NestJS + Postgres move is an adapter swap). Do not start it before the user says so.
