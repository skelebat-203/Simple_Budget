# RESUME-HERE

Tracking file for current work status. Roadmap authority: `docs/design/0003-roadmap.md`.
Table design: `docs/design/0004-table-design.md`.

## Current state
- Version: v0.2.5
- v0.1 complete (security review approved; findings fixed).
- v0.2 in progress: category hierarchy model + seed data, estimates/frequency/dueDate/autopay on BudgetItem, Day table (Est./Act.), validation, accessibility, security review.
- Automated accessibility audit (v0.2.5): Lighthouse accessibility 100/100, 0 failing audits; run on built app via `vite preview`.
- v0.2.6 UI/UX refactor in progress (execution plan item 7).
## v0.2 execution plan

Steps are ordered by version target. Within a subversion, each completed step bumps the last segment to the item's number (v0.2.0 → v0.2.1 …); the final item of the subversion bumps the middle segment and restarts the counter (v0.2's final item → v0.3.0). Commits autonomously per `versioning.md` (update `package.json` `version` without `v` prefix in the same pass).

1. **Cleanup + structure** (v0.2.1) ✅ — strip Vite boilerplate from `src/App.css`; remove unused assets `react.svg`, `hero.png` (keep `vite.svg`, it is the PWA icon per `vite.config.ts`); verify `src/` layout.
   - Files: `src/App.css`, `src/assets/*`, `vite.config.ts` (read-only check).
   - Deliverable: clean app shell CSS; no leftover boilerplate.
   - Verify: app runs, no console errors, icon still resolves.
   - Deps: none. Can run in parallel with nothing else; gate for steps 2 and 3.

2. **Category model + seed data** (v0.2.2) ✅ — Dexie schema bump to v2 with a `categories` tree (parent/child, color, `computed` flag); seed the full hierarchy from `0004-table-design.md` via a seed helper.
   - Files: `src/storage/db.ts`, `src/storage/repository.ts`, new seed module (e.g. `src/storage/seed.ts`).
   - Deliverable: `categories` table populated on first run; computed rows flagged.
   - Verify: DB inspection shows full tree with colors and computed flags.
   - Deps: step 1. Parallelizable with step 3.

3. **BudgetItem fields + add flow** (v0.2.3) ✅ — add `estimate`, `frequency`, `dueDate`, `autopay` to `BudgetItem`; DB bump to v3; repository update; AddBudget asks for estimated spend + recurrence dropdown (day/week/month/bimonthly/biweek).
   - Files: `src/storage/db.ts`, `src/storage/repository.ts`, `src/screens/AddBudget.tsx`.
   - Deliverable: item persists new fields; add flow captures estimate + frequency.
   - Verify: add an item, reload, fields round-trip.
   - Deps: step 1. Parallelizable with step 2.

4. **Day table** (v0.2.4) ✅ — Est./Act. columns; only rows with amounts; category grouping; computed rows rendered.
   - Files: `src/screens/Budget.tsx`, table components under `src/components/`.
   - Deliverable: Day view matches `0004-table-design.md` (structure + style rules).
   - Verify: manual check against table design; computed rows show sums.
   - Deps: steps 2 and 3.

5. **Validation + accessibility** (v0.2.5) ✅ — tighten validation (required fields, amount parsing); keyboard nav, ARIA, contrast. Fix `--color-primary-background: brown` in `src/styles/tokens.css` (fails 4.5:1 contrast).
   - Files: `src/styles/tokens.css`, form components under `src/components/ui/*`, `src/screens/AddBudget.tsx`, `src/screens/Budget.tsx`.
   - Deliverable: forms reject bad input with clear errors; a11y pass (Lighthouse ≥ 90).
   - Verify: Lighthouse audit + manual keyboard/screen-reader walkthrough.
   - Deps: steps 2–4.

6. **Security review** (v0.3.0) — produce `docs/audits/security/security-v0.2.md` (one domain at a time per security-report-style).
   - Files: `docs/audits/security/security-v0.2.md`.
   - Deliverable: audit file covering all domains in scope.
   - Verify: user review of each domain before proceeding.
   - Deps: steps 1–5. Completes v0.2 and transitions to v0.3.0.

7. **UI/UX refactor** (v0.2.6) — refactor per `docs/human_scratch_files/stuff.md`:
   1. **Combined item control** — single "Item" control replacing item name + type; filtered option list of items/categories as the user types; categories larger + bold; subcategories bold; items normal weight; color coding applied to the options list; ordered category → subcategory → alphabetical.
   2. **CSS classes instead of inline styles** — remove `style` attributes; use reusable CSS classes.
   3. **Negative amounts** — allow credit amounts on items.
   4. **Separate estimate flow** — "Set estimates" button launches a "Budget setup" overlay: checkbox group of regularly-used items (preselected defaults; not required; collapses but does not remove on save), per-category/subcat "Create" input + "add" button (disabled until a value is entered; `aria-describedby` references the input), expander table with Item name / Estimated spending / Recurrence / Autopay columns (recurrence only for income, debt, utilities, subscriptions, shown side-by-side "pre" control; Estimated spending inputs named by `aria-labelledby` referencing the column header and `aria-describedby` referencing the item name; categories/subcats show no controls except Charity when it is the only selected item in its category), Autopay for debt/utilities/subscriptions, default display range toggle (day/week/month).
   5. **Bi-monthly fix** — bi-monthly means twice a month, not every 2 months.
   6. **Table scheme** — the table must honor the scheme in `0004-table-design.md`.
   - Files: `src/screens/AddBudget.tsx`, `src/screens/Budget.tsx`, table components under `src/components/`, `src/styles/tokens.css`.
   - Deliverable: refreshed UI/UX matching `stuff.md` notes.
   - Verify: manual review against the `stuff.md` notes and table design.
   - Deps: steps 2–5.

## Computed rows
See `0004-table-design.md` (each marked `*` in the hierarchy with its formula). Not restated here.

## Rules
- Each completed item: commit + version bump (per `versioning.md`).
- Human-facing docs in `docs/`; do not duplicate docs.
- Stop and ask on any uncertainty.