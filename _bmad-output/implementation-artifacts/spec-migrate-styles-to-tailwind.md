---
title: 'Migrate app styles to Tailwind CSS'
type: 'refactor'
created: '2026-10-06'
status: 'in-review'
baseline_commit: 'NO_VCS'
route: 'dispatch'
review_loop_iteration: 0
context: ['{project-root}/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** All styling lives in one hand-written global `src/styles.scss` (~214 class rules, 3 breakpoints) referenced by class names in 24 component templates, so styles are detached from the markup that uses them and a later light theme would have to touch hard-coded colors everywhere.

**Approach:** Install Tailwind CSS v4 through Angular's PostCSS pipeline, expose the existing color/radius/shadow tokens as Tailwind theme tokens backed by CSS variables, and rewrite every template's custom classes as Tailwind utilities so the app looks the same as before.

## Boundaries & Constraints

**Always:** Visual parity with the current dark UI at desktop (>960px), tablet (≤960px) and phone (≤560px) widths, including the sidebar → bottom-nav switch, sticky workout bar, modal, toast, rest pill and `rise` animation. Colors come only from theme tokens that resolve to `:root` CSS variables, so the deferred light theme only has to redefine variables. Azerbaijani UI text and all component logic stay unchanged.

**Decisions:** Shared primitives (`btn*`, `card`, `badge`, `chip`, `check`, `bar`, `alert`, `field`, `tbl`, `modal-box`, `nav-btn` and similar ones reused across many templates) are defined once as Tailwind `@utility` classes built from theme tokens; everything else becomes inline utilities (user delegated the choice; option A). No version-control setup in this spec — the user will initialize git afterwards; a pre-change copy of `src/`, `angular.json` and `package.json` is kept outside the repo as a rollback point.

**Never:** No light/dark toggle in this spec (deferred in `deferred-work.md`). No changes to services, models, data or routing. No new runtime dependencies — Tailwind packages go in `devDependencies`. Do not run `prettier --write` on existing files (AGENTS.md). Do not restyle or "improve" the design.

</frozen-after-approval>

## Code Map

- `src/styles.scss` -- the only stylesheet: `:root` tokens (L2-12), base element rules, all component classes, breakpoints 1200/960/560px (L238-266), Angular-specific overrides (L268-274). Source of truth for parity.
- `angular.json` -- `build.options.styles` points at `src/styles.scss`; `inlineStyleLanguage: scss`; `anyComponentStyle` budget 4kB/8kB.
- `src/index.html` -- Inter font link and `theme-color` meta; keep as is.
- `src/app/app.ts` -- shell: sidebar, topbar, date nav, bottom nav (`nav-btn`, `routerLinkActive="active"` must keep working).
- `src/app/features/**` -- 20 templates using the classes; heaviest: `dashboard/meals-card` (51 usages), `workout/workout.page` (44), `digestion`, `body` (40 each), `dialogs/add-meal` (33), `dashboard/stat-cards` (33).
- `src/app/shared/*.component.ts` -- modal, overlays (toast, rest pill), chart (`chart-box`, `.sm`), type-badge, icon (`.icon`, `.icon.sm`).
- `src/app/core/services/bloat.service.ts:53` -- `levelClass()` returns `lvl-low|mid|high` class names used with `[class]` in `digestion.page.ts:60`; must return Tailwind classes instead and keep the `!important` override behavior.
- Dynamic class bindings (`[class.done]`, `[class.active]`, `[class]="..."` string concatenation such as badge type) -- every class name produced at runtime must appear as a full literal string in source so Tailwind detects it.
- `src/app/core/charts.ts` -- Chart.js colors are hard-coded hex; leave unchanged (theme work is deferred).
- 75 inline `style=`/`[style.*]` bindings (widths, `--v` ring value) -- keep; they are data-driven.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add `tailwindcss`, `@tailwindcss/postcss`, `postcss` (v4.3.x) as devDependencies -- Angular's documented Tailwind v4 setup.
- [x] `.postcssrc.json` -- create with the `@tailwindcss/postcss` plugin -- Angular's builder picks it up automatically.
- [x] `src/styles.css` (replacing `src/styles.scss`) + `angular.json` -- `@import "tailwindcss"`, `:root` variables, `@theme inline` mapping tokens (colors, radius, shadow, font) to the variables, `rise` keyframe/animation token, base element rules, shared primitives as `@utility` classes -- Tailwind v4 does not run through Sass.
- [x] `src/app/app.ts` and `src/app/shared/*.component.ts` -- replace classes with utilities, responsive variants for the 960px/560px rules (custom breakpoints in `@theme` if needed).
- [x] `src/app/features/**/*.ts` -- replace classes with utilities, file by file, keeping every `[class.x]` toggle working.
- [x] `src/app/core/services/bloat.service.ts` -- `levelClass()` returns Tailwind color utilities.
- [x] Delete `src/styles.scss` once no template references its classes.

**Acceptance Criteria:**
- Given the migrated app, when each of the 7 routes plus the add-meal and day-detail dialogs is opened at 1280px, 800px and 390px width, then layout, colors, spacing and states (active nav, done meal, next timeline item, checked set, chip on) match the pre-migration app.
- Given the source, when searching templates for class names defined in the old `styles.scss`, then none remain except the agreed shared primitives.
- Given a production build, then it succeeds within the existing budgets.

## Design Notes

Theme tokens stay variable-backed so the deferred light theme is a variable swap:

```css
@theme inline {
  --color-surface: var(--surface);
  --color-accent: var(--accent);
  --radius-card: var(--radius);
}
```

Translucent tints like `rgba(182,242,63,.12)` become opacity modifiers on tokens (`bg-accent/12`).

## Verification

**Commands:**
- `npx ng build` -- expected: success, no budget errors.
- `npx ng test --watch=false` -- expected: all tests pass.

**Manual checks:**
- Screenshot every route and both dialogs at 1280/800/390px before and after, and compare them side by side.

## Implementation Notes

- Preflight is not imported: `src/styles.css` imports `tailwindcss/theme.css` and `tailwindcss/utilities.css` (with `@source './app'`) instead of the all-in-one `@import "tailwindcss"`. The UI relied on browser defaults (paragraph/list margins, heading sizes, inline SVG, checkbox margins); preflight would have changed them everywhere.
- Breakpoints are `@custom-variant`s that reproduce the original `max-width` queries exactly: `laptop` (≤1200px), `tablet` (≤960px), `phone` (≤560px), declared largest first so smaller ones win.
- `@theme inline` clears Tailwind's default colors and radii (`--color-*: initial`, `--radius-*: initial`), so every color utility resolves to a `:root` variable. Added variables for colors that were hard-coded before: `--border-strong`, `--border-hover`, `--accent-hover`, `--sidebar-top`, `--backdrop`, `--shade`.
- Primitives (`@utility`): icon, nav-btn, card, card-head, eyebrow, btn, badge, field, bar, alert, empty, check, kv, sum-box, tbl, chip, modal-box, section-title. Their modifiers are nested inside the primitive (`.btn.btn-primary`), so they always override the base no matter how Tailwind orders utilities. Modifier and state classes now carry the primitive's prefix: `btn-done`, `btn-active`, `badge-training|cardio|rest|warn`, `alert-warn|good|bad|info`, `chip-on`, `check-on`, `bar-kcal|protein|water|sleep`, `icon-sm`, `tbl-num`, `tbl-text`, `nav-btn-bottom`. `routerLinkActive="active"` is kept as is, as `.nav-btn.active`.
- When a plain utility overrides a property that a primitive sets on the same element, it uses `!` (water buttons, digestion bar height, hero padding), because Tailwind does not guarantee the order between custom and built-in utilities.
- Mutually exclusive state classes (meal/exercise done, timeline next/done, calendar today/out, toast, rest pill) use one `[class]` ternary of literal strings. Dynamic class strings (type badge, calendar tag, alert level) come from literal maps.
- Grids that used `1fr` rather than `minmax(0,1fr)` (water buttons, sleep inputs, the phone layout for exercise meta) use arbitrary `grid-cols-[…]`, because `grid-cols-N` would change how wide the columns are.
- The hero and next-timeline-item gradients use the `background` shorthand (`[background:…]`). With `background-image` set on its own, Chrome dropped LCD text antialiasing inside the hero.
- `app.spec.ts` selectors were changed from the removed `.sidebar` and `.date-nav` classes to `aside` and the date-nav button's parent.
- `angular.json`: `inlineStyleLanguage` and the component schematic's `style` are switched from scss to css.
- Rollback copy (`src/`, `angular.json`, `package.json`, `package-lock.json` and a pre-migration build in `dist/`) is at `C:/repos/Try/fitflow-pre-tailwind-backup`.
- Verification: a headless-Chrome harness (frozen clock, identical seeded localStorage) screenshotted all 7 routes, the workout page on a training day with a checked set and the rest pill, and both dialogs at 1280/800/390px, before and after. All 30 full-page screenshots are pixel-identical.

## Spec Change Log

## Review Triage Log
