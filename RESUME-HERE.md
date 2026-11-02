# RESUME-HERE

Tracking file for current work status. Roadmap authority: `docs/design/0003-roadmap.md`.
Design: `0004-table-design.md` (table), `0006-prototype.html` (v0.2 UI), `0007-v0.3-design-updates.md` (v0.3 changes; wins on conflict).

## Current state
- Version: v0.3.9. v0.2 complete (security review approved, `docs/audits/security/security-v0.2.md`).
- Data: Dexie v7 (Income group, stored sibling `order`, `computed` only on top-level rows; see `src/storage/structure.ts`). Amounts link to categories by `categoryId`; estimate fields live on `Category`. `needsReview` removed (0007 §8.4).
- Next: step 10 below. UI sign-off for each UI step is collected at step 14 (commits say "UI review pending").
- Testing: headless Chromium via host flatpak + puppeteer-core; scripts in the session scratchpad.

## v0.3 plan of action

Covers every v0.3 roadmap item. Each completed step bumps the last version segment to the step number (v0.3.1, v0.3.2 …); the final step bumps to v0.4.0. Commit on each bump per `versioning.md`. UI-touching steps are not complete until the human approves the UI/UX (`0005-ui-ux-review-checklist.md`).

1. ✅ **Name-ambiguity audit** (v0.3.1) — decided in 0007 §8; needsReview removed. Original scope: — list every repeated or ambiguous name in the seed tree and custom categories (Car, Miscellaneous, Medical …); propose how to remove the ambiguity (e.g. distinct names, or a parent-qualified display everywhere); decide how flagged amounts get resolved.
   - Source: roadmap v0.3; security-v0.2 3.1.
   - Deliverable: findings + proposal (location agreed with human), with a human decision.
   - Verify: human approves the proposal.
   - Deps: none. Its decision feeds step 9 (0007 §8.3).

2. ✅ **Category structure + data model** (v0.3.2) — UI review pending (step 14) — Income group over Pay, Incidental Income and custom subcategories; Taxes stays its own row; Net Income = Income − Taxes; subcategories allowed under Income, Savings and Expenses; a stored sort order; calculated subcategory estimates, with a manual estimate moved to a new Miscellaneous item (plus info banner) when the first child is created. Dexie v7 (also strips any leftover `needsReview` field) upgrade, tested on a seeded v6 database.
   - Source: 0007 §2.
   - Files: `src/storage/db.ts`, `seed.ts`, `repository.ts`, `src/budget/tree.ts`, `src/components/BudgetTable.tsx`.
   - Verify: upgrade keeps every amount and estimate; table shows the new top level; totals match before and after.
   - Deps: step 1.

3. ✅ **Recurrence + estimate scaling** (v0.3.3) — UI review pending (step 14) — Recurrence and Autopay on every item and on subcategories with a manual estimate; Quarterly and Annual for Debt, Utilities and Subscriptions; Week and Month tables scale estimates from each recurrence (day-based math stays until v0.4).
   - Source: 0007 §3.
   - Files: `src/budget/tree.ts`, `src/storage/db.ts` (`Frequency`), `repository.ts` (frequency check).
   - Verify: scaling checks for each recurrence; $120 quarterly shows about $40 in a month view.
   - Deps: step 2.

4. ✅ **Calendar settings** (v0.3.4) — week start (any day, default Sunday) and month boundaries (whole weeks by default, or calendar month), stored in Settings and used by the Week and Month tables.
   - Source: 0007 §1.
   - Files: `src/storage/db.ts` (`Settings`), `src/budget/tree.ts` (`periodsFor`), `repository.ts`.
   - Verify: period boundaries for sample months under each setting.
   - Deps: none (the settings UI lands in step 7).

5. ✅ **Tab navigation** (v0.3.5) — UI review pending (step 14) — tab list with Add budget item and Budget; one panel at a time; ARIA tabs pattern with arrow keys.
   - Source: 0007 §6.
   - Files: `src/App.tsx`, new `src/components/ui/Tabs.tsx`, `src/App.css`.
   - Verify: keyboard walkthrough; only one panel visible.
   - Deps: none.

6. ✅ **Day and Annual tables** (v0.3.6) — UI review pending (step 14); Annual uses calendar months so no day is counted twice — Day shows actuals only (no Est. column); new Annual range with an Act. column per month plus a year total; Annual is not a default-range option.
   - Source: 0007 §7.
   - Files: `src/components/BudgetTable.tsx`, `src/screens/Budget.tsx`, `src/budget/tree.ts`.
   - Verify: sample data across months totals correctly; Day has no Est. column.
   - Deps: steps 2 and 4.

