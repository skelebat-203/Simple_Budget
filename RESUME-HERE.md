# RESUME-HERE

Tracking file for current work status. Roadmap authority: `docs/design/0003-roadmap.md`.
Design: `0004-table-design.md` (table), `0006-prototype.html` (v0.2 UI), `0007-v0.3-design-updates.md` (v0.3 changes; wins on conflict).

## Current state
- Version: v0.4.1. v0.3 complete (security review approved, `docs/audits/security/security-v0.3.md`). v0.2 complete (security review approved, `docs/audits/security/security-v0.2.md`).
- Data: Dexie v8 (frequency/range `annual`; Income group, stored sibling `order`, `computed` only on top-level rows; see `src/storage/structure.ts`). Amounts link to categories by `categoryId`; estimate fields live on `Category`. `needsReview` removed (0007 §8.4).
- Next: v0.4 Groups B and D (steps 3 and 10).
- Testing: headless Chromium via host flatpak + puppeteer-core; scripts in the session scratchpad.

## v0.4 plan of action

Covers every v0.4 roadmap item. Each completed step bumps the last version segment to the step number (v0.4.1, v0.4.2 …); the final step bumps to v0.5.0. Commit on each bump per `versioning.md`. UI-touching steps are not complete until the human approves the UI/UX (`0005-ui-ux-review-checklist.md`).

**Roadmap item "Week/Month/Annual table views":** reviewed 2026-11-02. Month (week columns + Total, Est./Act.) and Annual (12 months + Total, actuals only per 0007 §7) are done. Week is still one column; the per-day breakdown is step 4. The item closes with step 4.

**Execution (human decision 2026-11-02): grouped subagents.** Steps are grouped by shared files; one subagent per group, each commits + bumps per step. Approval points come back to the main session.
- **Group A** — step 1. Runs first, alone.
- **Group B** — steps 3, 4, 5, 6 (`tree.ts`, `Budget.tsx`, table headers). After A.
- **Group D** — steps 10, 11 (`BudgetSetup.tsx`, `AddBudget.tsx`). After A, in parallel with B (shared `App.css` only).
- **Group C** — steps 2, 7, 8, 9 (`BudgetTable.tsx` rows, `useTreegrid.ts`). After B.
- **Reviews** — steps 12, 13, 14 in the main session with the human.
- Status: ✅ A · ⏳ B · ⏳ D · ☐ C · ☐ reviews

1. ✅ **Refactor "Year" to "Annual"** (v0.4.1) — UI labels, code identifiers, design docs, and the stored values: `Frequency` and `Range` `'year'` → `'annual'`, with a Dexie v8 upgrade that rewrites stored `frequency` and settings range values (human decision 2026-11-02: change now, before a prod version). Done first because every later step touches these names.
   - Source: roadmap v0.4.
   - Files: `src/storage/db.ts`, `repository.ts` (`FREQS`, backup restore checks), `src/budget/tree.ts`, `src/budget/validate.ts`, `src/components/BudgetTable.tsx`, `src/screens/*`, `docs/design/*`.
   - Verify: `grep -rn "year"` shows only intended hits (dates); upgrade tested on a seeded v7 database with yearly items and an Annual range; build + lint pass.
   - Deps: none.

2. ✅ **Small UI fixes** (v0.4.2) — Save/Cancel in the edit control no longer overflow; no border on edit-name buttons; larger scroll bars.
   - Source: roadmap v0.4.
   - Files: `src/components/BudgetTable.tsx`, `src/App.css`.
   - Verify: screenshots at 400px and 1280px; no overflow.
   - Deps: none.

3. ✅ **Estimate scaling math** (v0.4.3) — replace day-based scaling (monthly ÷ 30.44 × days) so a monthly estimate shows the typed amount per month; define Week and Annual results from that.
   - Source: roadmap v0.4; security-v0.2 3.4.
   - Files: `src/budget/tree.ts` (`PER_MONTH`, scaling fn), `src/screens/BudgetSetup.tsx` (`MONTH` preview).
   - Verify: $100/month shows $100 in every Month view; $120 quarterly shows $40/month; Annual total = 12 × monthly.
   - Deps: step 1.

