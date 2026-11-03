# Roadmap

Table design and category hierarchy: `docs/design/0004-table-design.md`.

Note: UI/UX must be approved by human before the accessibility pass. Agent rule: "Implementation agents must not mark a UI-touching item complete until the UI/UX has been approved by human; a11y pass starts only after sign-off." See `docs/design/0005-ui-ux-review-checklist.md`.
Computed rows: see `0004-table-design.md` (each is marked `*` in the hierarchy
with its formula).

Deferred exploration: whether Savings should be computed as (income − spending)
rather than summed from savings items. Difficult because the user can add custom
items and categories. Worth revisiting once basic functionality is built —
tracked as a later-version item.

## v0.1 — Web PWA foundation (complete)
- ✅ Scaffold project (React + TS, Vite, PWA plugin)
- ✅ Plain CSS design tokens (colors, spacing, typography)
- ✅ In-house UI components: button, input, dropdown-with-search, date picker, amount input, checkbox group
- ✅ IndexedDB storage via Dexie + repository layer
- ✅ Add flow (dropdown search, date picker default today, amount required, save)
- ✅ Budget screen skeleton (table view, Day/Week toggles)
- ✅ PWA manifest + service worker (offline cache)
- ✅ Finalize color tokens (rename + comments)
- ✅ Accessibility refactor of UI (labels, ARIA, focus, touch targets)
- ✅ UI fixes (contrast, combobox, refresh, layout, a11y)
- ✅ Security review (approved) → transition to v0.2.0

## v0.2 — Category model, estimates, Day table (complete)
- ✅ Cleanup + structure (Vite boilerplate removed, unused assets dropped)
- ✅ Category hierarchy model + seed data (full tree from `0004-table-design.md`, each with a color; computed rows flagged)
- ✅ `BudgetItem` gains `estimate`, `frequency`, `dueDate`, `autopay`; add flow asks for estimated spend + frequency
- ✅ Day table view (Est./Act. columns, only rows with amounts, category grouping)
- ✅ Form validation (required fields, amount parsing) + accessibility fixes
- ✅ UI/UX refactor per `0006-prototype.html`: combined Item control, Budget setup overlay, negative amounts, bi-monthly = twice a month, CSS classes instead of inline styles, table follows `0004` order/indents/colors
- ✅ Week and Month table views (pulled forward from v0.4)
- ✅ Data model rework (Dexie v5): amounts link to categories by id; estimate fields live on categories; Medical › Miscellaneous added
- ✅ UI/UX review (approved)
- ✅ Accessibility pass (Lighthouse 100 on six app states; keyboard and screen reader tests passed)
- ✅ Security review (`docs/audits/security/security-v0.2.md`, approved): storage persistence + JSON backup export/restore, non-guessing migration + review flags (Dexie v6), shared money/date/name rules, clear error handling, production CSP → transition to v0.3.0

## v0.3 — Edit/Delete in the tables + Categories CRUD
- Editing in the tables (0007 §9; replaces the 0001 Edit and Delete flows):
  - Day: each purchase on its own row; delete purchases
  - Week/Month: add a value (+/−) to an item; delete subcategories and items with no purchases
  - Annual: rename subcategories and items
- Categories CRUD: create and reorder in Budget setup (0007 §5), rename in Annual, delete in Week/Month; top-level categories are never deleted
- `dueDate`/`autopay` display + editing on items
- ✅ Search/filter dropdown shared component (item and category pickers, 0007 §8.3)
- ✅ Audit categories and items for repeated or ambiguous names (0007 §8); remove the `needsReview` flags (pre-alpha, no legacy data)
- Design updates per `0007-v0.3-design-updates.md` (plan of action made when v0.3 starts):
  - Calendar settings: week start, month boundaries (0007 §1)
  - Category structure: Income group, subcategories under Income/Savings/Expenses, calculated subcategory estimates (0007 §2)
  - Recurrence for all items; Quarterly/Annual for Debt, Utilities, Subscriptions; estimate scaling (0007 §3)
  - Add form: remove estimate fields; selected-items list; new item/subcategory flow with "Use in future" (0007 §4)
  - Budget setup overlay redesign: combined table, reordering, preview table, Save/Cancel (0007 §5)
  - Tab navigation: Add budget item / Budget (0007 §6)
  - Day (actuals only) and Annual tables (0007 §7)
