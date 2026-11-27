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

## v0.6 — Data import + deep nesting (complete, v0.6.0 to v0.6.37)
- ✅ (D001 v0.6.1, D002 v0.6.2, D003 v0.6.23 to v0.6.29) Defects (`docs/defects/`): D001 onboarding name length limit; D002 duplicate settings rows; D003 editing a purchase resets its time and drops its import mark (found 2026-11-11 in import work; fixed with the import flow UI, confirmed 2026-11-11)
- ✅ (v0.6.20, v0.6.33 to v0.6.35) Spreadsheet upload + auto-categorization parsing (mapping rules in `0013`, test files in `docs/test_sheets/`); an Import option in the Backup dialog accepts CSV and XLSX here, and ODS in the next item (decided 2026-11-08, ODS split out 2026-11-11) so a user can import an existing budget. Large effort: expect several testing and refinement rounds
- ✅ (v0.6.3, v0.6.5) (Primary User Request) More informative "Saved" confirmation: the text says what was saved and how much (e.g. the item name and amount), not just "Saved"
- ✅ (v0.6.21, v0.6.22) Combine "Budget setup" and help (decided 2026-11-08, `0009` §5): the "?" button opens the onboarding wizard (automatically on first load); the wizard footer offers "Advanced options" (opens Budget setup); the "Setup Budget" tab action is removed; a "Backup" button takes its place and opens a dialog for export, restore and import. Proposed 2026-11-26 (v0.8, see "Help, wizard and Backup UX"): the "?" button opens the onboarding wizard or the Help dialog, with the wizard shown only on first launch; "Advanced options" stays in the wizard footer or moves to a better place; the Backup button and dialog stay or are replaced by a better home for Import, Export, Backup and Sync
- ✅ UI/UX changes from the v0.5 review (`0009-v0.6-design-updates.md`; prototypes `0010` and `0011` are reviewed and refined before building):
  - ✅ (v0.6.7) Onboarding as a three-step wizard with a progress bar
  - ✅ (v0.6.11, v0.6.12, v0.6.16) Budget setup: "Add" buttons in place of the four "Create in" fields
  - ✅ (v0.6.14, v0.6.17, v0.6.18) Highlight dialog: clicking an item name opens a dialog with the item and its children and the table's functions; the chevron alone expands and collapses
  - ✅ (v0.6.13, v0.6.17 to v0.6.19) Budget tables (not Annual): the Actions menu is renamed "Edit" with Rename (moves the item to its right category, with a warning that it changes all historic records), Add/Subtract (Day: New purchase) and Delete (Day and Week only), each opening a dialog; Day purchase rows have an Edit button instead, opening one dialog with the Add purchase form prepopulated (`0009` §4.1)
  - ✅ (v0.6.21, v0.6.22) Backup and upload described in the help dialog
  - ✅ (v0.6.13, v0.6.19) Add/Subtract: Day has a New purchase button on category rows; purchases are edited in their own dialog and adds to or subtracts from an item's total in Week and Month, with a date picker limited to the viewed period (`0009` §4.1)
