# RESUME-HERE

Tracking file for current work status. Roadmap authority: `docs/design/0003-roadmap.md`.
Design: `0015-sync-design.md` (sync), `0004-table-design.md` (table), `0006-prototype.html` (v0.2 UI), `0007-v0.3-design-updates.md` (v0.3 changes), `0008-v0.5-design-updates.md` (v0.5 changes), `0009-v0.6-design-updates.md` (v0.6), `0012-design-standards.md` (standards), `0014` (Annual Misc breakdown). Higher-numbered doc wins on conflict.

## Current version
v0.8.0 (v0.7 complete 2026-11-27, v0.7.0 to v0.7.67 plus the review fixes in v0.8.0; reports: `docs/audits/a11y/a11y-v0.7.md`, `docs/audits/security/security-v0.7.md`). v0.8 has not started; the first step is a design pass (nothing is built before the human approves a mockup).

## v0.8 plan of action
Versions follow "Version numbering" in `.claude/CLAUDE.md` (patch +1 per completed-work commit; trailer `Plan-Step: v0.8/N`). The final step bumps to the next minor version (v0.9.0). UI steps need human approval (`0005-ui-ux-review-checklist.md`). Baseline: v0.8.0. Data: Dexie v10 (`src/storage/db.ts`). Testing: `tests/README.md`; accessibility script approach in `a11y-v0.7.md`.

**Run option (estimate):** single session with fresh restarts. Most steps are UI steps that need the human's approval mid-way and share `App.css`, `BudgetTable.tsx` and `Backup.tsx`, so subagents would save little.

**Before building (human):** every step below starts with a design pass or has an open decision ("needs human decision"). The chart library is a new dependency and needs the human's go-ahead (two-week-old exact version).

1. **Help, wizard and Backup UX design** (v0.8/1) — mockups and a design doc: Help dialog with sync instructions and a "What's new" list (latest 2 or 3 from `updates.json`); the wizard only on first launch; a better home for "Advanced options"; grouping and names for Import, Export, Backup and Sync.
   - Source: roadmap v0.8 "Help, wizard and Backup UX"
   - Files: `docs/design/` (new doc, mockups in `docs/design/images/v0.8-help-backup/`), roadmap update
   - Verify: the human approves the design
   - Deps: none; needs human decision
2. **Help, wizard and Backup UX build** (v0.8/2)
   - Source: step 1 design
   - Files: `src/components/Backup.tsx`, `src/screens/Onboarding.tsx`, `src/App.tsx`, `src/components/ui/`, `src/App.css`, `src/updates/`
   - Verify: build + lint; `test:dialogs`; 1280/640/375/320px
   - Deps: 1
3. **Mobile-first layout design** (v0.8/3) — 360 to 430px first, WCAG AA kept at 320px; settles the breakpoints and the media query limit in `0012`.
   - Source: roadmap v0.8; `0012` §2
   - Files: `docs/design/0012-design-standards.md`, mockups
   - Verify: the human approves
   - Deps: none; needs human decision
4. **Mobile-first layout build** (v0.8/4)
   - Files: `src/App.css`, `src/styles/tokens.css`, `src/components/BudgetTable.tsx`, screens
   - Verify: build + lint; `test:dialogs`; 1280/640/375/320px; no page-level sideways scroll
   - Deps: 3
5. **Compact rows and zoom** (v0.8/5) — a compact-rows option and zoom in and out (+/−) for the budget tables (decided 2026-11-22). Where the controls live needs a mockup.
   - Files: `src/components/BudgetTable.tsx`, `src/App.css`, settings in Budget setup
   - Verify: build + lint; `test:dialogs`; keyboard operable
   - Deps: 4
6. **Misc. Breakdown threshold setting** (v0.8/6) — the review threshold becomes a setting (default 6; `0014` M4).
   - Files: `src/storage/db.ts` (settings, Dexie version if indexed), `src/storage/repository.ts` (`cleanSettings`, restore), `src/screens/BudgetSetup.tsx`, `src/components/MiscBreakdown.tsx`; sync carries the setting (`engine.ts` settings content)
   - Verify: build + lint; `test:import`, `test:sync`, `test:dialogs`
   - Deps: none
7. **Chart design** (v0.8/7) — chart types, the library and the Table/Chart switch; mockups first.
   - Source: roadmap v0.8; security v0.2 4.5, 2.5 (Trusted Types, escaped item names in labels)
   - Files: `docs/design/` (new doc), roadmap update
   - Verify: the human approves the design and the dependency
   - Deps: none; needs human decision
8. **Chart view** (v0.8/8) — Table/Chart switch and the chart types.
   - Files: new `src/components/charts/`, `src/screens/Budget.tsx`, `src/App.css`, `package.json` (approved library)
   - Verify: build + lint; `test:dialogs`; alt text, keyboard navigation; CSP unchanged or reviewed
   - Deps: 7, 4
9. **UI/UX review** (v0.8/9) — human approval, `0005` checklist, all widths.
   - Deps: 1–8
10. **Accessibility pass** (v0.8/10) — including chart alt text, keyboard navigation and screen reader (the v0.7 screen reader test is not recorded: include the v0.7 flows listed in `a11y-v0.7.md`).
    - Deps: 9
11. **Security review** (v0.8/11) — covers charts; carried items in `security-v0.7.md` (v0.2 2.5, 4.5, 4.3). On approval bump to v0.9.0.
    - Deps: 10

### Execution
- **A — Design** (steps 1, 3, 7; docs only): first, with the human.
- **B — Help and Backup** (step 2; `Backup.tsx`, `Onboarding.tsx`, `App.tsx`): after step 1.
- **C — Layout** (steps 4, 5; `App.css`, `BudgetTable.tsx`): after step 3.
- **D — Setting** (step 6; storage, `BudgetSetup.tsx`, `MiscBreakdown.tsx`): any time.
- **E — Charts** (step 8; new component folder): after steps 4 and 7.
- **Reviews** (steps 9–11): main session with the user.
- Status: ☐ A · ☐ B · ☐ C · ☐ D · ☐ E · ☐ reviews

### Session process
Run option 1: one session per group, fresh start at each group boundary. A session starts by reading this file and the roadmap, then:
0. **Work in a worktree** (`dev-workflow.md`): create `.claude/worktrees/v0.8-group-<x>` from the latest `main` (or from `dev/v0.8` when a session builds several groups), build there, and at the end of the group or step stop and ask the human to approve the merge. Never merge to `main` without that approval.
1. **Find the start:** the first group in the order above that is not ✅ and whose dependencies are met; within it, the first step not marked ✅. Stop and ask if the status line and the step marks disagree.
2. **Check blockers** ("needs human decision", "blocked"). Do not build a blocked step: skip it, or stop and tell the user if it is the only one left.
3. **Build one step at a time:** re-read the latest version on `main`, build and lint, commit with the next patch version and the `Plan-Step: v0.8/N` trailer, mark the step ✅ with its version(s). Check `git diff --cached --stat` before each commit.
4. **UI steps** pause for human approval before they are marked ✅ (`0005`).
5. **At the end of the group:** update the Execution status line, commit in the worktree, and tell the user the group is done and waiting for merge approval. Before asking to merge to `main`, update the update popup (`src/updates/updates.json`) and have the human review its Changes list (`.claude/CLAUDE.md`, "Update popup").
6. **Reviews** (9–11) are run in the main session with the user, not by a worker.

## Rules
- Each completed item: commit + version bump (per `.claude/CLAUDE.md` "Version numbering").
- Human-facing docs in `docs/`; do not duplicate docs.
- Stop and ask on any uncertainty.
