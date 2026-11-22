# RESUME-HERE

Tracking file for current work status. Roadmap authority: `docs/design/0003-roadmap.md`.
Design: `0015-sync-design.md` (sync), `0004-table-design.md` (table), `0006-prototype.html` (v0.2 UI), `0007-v0.3-design-updates.md` (v0.3 changes), `0008-v0.5-design-updates.md` (v0.5 changes), `0009-v0.6-design-updates.md` (v0.6), `0012-design-standards.md` (standards), `0014` (Annual Misc breakdown). Higher-numbered doc wins on conflict.

## Current version
v0.7.0 (v0.6 complete 2026-11-21, v0.6.0 to v0.6.37; reports: `docs/audits/a11y/a11y-v0.6.md`, `docs/audits/security/security-v0.6.md`). Step 1 ✅ (v0.7.1 to v0.7.3). Step 2 ✅ (v0.7.4). Step 3 ✅ (v0.7.5 to v0.7.10). Step 3b ✅ (v0.7.12 to v0.7.17). Group A2 (steps 4, 5, 7) ✅ (v0.7.19 to v0.7.25). Next: group B (tables).

## v0.7 plan of action
Versions follow "Version numbering" in `.claude/CLAUDE.md` (patch +1 per completed-work commit; trailer `Plan-Step: v0.7/N`). The final step bumps to the next minor version (v0.8.0). UI steps need human approval (`0005-ui-ux-review-checklist.md`). Baseline: v0.7.0. Data: Dexie v8 (`src/storage/structure.ts`). Testing: headless Chromium (`tools/browsers/`, `lighthouse-sandbox.md`); import harness `npm run test:import` (`tests/import/README.md`).

**Before building (human):** several items below are decided in the roadmap but have open design questions (marked "needs human decision"). Sync (steps 2 and 3) comes right after step 1 (decided 2026-11-21): it needs no other v0.7 step, and step 2 needs the v0.2 5.4 network review and a design doc first.

**Run option (estimate):** single session with fresh restarts for steps 1 and 4 to 15: they share `BudgetTable.tsx`, `App.css`, `Dialog` and `validate.ts`, and most need approval mid-way. Sync (steps 2 and 3) touches separate files (`src/storage/`, a new adapter) and may suit one subagent.

1. **Consolidate dialogs** (v0.7/1) — one dialog component replaces form, confirm and generic dialogs; migrate the v0.6 dialogs (Edit menu, highlight, wizard, Backup) and Budget setup. ✅ (v0.7.1 to v0.7.3, UI approved 2026-11-21)
   - Source: roadmap v0.7 (decided 2026-11-04; Budget setup added 2026-11-21)
   - Files: `src/components/ui/` (dialogs), `src/components/BudgetTable.tsx`, `src/screens/BudgetSetup.tsx`, `src/App.css`
   - Verify: `npm run test:dialogs` (`tests/dialogs/README.md`); build + lint
   - Deps: none (do first: later steps add dialogs)
2. **Sync design and network review** (v0.7/2) — new design doc for sync to a Google Sheet; the sheet layout, data shape and encryption questions settled; the v0.2 5.4 network review done first.
   - Source: roadmap v0.7; `security-v0.6.md` held items (v0.2 5.4 ⚠ REQUIRES REVIEW BEFORE PROCEEDING, v0.2 2.3, v0.3 6.2, v0.2 1.3, 2.4, 3.7, 4.3, 4.4, 6.6, 6.7, 7.7, 8.8, v0.5 3.2)
   - Files: `docs/design/0015-sync-design.md`; roadmap update
   - Verify: human approves the design doc; 5.4 re-rated
   - Deps: none; blocks 3
   - ✅ (v0.7.4, `0015` approved 2026-11-21; v0.2 5.4 reviewed, proposed Low)
3. **Sync to a Google Sheet** (v0.7/3) — StorageAdapter interface, Google Sheets adapter, sync-on-open (pull then push, last-write-wins, tombstones), optional passphrase encryption (open), seed from the sheet's layout.
   - Source: roadmap v0.7; the step 2 design doc
   - Files: `src/storage/`, new adapter, settings UI (built on the step 1 `Dialog`)
   - Verify: per the design doc; formula text in synced cells neutralized (v0.2 2.3)
   - Deps: 1, 2 (built immediately after 2)
   - ✅ (v0.7.5 to v0.7.10; end-to-end test passed in Chromium and UI approved 2026-11-22; changes from the review are step 3b)
   - Progress (v0.7.5, v0.7.6): engine, encryption, Dexie v9, Google adapter, CSP, Sync dialog and timing built; `npm run test:sync` passes. Waiting on: the human's Google Cloud setup (placeholders in `src/storage/sync/googleConfig.ts`), the end-to-end test with a test account (Q10) and UI approval of the Sync dialog.
