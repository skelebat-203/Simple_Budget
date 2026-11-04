# RESUME-HERE

Tracking file for current work status. Roadmap authority: `docs/design/0003-roadmap.md`.
Design: `0004-table-design.md` (table), `0006-prototype.html` (v0.2 UI), `0007-v0.3-design-updates.md` (v0.3 changes), `0008-v0.5-design-updates.md` (v0.5 changes; wins on conflict), `0009-v0.6-design-updates.md` (v0.6; wins on conflict).

## v0.6 plan of action
Versions follow "Version numbering" in `.claude/CLAUDE.md` (patch +1 per completed-work commit; trailer `Plan-Step: v0.6/N`). The final step bumps to v0.7.0. UI steps need human approval (`0005-ui-ux-review-checklist.md`). Baseline: v0.6.0; v0.5 complete (`docs/audits/security/security-v0.5.md`, `docs/audits/a11y/a11y-v0.5.md`). Data: Dexie v8 (`src/storage/structure.ts`; schedule fields and `Settings.onboarded` unindexed). Testing: headless Chromium via host flatpak + puppeteer-core; scripts in the session scratchpad.

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
7. **Charity "Miscellaneous" item** (v0.6/7) — generic Miscellaneous item exists in Charity even with no other items; when it is the only item, purchases go in it directly.
   - Source: roadmap v0.6; replaces auto-created behavior in `0007` §2.1
   - Files: `src/storage/seed.ts`, `src/storage/preselected.ts`, `src/screens/AddBudget.tsx`, `src/budget/tree.ts`
   - Verify: no extra Miscellaneous stuff category when it is the only item; behavior with other Charity items unchanged
   - Deps: **replan signal**: update `0007` §2.1 (or `0009`) first, then build
8. **Budget setup "Add" buttons** (v0.6/8) — one Add button per category replaces the four "Create in" field rows; selecting it shows that category's fields above the button; announces "Fields added above".
   - Source: `0009` §2
   - Files: `src/screens/BudgetSetup.tsx`, `src/App.css`
   - Verify: focus moves to first new field; polite announcement through the single live region; Tab order; 320px
   - Deps: none
