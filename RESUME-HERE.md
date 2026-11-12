# RESUME-HERE

Tracking file for current work status. Roadmap authority: `docs/design/0003-roadmap.md`.
Design: `0004-table-design.md` (table), `0006-prototype.html` (v0.2 UI), `0007-v0.3-design-updates.md` (v0.3 changes), `0008-v0.5-design-updates.md` (v0.5 changes; wins on conflict), `0009-v0.6-design-updates.md` (v0.6; wins on conflict).

## v0.6 plan of action
Versions follow "Version numbering" in `.claude/CLAUDE.md` (patch +1 per completed-work commit; trailer `Plan-Step: v0.6/N`). The final step bumps to v0.7.0. UI steps need human approval (`0005-ui-ux-review-checklist.md`). Baseline: v0.6.0; v0.5 complete (`docs/audits/security/security-v0.5.md`, `docs/audits/a11y/a11y-v0.5.md`). Data: Dexie v8 (`src/storage/structure.ts`; schedule fields and `Settings.onboarded` unindexed). Testing: headless Chromium via host flatpak + puppeteer-core; scripts in the session scratchpad. Import has a committed harness: `npm run test:import` (Node with fake-indexeddb; `tests/import/README.md`).

**Before building (human):** the wizard (`0010`) is settled. The highlight (`0011`) is settled too (2px dotted name underline). Confirmed formats for import (step 13) and the Budget setup + help merge (step 15) also need the human.

**Run option (estimate):** single session with fresh restarts. The steps share a few files (`BudgetTable.tsx`, `BudgetSetup.tsx`, `App.css`, `structure.ts`), so parallel subagents would collide, and most UI steps need approval mid-way.

1. **D001 name length** (v0.6/1) ✅ (v0.6.1) — stop typing at 60 characters in the onboarding multi-select; say the limit in the field help.
   - Source: `docs/defects/D001`
   - Files: `src/components/ui/MultiSelect.tsx`, `src/screens/Onboarding.tsx`
   - Verify: 200 typed characters stop at 60; help text read by screen reader; build + lint
   - Deps: none (step 11 replaces the onboarding screen; keep the fix in the shared component)
2. **D002 duplicate settings rows** (v0.6/2) ✅ (v0.6.2) — create the default settings row inside one transaction that re-checks; ignore extra rows on restore.
   - Source: `docs/defects/D002`
   - Files: `src/storage/repository.ts`, `checkBackup`
   - Verify: fresh database under StrictMode ends with one row; restore of a backup with two rows keeps one
   - Deps: none
3. **Informative "Saved" confirmation** (v0.6/3) ✅ (v0.6.3, v0.6.5) — the message says what was saved and how much (item name and amount). Primary user request.
   - Source: roadmap v0.6
   - Files: `src/screens/AddBudget.tsx`, `src/components/Notices.tsx`
   - Verify: text for each save type; announced once through the single live region; no rewards-animation overlap
   - Deps: none
4. **Visually hidden panel headers** (v0.6/4) ✅ (v0.6.4) — each tab panel's header below the tab is hidden visually, kept for screen readers.
   - Source: roadmap v0.6
   - Files: `src/App.tsx`, `src/screens/*`, `src/App.css`
   - Verify: headings still in the accessibility tree and in heading navigation; no layout shift; 320/640/1024px
   - Deps: none
5. **Add/subtract in amount fields** (v0.6/5) ✅ (v0.6.8) — amount fields accept typed expressions (e.g. `12.50+3`, `40-5.25`) and save the result.
   - Source: roadmap v0.6; decided 2026-11-04: typed expressions only (no +/- buttons), in every field that adds a value or purchase: Add purchase form, Budget setup estimate fields, and the Add/Subtract dialog (step 9)
   - Files: `src/screens/AddBudget.tsx`, `src/screens/BudgetSetup.tsx`, new `src/components/ui/AmountField.tsx`, `src/budget/validate.ts`
   - Verify: parsing and rounding cases (only `+`, `-`, digits, decimal point, no code evaluation); invalid input message; result shown before saving; keyboard-only use; build + lint
   - Deps: none
6. **Optional description** (v0.6/6) ✅ (v0.6.9) — optional field below Amount, stored with the purchase/item.
   - Source: roadmap v0.6; `0009` §4
   - Files: `src/storage/structure.ts`, `src/storage/db.ts`, `src/storage/repository.ts`, `src/screens/AddBudget.tsx`, `src/budget/validate.ts`, backup restore
   - Verify: persists across reload and backup restore; length limit and sanitising; Dexie bump only if needed
   - Deps: 5; **needs human decision**: where it is stored and shown (decided with this item per `0009` §4)