4. ✅ **Week table by day** (v0.4.4) — Week columns broken down per day (week start from Settings).
   - Source: roadmap v0.4.
   - Files: `src/budget/tree.ts` (`periodsFor`), `src/components/BudgetTable.tsx`.
   - Verify: purchases land on the right day for each week-start setting; totals match the old Week view.
   - Deps: step 3.

5. ✅ **Estimate toggle scope** (v0.4.5) — toggle shown on Week and Month only (default on); removed from Day and Annual.
   - Source: roadmap v0.4.
   - Files: `src/screens/Budget.tsx`.
   - Verify: toggle present/absent per range; default on.
   - Deps: step 4.

6. ✅ **Historical navigation** (v0.4.6) — date `nav` above the tables with prev/next date range for every range.
   - Source: roadmap v0.4; 0007 §9.5.
   - Files: `src/screens/Budget.tsx`, `src/budget/tree.ts`.
   - Verify: prev/next across month and year boundaries under both month-boundary settings; keyboard + screen reader labels.
   - Deps: steps 4 and 5.

7. **Row actions menu** (v0.4.7) — rows with more than one action get one actions menu (menu button pattern) so rows line up.
   - Source: roadmap v0.4.
   - Files: `src/components/BudgetTable.tsx`, new `src/components/ui/ActionsMenu.tsx`.
   - Verify: keyboard (Enter/arrows/Escape, focus return); columns align.
   - Deps: step 2.

8. **Rename from Week and Month** (v0.4.8) — rename subcategories and items, with confirm dialog: "This will change the name of all instances of {old name} to {new name} across the application." (Confirm / Cancel). Reuses the Annual rename.
   - Source: roadmap v0.4.
   - Files: `src/components/BudgetTable.tsx`, `src/storage/repository.ts`.
   - Verify: Cancel changes nothing; Confirm renames everywhere; dialog focus trap + return.
   - Deps: step 7 (rename lives in the actions menu).

9. **Expand/collapse persistence** (v0.4.9) — remember which category/subcategory rows are open (▾) or closed (▸) across reloads. One shared state: a row's open/closed state is the same in Day, Week, Month and Annual (human decision 2026-11-02).
   - Source: roadmap v0.4.
   - Files: `src/components/ui/useTreegrid.ts`, `src/storage/db.ts` (`Settings`) or localStorage.
   - Verify: state survives reload; closing a row in Month shows it closed in Day, Week and Annual.
   - Deps: none.

10. ✅ **Budget setup updates** (v0.4.10) — Create row visual redesign (still one per category with Add to); Taxes as an expander like other categories; Add button tooltip "First enter a value in 'Create in {subcategory name}'".
    - Source: roadmap v0.4.
    - Files: `src/screens/BudgetSetup.tsx`, `src/App.css`.
    - Verify: human approves the Create row design; tooltip reachable by keyboard and announced.
    - Deps: step 2.
    - Built 2026-11-02; Create row design pending human approval.

11. ✅ **Multi-column form layout** (v0.4.11) — 1280px breakpoint.
    - Source: roadmap v0.4; 0007 §10.
    - Files: `src/screens/AddBudget.tsx`, `src/screens/BudgetSetup.tsx`, `src/App.css`.
    - Verify: screenshots at 1279/1280px and 400px; reading/tab order unchanged.
    - Deps: step 10.

12. **UI/UX review** (v0.4.12) — human approval per `0005-ui-ux-review-checklist.md`.
13. **Accessibility pass** (v0.4.13) — Lighthouse + keyboard + screen reader; report in `docs/audits/a11y/a11y-v0.4.md`.
14. **Security review** (→ v0.5.0) — `docs/audits/security/security-v0.4.md`, human approval.

## Rules
- Each completed item: commit + version bump (per `versioning.md`).
- Human-facing docs in `docs/`; do not duplicate docs.
- Stop and ask on any uncertainty.
