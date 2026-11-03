# RESUME-HERE

Tracking file for current work status. Roadmap authority: `docs/design/0003-roadmap.md`.
Design: `0004-table-design.md` (table), `0006-prototype.html` (v0.2 UI), `0007-v0.3-design-updates.md` (v0.3 changes), `0008-v0.5-design-updates.md` (v0.5 changes; wins on conflict).

## v0.5 plan of action
Versions follow "Version numbering" in `.claude/CLAUDE.md` (patch +1 per completed-work commit; trailer `Plan-Step: v0.5/N`). The final step bumps to v0.6.0. UI steps need human approval (`0005-ui-ux-review-checklist.md`). Baseline: v0.5.0; v0.4 complete (`docs/audits/security/security-v0.4.md`, `docs/audits/a11y/a11y-v0.4.md`). Data: Dexie v8 (`src/storage/structure.ts`). Testing: headless Chromium via host flatpak + puppeteer-core; scripts in the session scratchpad.

1. **Table expanders as buttons** ✅ (v0.5.2) (v0.5/1) — every expand/collapse control is a `<button>` with `aria-expanded`, holding a decorative icon and the row name.
   - Source: roadmap v0.5 "Table fixes"; `0008` §1
   - Files: `src/components/BudgetTable.tsx`, `src/screens/BudgetSetup.tsx`, `src/App.css`
   - Verify: Tab reaches each expander; Enter/Space toggles; accessible name = row name only; all five tables
   - Deps: none
2. **Budget setup without its own shortcuts** ✅ (v0.5.2) (v0.5/2) — remove arrow/Home/End/Enter/F2/Escape handling in Budget setup; every field is a Tab stop; keep `treegrid`, `aria-level`, `aria-expanded`.
   - Source: `0008` §2 (supersedes Budget setup part of `0007` §10)
   - Files: `src/screens/BudgetSetup.tsx`, `src/components/ui/useTreegrid.ts`
   - Verify: no roving tabindex left; Budget Day/Week/Month/Annual keep the `0007` §10 model; screen reader table keys checked in step 11 (stop and ask if they break)
   - Deps: 1
3. **Due date control by recurrence** ✅ (v0.5.3) (v0.5/3) — Budget setup shows the control from the `0008` §3.2 table; changing recurrence clears a due date that no longer fits; stored on `Category` (Dexie bump if the shape changes).
   - Source: `0008` §3.2
   - Files: `src/screens/BudgetSetup.tsx`, `src/budget/tree.ts`, `src/storage/db.ts`, `src/storage/repository.ts` (new optional fields `dueWeekday`, `dueDay`, `dueDay2`; no Dexie version bump, none are indexed)
   - Verify: each recurrence shows the right control and option ranges; save + reload keeps the value; build + lint
   - Deps: 2; decided 2026-11-03: Every 2 weeks uses a date picker "Next pay date"/"Next due date"; column heading renamed "Schedule" (`0008` §3.2)
4. **Due date placement in tables** ✅ (v0.5.3) (v0.5/4) — an estimate with recurrence and due date puts its full amount on the expected day/week/month and that period's total; without a due date it spreads as v0.4.
   - Source: `0008` §3.1
   - Files: `src/budget/tree.ts`, `src/components/BudgetTable.tsx`
   - Verify: fixed-date cases incl. "Last" in Feb (28/29) and 31-day months, quarterly/annual dates, custom month boundaries; computed rows (`0004-table-design.md`) count each amount once
   - Note: Annual and Day show no estimates (`0007` §7.2, §7.4), so the Annual part of `0008` §3.1 has no visible effect yet; the placement code is period-based and works if Annual ever shows estimates. Bi-monthly places payments only when both days are set; otherwise it spreads.
   - Deps: 3; decided 2026-11-03: the estimate is per payment (bi-monthly puts the full estimate on each payment day)
5. **Period borders** (v0.5/5) — solid border between periods and before Total in Week, Month, Annual; none between Est. and Act.
   - Source: `0008` §4
   - Files: `src/App.css`, `src/components/BudgetTable.tsx`
   - Verify: computed styles + screenshots at 320/640/1024px, both themes; 3:1 contrast
   - Deps: 4 (same files)