- ✅ (v0.6.15) Hover styling on buttons and links across the app (decided 2026-11-04)
- ✅ (v0.6.17) Week, Month and Annual amount columns at least wide enough for 222,222.99, in the tables and the highlight dialog (decided 2026-11-04)
- ✅ (v0.6.4) Refactor so each tab panel's header below the tab is visually hidden (still available to screen readers)
- ✅ (v0.6.8) Add addition and subtraction to the amount fields: typed expressions (decided 2026-11-04)
- ✅ (v0.6.9) Optional description field below Amount
- ✅ (v0.6.10) Charity takes purchases itself until it gets its first item; then its purchases move to Charity › Miscellaneous and Charity becomes a roll-up (`0009` §6)
- ✅ (v0.6.23 to v0.6.29) UI/UX for the upload flow
- ✅ (v0.6.33 to v0.6.35) ODS import: a valid ODS test file (LibreOffice) and the importer, using the `0013` rules (decided 2026-11-11). Accepted loss: about 1,100 merged-cell values in the test file, with a warning banner in the review
- ✅ (v0.6.20) Import also reads Week and Day sheets (`0013` §3 and §5; invented test files in `docs/test_sheets/`, because the human has no real ones)
- ✅ (v0.6.20, v0.6.23 to v0.6.29) Imported purchases whose date was not in the file are placed on the first day of their week (or month) and marked; the Day table shows a tooltip note on each one (decided 2026-11-11, `0013` §5)
- ~~Deep subcategory nesting~~ dropped 2026-11-08: the Category › Subcategory › Item model is already built (a subcategory that has items is a total row and takes no purchases; an item is the deepest level)
- ✅ (v0.6.30, v0.6.31) Add upload step to onboarding once it works
- ✅ (v0.6.20 to v0.6.29) Data import / export: build on the v0.2 JSON backup export/restore (`docs/audits/security/security-v0.2.md` 6.2; file-handling requirements in 1.1 and 2.2)
- ✅ UI/UX review (human approval, 2026-11-21)
- ✅ Accessibility pass (`docs/audits/a11y/a11y-v0.6.md`, v0.6.37): Lighthouse 100 in 37 states at 1280, 375 and 320px; six findings fixed (A1 to A6; A6 is the wizard step 3 group row, now a checkbox beside an Expander button, 2px apart by owner exception to the control-margin rule); screen reader test passed
- ✅ Security review (`docs/audits/security/security-v0.6.md`, approved 2026-11-21): the XLSX note loop (3.1, Low) and an out-of-sync parser install (7.1, Medium) fixed; no open finding of Medium or higher in v0.6 code → transition to v0.7.0. Carried to v0.7 (⚠ before any sync work): v0.2 5.4 (Medium, sync backend network configuration) and the sync-time items listed in the report; v0.2 5.1, 5.2 held till v0.9