3b. **Sync placement in the wizard and main app** (v0.7/3b) — from the step 3 UI review (human, 2026-11-22):
   - Wizard: sync becomes the first step; the "How often do you get paid?" step is removed (human, 2026-11-22). Pay frequency is the Recurrence of the Income items, set in Advanced options (Budget setup) together with their estimated amount; it defaults to Monthly, as estimates have no default either. Design (human, 2026-11-22; mockups in `docs/design/images/v0.7-wizard-sync/`): option A with two answers, "Local only" and "Sync with Google". Choosing "Sync with Google" shows option C's content as a tab list (tabs "New Budget" and "Existing Budget") instead of two side-by-side boxes.
   - The step count updates as the user moves through, because the branches have different lengths ("Step 2 of 5", for example). "Existing Budget" skips the categories steps (they come from the linked sheet) (human, 2026-11-22).
   - Sync button: only in the Budget tab panel, at the right, in line with the date controls; in narrow views, once it would run into the date controls, it moves to the right of the Screens drop-down.
   - Backup button: back at the far right, in line with the tabs.
   - Budget setup table: the "Estimated spending" column (and its error messages) becomes "Estimated amount".
   - Source: step 3 UI review; `0015` Q9 (replaced: sync is offered in the wizard, not after it)
   - Files: `src/screens/Onboarding.tsx`, `src/screens/BudgetSetup.tsx`, `src/components/Sync.tsx`, `src/screens/Budget.tsx`, `src/components/ui/Tabs.tsx`, `src/App.tsx`, `src/App.css`
   - Verify: `npm run test:dialogs` (wizard step order); 1280/640/320px; keyboard order matches visual order
   - Deps: 3
   - ✅ (v0.7.12 to v0.7.17; UI approved 2026-11-22)
   - Progress (v0.7.13): built; build, lint, `test:dialogs`, `test:sync`, `test:import` pass; layouts checked at 1280/640/375/320px. Waiting on: the human's sign-in test in Chromium and UI approval.
4. **Design standards pass** (v0.7/4) — bring the app in line with `0012-design-standards.md`.
   - Source: roadmap v0.7; `0012` §10 gaps
   - Files: `src/App.css`, `src/styles/tokens.css`, components named in `0012`
   - Verify: checklist in `0012`; no hard-coded values; build + lint
   - Deps: 1 (all `0012` §10 gaps were decided 2026-11-06 and 2026-11-08)
   - ✅ (v0.7.19 to v0.7.25; UI approved 2026-11-22)
   - Progress (v0.7.20): built (G1, G3–G6, G8–G10, G12, G15–G17, §1 tokens, §4 field order); G11 Actual-column pin left for step 6. Waiting on: UI approval.
5. **Max app width 1440px** (v0.7/5) — content stays centered.
   - Source: roadmap v0.7 (decided 2026-11-04)
   - Files: `src/App.css`, `src/styles/tokens.css`
   - Verify: 1440, 1920px; 320/640px unchanged
   - Deps: none
   - ✅ (v0.7.19 to v0.7.25; UI approved 2026-11-22)
   - Progress (v0.7.19): built; checked at 320/640/1280/1440/1920px. Waiting on: UI approval.