6. **Date navigation refinement** ✅ (v0.5.1) (v0.5/6) — chevron Previous/Next (names unchanged); range title opens the browser calendar directly, replacing the v0.4 popover.
   - Source: `0008` §5
   - Files: `src/screens/Budget.tsx`, `src/components/ui/DatePicker.tsx`, `src/App.css`
   - Verify: names "Previous/Next {unit}"; `showPicker()` opens the calendar with a fallback where unsupported; focus returns to the title
   - Deps: none
7. **Settings: rewards + notifications toggles** (v0.5/7) — `rewardsEnabled` (default on) and `notificationsEnabled` stored in Settings, with a settings UI.
   - Source: roadmap v0.5; `0001` Notifications; `0002` Reward System, Settings
   - Files: `src/storage/structure.ts`, `src/storage/db.ts`, `src/storage/repository.ts`, `src/App.tsx`, new settings component
   - Verify: toggles persist across reload; notification permission asked only on user action, denial handled
   - Deps: none; **needs human decision**: is v0.5 the toggle only, or a working daily reminder (a web app can't reliably schedule one while closed)?
8. **Rewards animation** (v0.5/8) — animation on each successful budget-item save when `rewardsEnabled`.
   - Source: roadmap v0.5; `0001`, `0002` Reward System
   - Files: `src/screens/AddBudget.tsx`, new reward component, `src/App.css`
   - Verify: plays on save only; off when toggled off; respects `prefers-reduced-motion`; doesn't steal focus or cover Save
   - Deps: 7; **needs human decision**: animation style and sound (held in `0001`/`0002`)
9. **Onboarding questionnaire** (v0.5/9) — first-run flow: pay frequency; categories Yes/No → multi-select with autocomplete over preloaded categories + "add your own"; selections populate the tables.
   - Source: roadmap v0.5; `0004-table-design.md` Onboarding
   - Files: new `src/screens/Onboarding.tsx`, `src/App.tsx`, `src/storage/seed.ts`, `src/storage/preselected.ts`, `src/storage/repository.ts`, `src/components/ui/ItemSelector.tsx`
   - Verify: shows on empty DB only; combobox keyboard pattern; custom names validated; tables populated
   - Deps: 7 (Settings shape); **needs human decision**: skip / reopen later / resume after reload; where pay frequency is used
10. **Abbreviation audit** (v0.5/10) — find abbreviations in visible text and accessible names ("Est.", "Act.", short dates); spell out or give full accessible names.
    - Source: roadmap v0.5
    - Files: all screens/components with visible text
    - Verify: scripted scan of every screen shows no unexplained abbreviations
    - Deps: 1–9 (runs over finished UI)
11. **UI/UX review** (v0.5/11) — human approval, `0005` checklist, all widths and themes.
    - Deps: 1–10
12. **Accessibility pass** (v0.5/12) — `docs/audits/a11y/a11y-v0.5.md`; includes screen reader table keys in Budget setup (`0008` §2).
    - Deps: 11
13. **Security review** (v0.5/13) — `docs/audits/security/security-v0.5.md`; on approval bump to v0.6.0.
    - Deps: 12

### Execution
- **A — Tables** (steps 1, 2, 3, 4, 5; BudgetTable, BudgetSetup, tree, storage): sequential.
- **B — Date navigation** (step 6; Budget.tsx, DatePicker): parallel with A.
- **C — Settings, rewards, onboarding** (steps 7, 8, 9; storage, App, AddBudget, new screens): after A step 3 lands (shared `structure.ts`/`db.ts` Dexie bump), then sequential.
- **D — Abbreviation audit** (step 10): after A, B, C.
- **Reviews** (steps 11–13): main session with the user.
- Status: ☐ A · ✅ B · ☐ C · ☐ D · ☐ reviews

## Rules
- Each completed item: commit + version bump (per `.claude/CLAUDE.md` "Version numbering").
- Human-facing docs in `docs/`; do not duplicate docs.
- Stop and ask on any uncertainty.