## v0.7 — Sync, dialogs and table updates (complete, v0.7.0 to v0.7.67; review fixes in v0.8.0)
- ✅ (v0.7.28) Rewrite the supporting text under the tables, which is out of date (decide its final content first)
- ✅ (v0.7.19 to v0.7.25) Form field alignment class: adds the same space between a label and its control as appears when supporting (help) text sits between them, so fields shown side by side in columns line up in even rows (decided 2026-11-04)
- ✅ (v0.7.29) Negative purchases (refunds or credits, `0007` §9) are listed in the Day table as a return (decided 2026-11-04; the exact label and styling are decided when built)
- ✅ (v0.7.40 to v0.7.44) Input parsing for typed names: spell check and common abbreviations (e.g. "Misc." is tracked as "Miscellaneous") (decided 2026-11-04; the abbreviation list, where it runs and whether it corrects silently or asks are decided when built)
- ✅ (v0.7.40 to v0.7.44, reworked v0.7.52) Move subcategories and items between parents: a subcategory moved into another becomes an item; an item moved out of a subcategory becomes a subcategory (e.g. a user creates "Retirement" under Savings and places IRA, 401k and 403b inside it). Must be fully keyboard accessible. Moving a subcategory that has items into another subcategory is refused with an error message (decided 2026-11-04). Decided 2026-11-22: a Move column in the highlight dialog (Up, Down, and a "Move to" menu of categories and subcategories; a row moved to a new parent becomes its last child); purchases and the estimate move with the row
- ✅ (v0.7.41) Quarterly and Annual offered in every Recurrence drop-down, not only Debt, Utilities and Subscriptions (decided 2026-11-22)
- ✅ (v0.7.19 to v0.7.25) Maximum app width of 1440px (decided 2026-11-04; content stays centered; the v0.8 charts use it)
- ✅ (v0.7.27 to v0.7.39) Item column: a persistent minimum width of 250px in every table, growing so its content never wraps (decided 2026-11-04). Not sticky in any table (decided 2026-11-22: not enough room at 400px and narrower)
- ✅ (v0.7.1 to v0.7.3) Consolidate dialogs into one component (today three: form dialogs, confirm dialogs and a generic dialog); migrate the v0.6 dialogs (Edit menu, highlight, wizard) to it (decided 2026-11-04)
- ✅ (v0.7.19 to v0.7.25) Design standards pass: bring the app in line with the decided standards in `0012-design-standards.md` (decided 2026-11-08; the open gaps in its §10 are settled first)
- ✅ (v0.7.30, v0.7.52) Read-only copy of the Day table under the Add purchase form (decided 2026-11-08, from user feedback; placed in v0.7 per the new-item rule)
- ✅ (v0.7.35) Annual table: a Misc row under Incidentals and a Misc. Breakdown table under the Annual table, with a December review highlight (decided 2026-11-11; spec `0014`; placed in v0.7 under the new-item rule)
- ✅ (v0.7.66) Week and Day sheet import: regression test the import of Week and Day sheets, then find and fill the gaps (for example a week sheet and a day sheet that cover the same day are not checked against each other) (decided 2026-11-11)
- ✅ (v0.7.64, v0.7.65) Defect D004 (`docs/defects/`): Google sign-in fails in hardened Firefox; redirect sign-in (found 2026-11-22; a later v0.7 fix, step 15b, does not block the alpha launch)
- ✅ (v0.7.4 to v0.7.17) Sync to a Google Sheet (moved from v0.8, decided 2026-11-18): the spreadsheet is a remote copy of the budget, so the same budget can be used and updated on several devices. The user links an existing spreadsheet or the app creates one in their Google account. Google Sheets first; design in a new design doc before building (the design doc holds the spec; this item holds the scope)
  - StorageAdapter interface + Google Sheets adapter (assumed stable and easier than other options; reassess if Google Sheets proves otherwise)
  - Sheet layout and data shape: open. The earlier JSON-doc shape (version + updatedAt per record) must be reconciled with a sheet that people can read, decided in the design doc
  - Sync-on-open: pull then push, last-write-wins, tombstones
  - Optional passphrase client-side encryption (open: whether encrypted content in a shared sheet is acceptable)
  - Sync in the onboarding wizard as its first step ("Local only" or "Sync with Google"; New Budget / Existing Budget tabs; Existing skips the category steps); the pay-frequency step removed (set in Advanced options, whose placement is under review: see v0.8 "Help, wizard and Backup UX"); Sync button in the Budget tab panel beside the date controls; Backup back at the far right of the tabs; Budget setup "Estimated spending" renamed "Estimated amount" (decided 2026-11-22, step 3 UI review)
  - ~~Seed categories/table layout from the sheet's current layout~~ dropped 2026-11-21: categories already sync as records (`0015` Q5)
- ✅ (v0.7.55, v0.7.60) Defect D005 (`docs/defects/`): the Google file picker lists no files, so an existing sheet cannot be linked (found 2026-11-26 in phone testing; step 15c, before the reviews)
- ✅ (v0.7.48) Defect D006 (`docs/defects/`): the left ~15px of the Edit menu items is sometimes cut off in the highlight dialog (found 2026-11-26 in phone testing; step 15c, before the reviews)
- ✅ (v0.7.49 to v0.7.54) Tester feedback (logged 2026-11-26; built in v0.7, step 15d, human 2026-11-26: everything not marked "future feature" is built now):
  - New subcategory can be created under a category in the Add purchase flow, not only a new item under a subcategory
  - Choosing a subcategory that has items in the Add purchase Item list saves the purchase to that subcategory's Miscellaneous item; the Miscellaneous item is created if missing. A subcategory with no items still takes the purchase itself. (Table rule unchanged: a subcategory with items is a totals row only.)
  - Edit and delete on the Day table under the Add purchase form (tester-requested; replaces the read-only decision of v0.7 step 12, decided 2026-11-08). Built as the Day table's Update button (Actions item below)
  - Remove the Day view from the Budget screen, toggle included (Week, Month and Annual remain); the Day table stays under Add purchase
  - Actions and Update (decided 2026-11-26; replaces the Edit menu of `0009` §4 and the Move column of v0.7 step 11):
    - The "Edit" menu is renamed "Actions" and sits in the column that is the highlight dialog's "Move" column today; that column is renamed "Actions"
    - Week and Month: the Actions menu has two options, New purchase (unchanged) and Update
    - Day table (under Add purchase): an Update button on each purchase row
    - Update opens one dialog in every table: name, amount and the "Move to" drop-down
    - "Move to" lists categories and subcategories only
    - The Up and Down move buttons are removed
    - Annual has no Actions menu: it keeps only the pencil Rename (reason in `0009` §4; human, 2026-11-26)
    - Assumed (2026-11-26, see `docs/review-questions/2026-11-26-tester-feedback.md`): Delete becomes a button in the Update dialog; a Day purchase moved to a subcategory with items goes to its Miscellaneous item
  - Sort order (decided 2026-11-26): every table except Day lists Income, then Savings, then Expenses; subcategories alphabetical inside each category; items alphabetical inside each subcategory. The Day table is chronological. Replaces manual order (Budget setup reordering, `0007` §5; Up/Down, v0.7 step 11)
  - New chibi characters: cats and generic superheroes (rewards, `0008` §6, §7)
  - New reward animations: dance, fly, thumbs up, spin
  - Date navigation (Previous, title, Next) fills 100% of the width on mobile; today it is about 60% (decided 2026-11-26)
  - Media query audit: 3 in total, 4 accepted; any more than 4 needs a written reason (`0012`). Before: width breakpoints 600, 640, 1280 and 1440px plus a 480px height query