- ✅ UI/UX review (human approval, four review rounds; changes in 0007 §10)
- ✅ Accessibility pass (Lighthouse 100 on 12 states; keyboard and screen reader tests passed; `docs/audits/a11y/a11y-v0.3.md`)
- ✅ Security review (`docs/audits/security/security-v0.3.md`, approved): backup restore rejects looping or too-deep category trees, restore type checks, clear delete errors → transition to v0.4.0

## v0.4 — Week/Month/Annual + navigation
- Week/Month/Annual table views (date-spanning columns, per-period Est./Act.)
- Historical navigation (prev/next date range): a date `nav` above the tables (0007 §9.5)
- Estimate scaling math: replace day-based scaling (monthly ÷ 30.44 × days) so monthly-style estimates show the typed amount per month (`docs/audits/security/security-v0.2.md` 3.4)
- Multi-column form layout for large screens (1280px breakpoint, 0007 §10)
- Table row actions: when a row has more than one action button, put them in an actions menu so rows line up
- Rename subcategories and items from the Week and Month tables, with a confirmation dialog: "This will change the name of all instances of {old name} to {new name} across the application." (Confirm / Cancel)
- Budget setup Create row visual redesign (keep one per category with Add to; current layout works but is cluttered)
- Budget setup: make Taxes an expander in the table, like the other categories
- Remove the border around the edit-name buttons
- Budget setup "Add" buttons: tooltip "First enter a value in 'Create in {subcategory name}'"
- Week table: break columns down by day
- Fix: Save/Cancel in the edit control overflow their container
- Remove the "Show estimates" checkbox from the Day and Annual tables
- Larger scroll bars
- ✅ Refactor "Year" to "Annual" (UI labels, code, design docs)
- Estimate toggle for the Week and Month tables (default on)
- Expand/collapse category/subcategory rows + persisted state
- UI/UX review (human approval)
- Accessibility pass
- Security review

## v0.5 — Rewards, settings, onboarding
- Rewards animation + `rewardsEnabled` toggle
- `notificationsEnabled` toggle
- Onboarding questionnaire (pay frequency, category opt-in multi-select with autocomplete)
- UI/UX review (human approval)
- Accessibility pass
- Security review

## v0.6 — Data import + deep nesting
- CSV/HTML upload + auto-categorization parsing
- UI/UX for the upload flow
- Deep subcategory nesting (subcategories containing subitems)
- Add upload step to onboarding once it works
- Data import / export: build on the v0.2 JSON backup export/restore (`docs/audits/security/security-v0.2.md` 6.2; file-handling requirements in 1.1 and 2.2)
- UI/UX review (human approval)
- Accessibility pass
- Security review

## v0.7 — Graphs and charts
- Chart view (Table/Chart switch)
- Chart types for Budget screen
- UI/UX review (human approval)
- Accessibility pass for charts (alt text, keyboard nav, screen reader)
- Security review

## v0.8 — Sync
- StorageAdapter interface + OnlyOffice adapter
- JSON-doc storage shape (version + updatedAt per record)
- Sync-on-open: pull then push, last-write-wins, tombstones
- Optional passphrase client-side encryption
- Seed categories/table layout from OnlyOffice sheet
- Security review

## v0.9 — Distribution + polish
- Per-OS install instructions (web, Android, GrapheneOS)
- Offline robustness + cache eviction handling
- UI/UX review (human approval)
- Final accessibility audit
- Security review

## Post v1.0
- Correct a single purchase's amount or date (today: delete it and add it again)
- Receipt photo capture (camera API / Capacitor if needed)
- Capacitor APK build (if native notifications required)