7. **Charity purchases** (v0.6/7) ✅ (v0.6.10) — Charity takes purchases until its first item; then they move to Charity › Miscellaneous and Charity becomes a roll-up (not selectable).
   - Source: roadmap v0.6; `0009` §6 (replaces the Charity part of `0007` §2.1)
   - Files: `src/storage/repository.ts`, `src/components/ui/ItemSelector.tsx`, `src/budget/tree.ts`
   - Verify: purchases move once, at the first item; Charity leaves the dropdown; Medical unchanged; restore of a backup keeps the rule
   - Deps: spec decided in `0009` §6 (2026-11-04)
8. **Budget setup "Add" buttons** (v0.6/8) ✅ (v0.6.11, v0.6.12, v0.6.16) — one Add button per category replaces the four "Create in" field rows; selecting it shows that category\'s fields above the button (Save right of "Add to"; the button reads Cancel while open; Save hides the fields and focuses Add); announces "Fields added above". Approved 2026-11-04.
   - Source: `0009` §2
   - Files: `src/screens/BudgetSetup.tsx`, `src/App.css`
   - Verify: focus moves to first new field; polite announcement through the single live region; Tab order; 320px
   - Deps: none
9. **Edit menu with dialogs** (v0.6/9) ✅ (v0.6.13, v0.6.17, v0.6.18, v0.6.19) — Day, Week, Month rows: "Actions" becomes "Edit" with Rename (moves item to the right category; warning banner), Add/Subtract (Day: New purchase), Delete (Day and Week only); each opens a dialog. Day purchase rows: an Edit button opens one dialog with the Add purchase form prepopulated (Cancel, Save, Delete). Annual unchanged.
   - Source: `0009` §4, §4.1; roadmap v0.6
   - Files: `src/components/BudgetTable.tsx`, new dialog components in `src/components/ui/`, `src/budget/setupEdits.ts`, `src/App.css`
   - Verify: dialog focus trap and return; Week/Month date picker min/max are the viewed period's first and last day (custom month boundaries too); rename-to-other-category moves the item; delete only where allowed; five tables
   - Deps: 5, 6; behavior decided 2026-11-04 in `0009` §4.1 (Day: New purchase button on category rows, amount update on purchase rows; Week/Month: add to or subtract from the item total, with a date picker limited to the viewed period; supersedes `0007` §9.1/§9.4 for the amount, so the roadmap's Post v1.0 item now covers the date only)
10. **Highlight dialog** (v0.6/10) ✅ (v0.6.14, v0.6.17, v0.6.18) — clicking an item name opens a dialog with the row, its children and the table's functions; the chevron alone expands and collapses.
    - Source: `0009` §3; prototype `0011`; decided 2026-11-04: dialog shows the row as in the table viewed (Day lists purchases; Week/Month/Annual do not); Delete confirms first, hidden in Month/Annual; Rename not offered for top-level categories; a purchase row in Day opens the purchase dialog (`0009` §4.1)
    - Files: `src/components/BudgetTable.tsx`, new dialog component, `src/App.css`
    - Verify: the name's clickable cue is a 2px dotted underline; name click no longer toggles (supersedes nothing in `0008` §1 except the name-toggle); same functions as the Edit menu; keyboard and screen reader
    - Deps: 9; `0009` §3 is decided (not blocked)
9a. **Hover styling** (v0.6/9a) ✅ (v0.6.15) — hover state on every button and link across the app (today only some have one).
   - Source: roadmap v0.6; human request 2026-11-04 (highlight review)
   - Files: `src/App.css`, `src/styles/tokens.css`
   - Verify: scripted list of every button/link class with a `:hover` rule; contrast 3:1 in both themes; no hover-only information; disabled buttons do not react
   - Deps: 9, 10 (same `App.css`; covers what their dialogs do not)
11. **Onboarding wizard** (v0.6/11) ✅ (v0.6.7) — three-step dialog wizard with progress bar replacing the single-dialog questionnaire.
    - Source: `0009` §1; prototype `0010`; replaces `0008` §8
    - Files: `src/screens/Onboarding.tsx`, `src/storage/seed.ts`, `src/storage/preselected.ts`, `src/App.css`
    - Verify: progress "step X of 3" announced; Back, Done, presets and Advanced setup (closes the wizard) paths; no "Add your own" box; step 2 text is only "You can change presets later in Budget setup."; shows on empty DB only
    - Deps: 1; decided 2026-11-04 in `0009` §1 (not blocked)
12. **Deep subcategory nesting** (v0.6/12) — dropped 2026-11-08: the Category › Subcategory › Item model is already built (`MAX_DEPTH = 2`; a subcategory with items is a total row, an item is the deepest level). No work.
13. **Import parsing** (v0.6/13) ✅ (v0.6.20) — read CSV and XLSX (ODS is step 13a), auto-categorize rows into categories/items, preview before writing; builds on the JSON backup export/restore.
    - Source: roadmap v0.6; `0013` (mapping, reviewed); `docs/audits/security/security-v0.2.md` 1.1, 2.2, 6.2
    - Files: new `src/import/`, `src/storage/repository.ts`, `src/storage/db.ts`, `src/budget/validate.ts` (date limit 1970), new `tests/import/`. `Backup.tsx` moved to step 14
    - Verify: sample files per format; size/type limits and malformed files fail safely; formula and script content never run; no new dependency without asking (spreadsheet parser library)
    - Deps: none now that step 12 is dropped; `0013` is decided; the library is chosen but installing it still needs the human's go-ahead. Test files: `docs/test_sheets/` (committed when `0013` is ready for work; the next commit when this step is done). Expect several test and refinement rounds
13a. **ODS import** (v0.6/13a) — a valid ODS test file (the generated ones fail to open in OnlyOffice: "format error in content.xml") and an ODS reader using the `0013` rules.
    - Source: roadmap v0.6; `0013` §1
    - Files: `src/import/`, `docs/test_sheets/` (ODS files)
    - Verify: the ODS test files open in OnlyOffice and import with the same results as the XLSX files
    - Deps: 13; **needs human**: a valid ODS file (for example saved from OnlyOffice or LibreOffice from the XLSX test workbook)
14. **Import flow UI** (v0.6/14) — Import section in the new Backup dialog (step 15), review/preview screen, error and success messages.
    - Source: roadmap v0.6 "UI/UX for the upload flow"; `0013` §5 and §9 (undated purchases are marked and the Day table shows a tooltip note on them); D003
    - API from step 13 (`src/import/index.ts`): `readImportFile(file)` → `previewImport(wb, await importSnapshot(), options)` after each choice → `applyImport(plan)`. `ImportError` messages finish the sentence "Invalid: Import file …"
    - Preview must show: sheets to tick (`excludedSheets`); the year (`year`, default the current year; day sheets keep their own year); month vs annual (`monthSource`); annual-only months that already have data (`annualExisting`); rows with a target dropdown (`targets`: auto, skip, Miscellaneous, an existing row); warnings, ignored columns and "Skip those items" (`skipDuplicates`)
    - Rows that need a place (`0013` §4, `PlanRow.needsPlace`, `plan.unplaced`): a top-level row the app doesn't know. The user picks where it goes: under an existing row (`{ parentId }`, a top-level row or a subcategory directly under one), onto an existing row (`{ categoryId }`), or skip. Import stays disabled while `plan.unplaced` is not empty (`applyImport` refuses too). The picker design is part of this step's UI approval
    - Choosing a new row name in a target dropdown is not built in step 13 (only existing rows); decide in this step's design whether it is needed
    - D003 fix (confirmed for this step): editing a purchase keeps its time (`createdAt`) and its import mark (`undated`); the mark goes only when the date is changed. Files: `src/storage/repository.ts`, `src/components/BudgetTable.tsx`
    - fast-xml-parser: on or after 2026-11-17 upgrade 5.11.2 → 5.12.0 (fixes GHSA-474x-hrwr-fgx4; approved 2026-11-11). If this step starts earlier, do it in step 19
    - Files: `src/screens/BudgetSetup.tsx`, `src/components/Backup.tsx`, new import screen, `src/App.css`, `src/components/BudgetTable.tsx` (tooltip, D003)
    - Verify: keyboard and screen reader path; progress and error announcements; 320px; `npm run test:import` still passes
    - Deps: 13
15. **Merge Budget setup and help; help text** (v0.6/15) — decided 2026-11-08 (`0009` §5): "?" opens the wizard (auto on first load) with "Advanced options" (opens Budget setup) in its footer; "Setup Budget" tab action removed; a "Backup" button in its place opens one export/restore/import dialog; the bottom Backup section is removed. Mockups pending the human's comments.
    - Source: roadmap v0.6; `0009` §5
    - Files: `src/App.tsx`, `src/components/Backup.tsx`, `src/screens/Onboarding.tsx`, `src/components/ui/Tabs.tsx`
    - Verify: all old help and backup content kept; wizard, Advanced options and Backup dialog work by keyboard
    - Deps: 14 for the Import section (the rest can land earlier); **needs human comments** on the mockups
16. **Upload step in onboarding** (v0.6/16) — add upload to the wizard once import works.
    - Source: roadmap v0.6
    - Files: `src/screens/Onboarding.tsx`, import components
    - Verify: skipping works; imported data replaces the preset choice cleanly
    - Deps: 11, 14
17. **UI/UX review** (v0.6/17) — human approval, `0005` checklist, all widths and themes.
    - Deps: 1–16
18. **Accessibility pass** (v0.6/18) — `docs/audits/a11y/a11y-v0.6.md`.
    - Deps: 17
19. **Security review** (v0.6/19) — `docs/audits/security/security-v0.6.md`; import is the main new surface (file parsing, size limits, injection into stored text); confirm fast-xml-parser is 5.12.0 or later (step 14). On approval bump to v0.7.0.
    - Deps: 18

### Execution
- ✅ **A — Small fixes** (steps 1, 2, 3, 4; MultiSelect, repository, AddBudget, App): parallel-safe, sequential in one session.
- ✅ **B — Amounts and descriptions** (steps 5, 6, 7; AddBudget, structure, seed): after A step 3 (same `AddBudget.tsx`).
- **C — Setup and table dialogs** (steps 8, 9, 10, 9a; BudgetSetup, BudgetTable, App.css): after B; design settled. Step 9a (hover styling) last. Built in v0.6.11–v0.6.18 and approved; only the Week/Month Add/Subtract date picker (step 9) remains.
- ~~**D — Nesting**~~ dropped 2026-11-08 (step 12; the model already exists).
- ✅ **E — Wizard** (step 11; Onboarding): after A; design settled, so it can run any time after A (before C or D if wanted).
- **F — Import** (steps 13, 13a, 14, 15, 16; import, Backup, BudgetSetup, Onboarding): after E.
- **Reviews** (steps 17–19): main session with the user.
- Status: ✅ A · ✅ B · ✅ C · — D dropped · ✅ E · ⏳ F (13 ✅) · ☐ reviews

### Session process
Run option 1: one session per group, fresh start at each group boundary. A session starts by reading this file and the roadmap, then:
0. **Work in a worktree** (`.claude/CLAUDE.md` "Workflow agents use a worktree"): create `.claude/worktrees/v0.6-group-<x>` from the latest `main`, build there, and at the end of the group or step stop and ask the human to approve the merge. Never merge to `main` without that approval. After approval, fast-forward merge, then remove the worktree.
1. **Find the start:** the first group in the order below that is not ✅ and whose dependencies are met. Within it, the first step not marked ✅. Stop and ask if the status line and the step marks disagree.
2. **Check blockers** listed on the steps of the group ("needs human decision", "needs spec", "blocked"). Do not build a blocked step: skip it, or stop and tell the user if it is the only one left.
3. **Build one step at a time:** re-read the latest version on `main`, build and lint, commit with the next patch version and the `Plan-Step: v0.6/N` trailer, mark the step ✅ with its version(s). Check `git diff --cached --stat` before each commit.
4. **UI steps** pause for human approval before they are marked ✅ (`0005`).
5. **At the end of the group:** update the Execution status line (e.g. `✅ A · ☐ B`), commit in the worktree, and tell the user the group is done and waiting for merge approval. The status line on `main` changes only after the merge.
6. **Group order:** A → B → C → F. E (wizard) can run any time after A (design settled); F needs E. Small groups (A) may share a session with the next group if context is light. F spans several sessions, each resuming at a step boundary.
7. **Reviews** (17–19) are run in the main session with the user, not by a worker.

## Rules
- Each completed item: commit + version bump (per `.claude/CLAUDE.md` "Version numbering").
- Human-facing docs in `docs/`; do not duplicate docs.
- Stop and ask on any uncertainty.