- ✅ (v0.7.57 to v0.7.59) UI updates (human, 2026-11-26; built in v0.7 under the same rule, step 15e):
  - The Week, Month and Annual buttons become a three-option Toggle (components.md Toggle: radio group, pill)
  - The Sync control moves into the Backup dialog (replaces the 2026-11-22 placement: Sync button in the Budget tab panel and beside the Screens button on narrow views) or into a new home decided in v0.8 ("Help, wizard and Backup UX", 2026-11-26: Import, Export, Backup and Sync do not fit well under "Backup")
  - The supporting text on the Add purchase screen moves into an info button to the right of each control's label. Mockup first, build only after the human approves (`docs/design/images/v0.7-info-buttons/`)
- ✅ (v0.7.61, v0.7.62) Update popup (human, 2026-11-26; step 15f): on the first open after an update, a popup lists what changed and any new known issues. Spec and the process for keeping it current: `0016-update-popup.md`. Mockup: `docs/design/images/v0.7-update-popup/`. The popup shows only the newest update; the latest 2 or 3 update lists are kept and readable again from a place still to be chosen (open; for example a "What's new" section in the Help dialog; logged 2026-11-26, see v0.8 "Help, wizard and Backup UX")
- ✅ UI/UX review (human approval, 2026-11-26)
- ✅ Accessibility pass (`docs/audits/a11y/a11y-v0.7.md`, v0.8.0): Lighthouse 100 in 24 states at 1280, 375 and 320px; one finding fixed (A1: Misc. Breakdown "Save for future" button names); scripted focus, reflow and text spacing checks pass; screen reader test of the new flows not recorded (version closed by the human 2026-11-27)
- ✅ Security review (`docs/audits/security/security-v0.7.md`, approved 2026-11-27): four Low findings fixed (3.1 restored record ids, 3.2 sheet size and notes cap, v0.5 3.2 stale Budget setup saves, 8.1 error text); v0.2 5.4 re-rated Low and closed; the sync items held since v0.2 and v0.3 closed; CSP loosening for Google (4.1, Low) approved by the human; local encryption (v0.2 6.6) will not be part of the app; no open finding of Medium or higher in v0.7 code → transition to v0.8.0. Carried: v0.2 5.1, 5.2, 4.4 held till v0.9 (host headers, `frame-ancestors`); v0.2 2.5, 4.5 for the v0.8 charts; v0.2 4.3 (add a format version row to the sheet before its first format change); Sheets API quota reviewed before a wider release

