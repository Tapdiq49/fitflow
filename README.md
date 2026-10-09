# Fitflow

Single-user fitness tracker: workouts, a generated daily menu, weight, digestion and supplements.
Angular 22 (standalone components, signals), Tailwind CSS 4, Chart.js, Vitest. Data lives in the
browser's localStorage; Supabase provides authentication, profile and settings, weekly trainer plans
and the food reference list (see `supabase/README.md`).

## Requirements

- Node.js with npm 12 (`packageManager` in `package.json`)
- A Supabase project, only if you want sign-in. Without it the app runs as a guest.

## Setup

```bash
npm install
```

`ng` is not on the PATH, so use `npx ng ...` or the npm scripts.

For sign-in, fill in `src/environments/environment.ts` (dev) and `environment.prod.ts` (production
build) and set up the database and Edge Functions as described in [supabase/README.md](supabase/README.md).
Left empty, authentication is off.

## Commands

| Task | Command |
| --- | --- |
| Dev server (http://localhost:4200) | `npm start` or `npx ng serve` |
| Production build (`dist/`) | `npm run build` or `npx ng build` |
| Unit tests, once | `npx ng test --watch=false` |
| Unit tests, watch mode | `npx ng test` |

`npm test -- --watch=false` fails under npm 12 (`Unknown cli flag`); use the `npx ng test` form.
The initial bundle has a 500 kB budget, and the production build fails when it is exceeded.

Do not run `prettier --write` on existing files: the code is hand-formatted and it would rewrite
whole files.

## Project layout

| Path | Contents |
| --- | --- |
| `src/app/core/` | Services, auth, data catalogs, i18n, pure helpers (`nutrition.ts`, `targets.ts`, `utils.ts`) |
| `src/app/features/` | Lazy-loaded pages (dashboard, workout, body, calendar, settings, admin, ...) |
| `src/app/shared/` | Reusable components, form controls, tables |
| `src/app/common/` | Interfaces and permission ids |
| `src/styles/` | Skins and display options |
| `supabase/` | SQL migrations, Edge Functions, setup guide |
| `_bmad-output/` | Planning and implementation notes |

## Further reading

- [AGENTS.md](AGENTS.md): project rules and architecture notes (also used by AI coding agents)
- [supabase/README.md](supabase/README.md): backend setup
- [_bmad-output/planning-artifacts/backend-migration-rules.md](_bmad-output/planning-artifacts/backend-migration-rules.md): backend migration decisions