6. **Item column width** (v0.7/6) — the Item column is not sticky in any table (human, 2026-11-22: not enough room at 400px and narrower). It has a 250px minimum and grows so its content never wraps; the table scrolls sideways instead.
   - Source: roadmap v0.7 (decided 2026-11-04; sticky dropped 2026-11-22)
   - Files: `src/components/BudgetTable.tsx`, `src/App.css`
   - Verify: no wrapped names at 1280/640/320px, highlight dialog included; keyboard scroll; no page-level sideways scroll
   - The Day table's Actual column is not pinned either (`0012` G11 pinning dropped, human 2026-11-22).
   - Deps: 5
   - Progress (v0.7.27): built (Item column min 250px, names don't wrap, Day table auto layout); no wrapped names or page-level sideways scroll at 1280/640/320px, highlight dialog included. Waiting on: UI approval.
7. **Form field alignment class** (v0.7/7) — same label-to-control space as fields with help text, so side-by-side fields line up.
   - Source: roadmap v0.7 (decided 2026-11-04)
   - Files: `src/App.css`, form screens
   - Verify: Add purchase, Budget setup, dialogs at 1280/640/320px
   - Deps: 4
   - ✅ (v0.7.19 to v0.7.25; UI approved 2026-11-22)
   - Progress (v0.7.21): `.field-align` built and applied (Add purchase, purchase dialog, Edit-menu dialogs, Budget setup week start). Waiting on: UI approval.
8. **Supporting text under the tables** (v0.7/8) — remove the help text under each table instead of rewriting it (human, 2026-11-22), and the `aria-describedby` references to it.
   - Source: roadmap v0.7
   - Files: `src/screens/`, table components
   - Verify: no dangling `aria-describedby` ids; accessible names unchanged
   - Deps: none
   - Progress (v0.7.28): removed both help lines under the Budget tables and the table's `aria-describedby`; no dangling ids. Open: the Budget setup table's line under it (`setup-key`) is kept until the human decides. Waiting on: UI approval.
9. **Negative purchases as returns** (v0.7/9) — listed in the Day table as a return, formatted "(-$n.nn)" (human, 2026-11-22).
   - Source: roadmap v0.7 (decided 2026-11-04); `0007` §9
   - Files: `src/components/BudgetTable.tsx`
   - Verify: refund and credit rows; totals unchanged; screen reader names
   - Deps: none
   - Progress (v0.7.29): a negative Day purchase is named "Return, {time}", its amount shows "(-$n.nn)" in red; Edit button, delete dialog and status say "return of $n.nn"; totals unchanged. Waiting on: UI approval.
10. **Typed-name parsing** (v0.7/10) — spell check and common abbreviations (decided 2026-11-22):
    - List: Misc / Misc. → Miscellaneous; Ins. → Insurance; Mtg → Mortgage; Util. / Utils → Utilities; Sub / Subs → Subscriptions; Groc. → Groceries; Med. → Medical; Ent. → Entertainment; Pmt → Payment; Acct → Account; Dept → Department; Govt → Government.
    - Runs wherever a name is typed (new item in Add purchase, Budget setup, Rename); import is not affected.
    - Fixes silently, except when the user edits a full name to an abbreviation: their edit is kept.
    - Spell check: the browser's built-in spell check on name fields (no new dependency).
    - Source: roadmap v0.7 (decided 2026-11-04)
    - Files: `src/budget/validate.ts`, name fields
    - Verify: abbreviation cases; import names unaffected unless chosen
    - Deps: none
11. **Move subcategories and items between parents** (v0.7/11) — a subcategory moved into another becomes an item; an item moved out becomes a subcategory; a subcategory with items cannot move into another (error).
    - Source: roadmap v0.7 (decided 2026-11-04)
    - Files: `src/budget/setupEdits.ts`, `src/storage/repository.ts`, dialog component, `src/components/BudgetTable.tsx`
    - Verify: keyboard-only; purchases and estimates follow the row; backup restore; sync (step 3) carries the move; tree checks
    - Design (human, 2026-11-22; based on option C in `docs/design/images/v0.7-move-rows/`): when a row is highlighted (the highlight dialog shows it with only its child rows), the dialog shows a Move column. Up and Down buttons move a row among the highlighted rows. "Move to" is a menu listing categories and subcategories; any category may be chosen. When the user closes the highlight, the tables show the row in its new place. A row moved to a new parent becomes its last child.
    - Purchases and the estimate move with the row.
    - Deps: 1, 3, 11b
11b. **Quarterly and Annual in every recurrence list** (v0.7/11b) — every Recurrence drop-down offers Quarterly and Annual, not only Debt, Utilities and Subscriptions (human, 2026-11-22). This also means a moved row's recurrence is always allowed in its new category (step 11).
    - Source: human, 2026-11-22; replaces the `0007` §3 limit
    - Files: `src/budget/` (`frequenciesFor`), `src/screens/BudgetSetup.tsx`, estimate scaling checks
    - Verify: every Recurrence list; estimate scaling for Quarterly and Annual on the other categories; build + lint
    - Deps: none
12. **Read-only Day table under Add purchase** (v0.7/12) — a copy of the Day table below the form.
    - Source: roadmap v0.7 (decided 2026-11-08)
    - Files: `src/screens/AddBudget.tsx`, table component
    - Verify: updates after a save; read-only; one live region
    - Deps: 9
13. **Annual Misc row and breakdown** (v0.7/13) — a Misc row under Incidentals, a Misc. Breakdown table under the Annual table, December review highlight.
    - Source: roadmap v0.7; `0014`
    - Files: `src/components/BudgetTable.tsx`, new table component, `src/App.css`
    - Verify: per `0014`; table headings and names
    - Deps: 6
14. **Week and Day import regression** (v0.7/14) — regression test the import of Week and Day sheets, then fill the gaps (e.g. a week sheet and a day sheet covering the same day are not cross-checked).
    - Source: roadmap v0.7 (decided 2026-11-11)
    - Files: `tests/import/`, `src/import/`
    - Verify: `npm run test:import`
    - Deps: none
15. ~~**Charts** (v0.7/15)~~ — moved to v0.8 (human, 2026-11-22).
15b. **D004 hardened-browser sign-in** (v0.7/15b) — redirect sign-in so sync works in Firefox Strict, Brave and similar (`docs/defects/D004-hardened-firefox-sign-in.md`). Does not block the alpha launch (human, 2026-11-22).
    - Files: `src/storage/sync/googleSheets.ts`, `src/components/Sync.tsx`; an Authorized redirect URI in the Google Cloud console (human)
    - Verify: sign-in in Firefox Strict and in Chromium
    - Deps: 3b
16. **UI/UX review** (v0.7/16) — human approval, `0005` checklist, all widths.
    - Deps: 1–15
17. **Accessibility pass** (v0.7/17) — including chart alt text, keyboard navigation and screen reader.
    - Deps: 16
18. **Security review** (v0.7/18) — covers sync; carried items listed in step 2. On approval bump to v0.8.0.
    - Deps: 17

### Execution
- **A — Dialogs** (step 1; `Dialog`, `App.css`): first.
- **F — Sync** (steps 2, 3, 3b; `src/storage/`, new adapter): right after A; step 2 needs human decisions, step 3 starts as soon as 2 is approved.
- **A2 — Standards and layout** (steps 4, 5, 7; `App.css`, tokens): after F.
- **B — Tables** (steps 6, 8, 9, 12, 13; `BudgetTable.tsx`, `App.css`): after A2.
- **C — Names and moves** (steps 10, 11b, 11; `validate.ts`, `setupEdits.ts`, repository): after F; both need human decisions.
- **D — Import** (step 14; `tests/import/`): any time.
- **E — Charts**: moved to v0.8.
- **D004** (step 15b): after F, before the reviews.
- **Reviews** (steps 16–18): main session with the user.
- Status: ✅ A · ✅ F · ✅ A2 · ☐ B · ☐ C · ☐ D · ~~E~~ · ☐ reviews

### Session process
Run option 1: one session per group, fresh start at each group boundary. A session starts by reading this file and the roadmap, then:
0. **Work in a worktree** (`dev-workflow.md`): create `.claude/worktrees/v0.7-group-<x>` from the latest `main` (or from `dev/v0.7` when a session builds several groups), build there, and at the end of the group or step stop and ask the human to approve the merge. Never merge to `main` without that approval.
1. **Find the start:** the first group in the order above that is not ✅ and whose dependencies are met; within it, the first step not marked ✅. Stop and ask if the status line and the step marks disagree.
2. **Check blockers** ("needs human decision", "blocked"). Do not build a blocked step: skip it, or stop and tell the user if it is the only one left.
3. **Build one step at a time:** re-read the latest version on `main`, build and lint, commit with the next patch version and the `Plan-Step: v0.7/N` trailer, mark the step ✅ with its version(s). Check `git diff --cached --stat` before each commit.
4. **UI steps** pause for human approval before they are marked ✅ (`0005`).
5. **At the end of the group:** update the Execution status line, commit in the worktree, and tell the user the group is done and waiting for merge approval.
6. **Reviews** (16–18) are run in the main session with the user, not by a worker.

## Rules
- Each completed item: commit + version bump (per `.claude/CLAUDE.md` "Version numbering").
- Human-facing docs in `docs/`; do not duplicate docs.
- Stop and ask on any uncertainty.
