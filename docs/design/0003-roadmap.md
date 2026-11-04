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
- ✅ Week/Month/Annual table views (date-spanning columns, per-period Est./Act.; Week by day)
- ✅ Historical navigation (prev/next date range): a date `nav` above the tables (0007 §9.5)
- ✅ Estimate scaling math: replace day-based scaling (monthly ÷ 30.44 × days) so monthly-style estimates show the typed amount per month (`docs/audits/security/security-v0.2.md` 3.4)
- ✅ Multi-column form layout for large screens (1280px breakpoint, 0007 §10)
- ✅ Table row actions: when a row has more than one action button, put them in an actions menu so rows line up
- ✅ Rename subcategories and items from the Week and Month tables (and Annual), with a confirmation dialog: "This will change the name of all instances of {old name} to {new name} across the application." (Confirm / Cancel)
- ✅ Budget setup Create row visual redesign (keep one per category with Add to; current layout works but is cluttered)
- ✅ Budget setup: make Taxes an expander in the table, like the other categories
- ✅ Remove the border around the edit-name buttons
- ✅ Budget setup "Add" buttons: tooltip "First enter a value in 'Create in {subcategory name}'"
- ✅ Week table: break columns down by day
- ✅ Fix: Save/Cancel in the edit control overflow their container
- ✅ Remove the "Show estimates" checkbox from the Day and Annual tables
- ✅ Larger scroll bars
- ✅ Refactor "Year" to "Annual" (UI labels, code, design docs)
- ✅ Estimate toggle for the Week and Month tables (default on)
- ✅ Expand/collapse category/subcategory rows + persisted state
- ✅ UI/UX review (approved)
- ✅ Accessibility pass (Lighthouse 100 on 15 states; keyboard and screen reader tests passed; `docs/audits/a11y/a11y-v0.4.md`)
- ✅ Security review (`docs/audits/security/security-v0.4.md`, approved): rename re-checked when it saves; estimate scaling (v0.2 3.4) fixed → transition to v0.5.0

## v0.5 — Rewards, settings, onboarding (complete)
- ✅ Rewards hooks + `rewardsEnabled` toggle (`0008` §6, §7): placeholder image, animation and sound; final design after user testing
- ✅ `notificationsEnabled` toggle with permission request and `sendReminder()` hook (`0008` §6); no scheduling in v0.5
- ✅ Table fixes (`0008` §1–4): expanders as real buttons (icon + name); Budget setup without its own keyboard shortcuts (treegrid role kept); due dates place the full amount on the expected day/week/month, with the "Schedule" control set by recurrence; borders between time periods in Week, Month and Annual
- ✅ Date navigation refinement (`0008` §5): chevron Previous/Next; the range title opens the calendar directly
- ✅ Abbreviation audit: find abbreviations in visible text and accessible names (e.g. "Est.", "Act.", short dates); give each a full accessible name or spell it out
- ✅ Onboarding questionnaire (pay frequency, category opt-in multi-select with autocomplete), skippable, reopened by a ? help button next to the heading (`0008` §8)
- ✅ UI/UX review (approved)
- ✅ Accessibility pass (`docs/audits/a11y/a11y-v0.5.md`; one live region, table keyboard shortcuts removed, preview header fixed)
- ✅ Security review (`docs/audits/security/security-v0.5.md`, approved): no Medium or higher → transition to v0.6.0