7. ✅ **Budget setup redesign** (v0.3.7) — UI review pending (step 14). Create rows: one per category with an Add to select (human choice, 0007 §5.2). For review: the setup table scrolls sideways on narrow screens (data-table exception) — one combined table (Select as the first column; a subcategory checkbox selects or clears its items and its accessible name says so; selection never clears estimates); a Create row per group; Move up/down and Move to reordering; calendar settings; Default display range as a radio group; live preview table; sticky footer with Cancel left and Save right; Save closes; new supporting text.
   - Source: 0007 §5.
   - Files: `src/screens/BudgetSetup.tsx`, `src/components/BudgetTable.tsx` (preview reuse), `repository.ts`, `src/App.css`.
   - Verify: keyboard and screen reader walkthrough of select-all, reorder and Cancel; preview matches the Budget tab.
   - Deps: steps 2, 3, 4, 6.

8. ✅ **Add form update** (v0.3.8) — UI review pending (step 14); resolves security-v0.2 3.6. Charity › Miscellaneous is now preselected (Charity became a total row) — remove Estimated spend and Recurrence (resolves security-v0.2 3.6); the Item list shows selected items until the user types, then searches everything; new-item flow with a Category dropdown, Where? for a new subcategory, and Use in future (unchecked) left of a fixed right-side Save; new entries always appear in the tables.
   - Source: 0007 §4.
   - Files: `src/screens/AddBudget.tsx`, `src/components/ui/ItemSelector.tsx`, `repository.ts`.
   - Verify: create an item, and a subcategory + item, with and without Use in future; the tables show them.
   - Deps: steps 2 and 7.

9. ✅ **Shared search/filter component** (v0.3.9) — built during step 8 (`ItemSelector`: item / category modes, `initial` filter); reuse is checked in steps 10–12 — make `ItemSelector` the single search/filter dropdown, reusable by Edit, Delete and Categories (including a category-only mode with unselectable headings); sticky parent headings, repeat-name accessible names and option ids per 0007 §8.3.
   - Source: roadmap v0.3.
   - Files: `src/components/ui/ItemSelector.tsx`.
   - Verify: used unchanged in steps 8 and 10–12.
   - Deps: step 8.

10. **Edit flow** (v0.3.10) — search items or filter by category, optional date and amount filters, matching amounts as a checkbox group (at least one required), a required "New value" per selected amount; moving an amount to another item.
    - Source: `0001-initial-requirements.md` Edit; roadmap v0.3.
    - Files: new `src/screens/EditBudget.tsx`, `repository.ts`.
    - Verify: edit and move amounts.
    - Deps: step 9.

11. **Delete flow** (v0.3.11) — same search and filters, matching amounts as a checkbox group (at least one required), delete with confirmation.
    - Source: `0001-initial-requirements.md` Delete; roadmap v0.3.
    - Files: new `src/screens/DeleteBudget.tsx`, `repository.ts`.
    - Verify: deleted amounts leave every table and total.
    - Deps: step 9.

12. **Categories CRUD** (v0.3.12) — rename and delete categories and subcategories (create and reorder are in step 7); deleting a node that has amounts needs a human decision on where they go; computed rows are protected.
    - Source: roadmap v0.3.
    - Files: `src/screens/BudgetSetup.tsx` or a new screen (decide at step 7 review), `repository.ts`.
    - Verify: a rename shows everywhere; a delete never orphans amounts.
    - Deps: steps 2, 7, 9.

13. **Due date + autopay display and editing** (v0.3.13) — show and edit `dueDate` and `autopay` on items.
    - Source: roadmap v0.3.
    - Files: `src/screens/BudgetSetup.tsx`, `src/components/BudgetTable.tsx`.
    - Verify: values round-trip and display.
    - Deps: step 7.

14. **UI/UX review** (v0.3.14) — agent pre-check against `0005-ui-ux-review-checklist.md`, then human approval of all v0.3 UI.
    - Deps: steps 1–13.

15. **Accessibility pass** (v0.3.15) — Lighthouse ≥ 90 on every new state, scripted keyboard and focus checks, human screen reader test.
    - Deps: step 14.

16. **Security review** (v0.4.0) — `docs/audits/security/security-v0.3.md`, NETWORKED matrix, all 8 domains; fix findings above Info.
    - Deps: steps 1–15. Completes v0.3 and transitions to v0.4.0.

## Rules
- Each completed item: commit + version bump (per `versioning.md`).
- Human-facing docs in `docs/`; do not duplicate docs.
- Stop and ask on any uncertainty.