9. **Edit menu with dialogs** (v0.6/9) — Day, Week, Month rows: "Actions" becomes "Edit" with Description, Rename (moves item to the right category), Add/Subtract, Delete (Day and Week only); each opens a dialog. Annual unchanged.
   - Source: `0009` §4, §4.1; roadmap v0.6
   - Files: `src/components/BudgetTable.tsx`, new dialog components in `src/components/ui/`, `src/budget/setupEdits.ts`, `src/App.css`
   - Verify: dialog focus trap and return; rename-to-other-category moves the item; delete only where allowed; five tables
   - Deps: 5, 6; behavior decided 2026-11-04 in `0009` §4.1 (Day: New purchase button on category rows, amount update on purchase rows; Week/Month: add to or subtract from the item total; supersedes `0007` §9.1/§9.4 for the amount, so the roadmap's Post v1.0 item now covers the date only)
10. **Highlight dialog** (v0.6/10) — clicking an item name opens a dialog with the row, its children and the table's functions; the chevron alone expands and collapses.
    - Source: `0009` §3; prototype `0011`; decided 2026-11-04: dialog shows the row as in the table viewed (Day lists purchases; Week/Month/Annual do not); Delete confirms first, hidden in Month/Annual; Rename not offered for top-level categories; a purchase row in Day opens its own dialog (Add/Subtract, Delete)
    - Files: `src/components/BudgetTable.tsx`, new dialog component, `src/App.css`
    - Verify: the name's clickable cue is a 2px dotted underline; name click no longer toggles (supersedes nothing in `0008` §1 except the name-toggle); same functions as the Edit menu; keyboard and screen reader
    - Deps: 9; `0009` §3 is decided (not blocked)
9a. **Hover styling** (v0.6/9a) — hover state on every button and link across the app (today only some have one).
   - Source: roadmap v0.6; human request 2026-11-04 (highlight review)
   - Files: `src/App.css`, `src/styles/tokens.css`
   - Verify: scripted list of every button/link class with a `:hover` rule; contrast 3:1 in both themes; no hover-only information; disabled buttons do not react
   - Deps: 9, 10 (same `App.css`; covers what their dialogs do not)
11. **Onboarding wizard** (v0.6/11) ✅ (v0.6.7) — three-step dialog wizard with progress bar replacing the single-dialog questionnaire.
    - Source: `0009` §1; prototype `0010`; replaces `0008` §8
    - Files: `src/screens/Onboarding.tsx`, `src/storage/seed.ts`, `src/storage/preselected.ts`, `src/App.css`
    - Verify: progress "step X of 3" announced; Back, Done, presets and Advanced setup (closes the wizard) paths; no "Add your own" box; step 2 text is only "You can change presets later in Budget setup."; shows on empty DB only
    - Deps: 1; decided 2026-11-04 in `0009` §1 (not blocked)
12. **Deep subcategory nesting** (v0.6/12) — subcategories containing subitems, in the tables and Budget setup.
    - Source: roadmap v0.6
    - Files: `src/storage/structure.ts`, `src/storage/db.ts`, `src/budget/tree.ts`, `src/components/BudgetTable.tsx`, `src/screens/BudgetSetup.tsx`, `src/screens/AddBudget.tsx`
    - Verify: roll-ups and computed rows (`0004-table-design.md`) count each amount once at every depth; indent and `aria-level`; Dexie bump with migration tested
    - Deps: 9, 10; **needs spec**: no design doc defines depth limit, indent, colours or the data shape; write it in a numbered design doc and the roadmap first
13. **Import parsing** (v0.6/13) — read CSV, XLSX, ODS (to confirm), auto-categorize rows into categories/items, preview before writing; builds on the JSON backup export/restore.
    - Source: roadmap v0.6; `docs/audits/security/security-v0.2.md` 1.1, 2.2, 6.2
    - Files: new `src/import/`, `src/components/Backup.tsx`, `src/storage/repository.ts`
    - Verify: sample files per format; size/type limits and malformed files fail safely; formula and script content never run; no new dependency without asking (spreadsheet parser library)
    - Deps: 12; **needs human decision**: the 3 formats and the categorization rules. Expect several test and refinement rounds
14. **Import flow UI** (v0.6/14) — Import button on Budget setup, review/preview screen, error and success messages.
    - Source: roadmap v0.6 "UI/UX for the upload flow"
    - Files: `src/screens/BudgetSetup.tsx`, new import screen, `src/App.css`
    - Verify: keyboard and screen reader path; progress and error announcements; 320px
    - Deps: 13
15. **Merge Budget setup and help; help text** (v0.6/15) — combine per the human's decision; help dialog describes backup and upload.
    - Source: roadmap v0.6; `0009` §5
    - Files: help dialog, `src/screens/BudgetSetup.tsx`, `src/App.tsx`
    - Verify: all old help content kept; both entry points work
    - Deps: 14; **needs human decision**: exact merge
16. **Upload step in onboarding** (v0.6/16) — add upload to the wizard once import works.
    - Source: roadmap v0.6
    - Files: `src/screens/Onboarding.tsx`, import components
    - Verify: skipping works; imported data replaces the preset choice cleanly
    - Deps: 11, 14
17. **UI/UX review** (v0.6/17) — human approval, `0005` checklist, all widths and themes.
    - Deps: 1–16
18. **Accessibility pass** (v0.6/18) — `docs/audits/a11y/a11y-v0.6.md`.
    - Deps: 17
19. **Security review** (v0.6/19) — `docs/audits/security/security-v0.6.md`; import is the main new surface (file parsing, size limits, injection into stored text). On approval bump to v0.7.0.
    - Deps: 18

### Execution
- ✅ **A — Small fixes** (steps 1, 2, 3, 4; MultiSelect, repository, AddBudget, App): parallel-safe, sequential in one session.
- **B — Amounts and descriptions** (steps 5, 6, 7; AddBudget, structure, seed): after A step 3 (same `AddBudget.tsx`).
- **C — Setup and table dialogs** (steps 8, 9, 10, 9a; BudgetSetup, BudgetTable, App.css): after B; design settled. Step 9a (hover styling) last.
- **D — Nesting** (step 12; tree, BudgetTable, BudgetSetup, structure): after C; spec first.
- ✅ **E — Wizard** (step 11; Onboarding): after A; design settled, so it can run any time after A (before C or D if wanted).
- **F — Import** (steps 13, 14, 15, 16; import, Backup, BudgetSetup, Onboarding): after D and E.
- **Reviews** (steps 17–19): main session with the user.
- Status: ✅ A · ☐ B · ☐ C · ☐ D · ✅ E · ☐ F · ☐ reviews

### Session process
Run option 1: one session per group, fresh start at each group boundary. A session starts by reading this file and the roadmap, then:
1. **Find the start:** the first group in the order below that is not ✅ and whose dependencies are met. Within it, the first step not marked ✅. Stop and ask if the status line and the step marks disagree.
2. **Check blockers** listed on the steps of the group ("needs human decision", "needs spec", "blocked"). Do not build a blocked step: skip it, or stop and tell the user if it is the only one left.
3. **Build one step at a time:** re-read the latest version on `main`, build and lint, commit with the next patch version and the `Plan-Step: v0.6/N` trailer, mark the step ✅ with its version(s). Check `git diff --cached --stat` before each commit.
4. **UI steps** pause for human approval before they are marked ✅ (`0005`).
5. **At the end of the group:** update the Execution status line (e.g. `✅ A · ☐ B`), commit, and tell the user the group is done so they can start a fresh session.
6. **Group order:** A → B → C → D → F. E (wizard) can run any time after A (design settled); F needs D and E. Small groups (A) may share a session with the next group if context is light. F spans several sessions, each resuming at a step boundary.
7. **Reviews** (17–19) are run in the main session with the user, not by a worker.

## Rules
- Each completed item: commit + version bump (per `.claude/CLAUDE.md` "Version numbering").
- Human-facing docs in `docs/`; do not duplicate docs.
- Stop and ask on any uncertainty.