## v0.6 — Data import + deep nesting
- Defects (`docs/defects/`): D001 onboarding name length limit; D002 duplicate settings rows
- CSV/HTML upload + auto-categorization parsing; an Import button on the Budget setup page accepts the 3 most common spreadsheet file types (formats to confirm, likely CSV, XLSX, ODS) so a user can import an existing budget. Large effort: expect several testing and refinement rounds
- (Primary User Request) More informative "Saved" confirmation: the text says what was saved and how much (e.g. the item name and amount), not just "Saved"
- Combine "Budget setup" and help (exact merge to confirm with the user before building)
- UI/UX changes from the v0.5 review (`0009-v0.6-design-updates.md`; prototypes `0010` and `0011` are reviewed and refined before building):
  - Onboarding as a three-step wizard with a progress bar
  - Budget setup: "Add" buttons in place of the four "Create in" fields
  - Highlight dialog: clicking an item name opens a dialog with the item and its children and the table's functions; the chevron alone expands and collapses
  - Budget tables (not Annual): the Actions menu is renamed "Edit" with Rename (moves the item to its right category, with a warning that it changes all historic records), Add/Subtract (Day: New purchase) and Delete (Day and Week only), each opening a dialog; Day purchase rows have an Edit button instead, opening one dialog with the Add purchase form prepopulated (`0009` §4.1)
  - Backup and upload described in the help dialog
  - Add/Subtract: Day has a New purchase button on category rows; purchases are edited in their own dialog and adds to or subtracts from an item's total in Week and Month, with a date picker limited to the viewed period (`0009` §4.1)
- Hover styling on buttons and links across the app (decided 2026-11-04; built v0.6.15)
- Week, Month and Annual amount columns at least wide enough for 222,222.99, in the tables and the highlight dialog (decided 2026-11-04; built v0.6.17)
- Refactor so each tab panel's header below the tab is visually hidden (still available to screen readers)
- Add addition and subtraction to the amount fields: typed expressions (decided 2026-11-04)
- Optional description field below Amount
- Charity takes purchases itself until it gets its first item; then its purchases move to Charity › Miscellaneous and Charity becomes a roll-up (`0009` §6, draft pending human review)
- UI/UX for the upload flow
- Deep subcategory nesting (subcategories containing subitems)
- Add upload step to onboarding once it works
- Data import / export: build on the v0.2 JSON backup export/restore (`docs/audits/security/security-v0.2.md` 6.2; file-handling requirements in 1.1 and 2.2)
- UI/UX review (human approval)
- Accessibility pass
- Security review

## v0.7 — Graphs and charts
- Rewrite the supporting text under the tables, which is out of date (decide its final content first)
- Form field alignment class: adds the same space between a label and its control as appears when supporting (help) text sits between them, so fields shown side by side in columns line up in even rows (decided 2026-11-04)
- Negative purchases (refunds or credits, `0007` §9) are listed in the Day table as a return (decided 2026-11-04; the exact label and styling are decided when built)
- Input parsing for typed names: spell check and common abbreviations (e.g. "Misc." is tracked as "Miscellaneous") (decided 2026-11-04; the abbreviation list, where it runs and whether it corrects silently or asks are decided when built)
- Move subcategories and items between parents: a subcategory moved into another becomes an item; an item moved out of a subcategory becomes a subcategory (e.g. a user creates "Retirement" under Savings and places IRA, 401k and 403b inside it). Must be fully keyboard accessible. Moving a subcategory that has items into another subcategory is refused with an error message (decided 2026-11-04). The interaction (a Move dialog, as Rename's Category select in `0009` §4, versus other ways) and what happens to the moved row's purchases and estimates are designed before building
- Maximum app width of 1440px (decided 2026-11-04; content stays centered and the charts below use it)
- Item column: sticky (left) in the Week, Month and Annual tables and the highlight dialog when the viewport is wider than 500px, and a persistent minimum width of 250px in every table in the app (decided 2026-11-04). Per the accessibility rules, sticky is removed at 500px and narrower, and focused cells must not be hidden behind the sticky column
- Consolidate dialogs into one component (today three: form dialogs, confirm dialogs and a generic dialog); migrate the v0.6 dialogs (Edit menu, highlight, wizard) to it (decided 2026-11-04)
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
- Correct a single purchase's date (today: delete it and add it again; the amount moves to v0.6)
- Receipt photo capture (camera API / Capacitor if needed)
- Daily end-of-day reminder: needs a delivery outside the web app (phone reminder, or Capacitor APK build with local notifications)