## v0.8 — Graphs and charts
- Charts moved from v0.7 (decided 2026-11-22). Sync moved to v0.7 earlier (decided 2026-11-18).
- Mobile-first layout: optimize the UI for 360 to 430px wide screens while keeping WCAG AA at 320px; desktop is secondary (human, 2026-11-26: "v0.8 or later"). Needs a design pass first: it touches the width breakpoints and the media query limit in `0012`
- Help, wizard and Backup UX (logged 2026-11-26; needs a design pass and mockup first):
  - Sync instructions in the Help dialog: how to use one budget sheet across several accounts or devices (for example share the Google sheet with the other account, or share the account password; the steps and which of the two is advised are open, with security in mind)
  - The onboarding wizard appears only on first launch, not when the Help dialog opens (the Help dialog may still offer a way to reopen it)
  - Store the latest 2 or 3 "What's new" update lists (`0016`, `src/updates/updates.json`) where users can read them again; place to be chosen (for example in the Help dialog)
  - "Advanced options" sits in an odd place (the wizard footer): decide a better home
  - Better UX for everything now under "Backup" (Import, Export, Backup and restore, Sync): these do not fit under one "Backup" name; decide the grouping, names and where each lives
- Chart view (Table/Chart switch)
- Compact rows: an option that makes table rows smaller (decided 2026-11-22)
- Zoom in and out (+/−) for the budget tables (decided 2026-11-22)
- Misc. Breakdown review threshold as a setting (default 6; fixed at 6 in v0.7, `0014` M4; decided 2026-11-22)
- Chart types for Budget screen (chart types and the library to decide; a new dependency needs the human's go-ahead; security v0.2 4.5, 2.5: Trusted Types, escaped item names in chart labels)
- UI/UX review (human approval)
- Accessibility pass for charts (alt text, keyboard nav, screen reader)
- Security review

## v0.9 — Distribution + polish
- Per-OS install instructions (web, Android, GrapheneOS)
- Android app (the PWA ships to Android as an APK; packaging approach to decide: Capacitor, TWA or other). Rules: global `android-release.md`
  - Signing: PKCS12 keystore in the git-ignored tools folder, generated password beside it; the human backs both up outside the machine (losing the key ends updates for the app ID)
  - Reproducible release build (two clean builds byte-identical), signed with `apksigner --alignment-preserved true --v4-signing-enabled false`; test the signature copy with `apksigcopier` before submitting
  - Until a store accepts the app: developer-signed APKs on GitHub Releases (same key, so users can update to the store build later)
- F-Droid submission: earliest 2027-01-25 (the project must be maintained for at least 3 months from its first commit, 2026-10-25; re-check the live policy before submitting). Decide before the first submission whether to use reproducible builds with developer signing (a one-way choice; recommended when the build is reproducible). Recipe in fdroiddata, `fdroid lint` and `fdroid rewritemeta` locally, categories from the live list, merge request titled "New app: Simple Budget", signed APK uploaded to the GitHub release first
- Google Play (optional): a new personal developer account must run a closed test with a minimum number of testers for a minimum number of days before production; check the current numbers on Play Console help and schedule the test period first
- Store listing text for the public at reading grade 10 or lower (`digital_accessibility.md`)
- Offline robustness + cache eviction handling
- UI/UX review (human approval)
- Final accessibility audit
- Security review

## Post v1.0
- Correct a single purchase's date (today: delete it and add it again; the amount moves to v0.6)
- Manual sort: design a good way for users to set their own row order, replacing the v0.8 alphabetical sort where they choose (future feature, logged 2026-11-26; needs design first)
- Receipt photo capture (camera API / Capacitor if needed)
- Daily end-of-day reminder: needs a delivery outside the web app (phone reminder, or Capacitor APK build with local notifications)

## Unscoped ideas (not in any version; each needs review before it can be scoped)
- Subscriptions table: a view of recurring subscriptions with state, billing day and cost (the human's spreadsheet has a " Subscriptions " sheet; logged 2026-11-11)
- Search purchases by name, date or amount (logged 2026-11-11, from the import review)
- Undo: up to 50 steps; the list of changes lasts until the app is closed (logged 2026-11-21, from the sync design)
- Popup listing all purchases of an item, to find a specific purchase in the Week and Month tables (a design question, logged 2026-11-11; see the highlight dialog in `0009` §3)
