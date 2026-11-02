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

## v0.2 — Category model, estimates, Day table (in progress)
- Category hierarchy model + seed data (full tree from `0004-table-design.md`, each with a color)
- `BudgetItem` gains `estimate`, `frequency`, `dueDate`, `autopay`; add flow asks for estimated spend + frequency
- Day table view (Est./Act. columns, only rows with amounts, category grouping)
- Form validation (required fields, amount parsing)
- UI/UX review (human approval)
- Accessibility pass
- Security review
## v0.3 — Edit/Delete + Categories CRUD
- Edit flow (matching items checkbox group, "New value" inputs, save)
- Delete flow (matching items checkbox group, save)
- Categories CRUD on the hierarchy (create/rename/delete/list, add subcategories)
- `dueDate`/`autopay` display + editing on items
- Search/filter dropdown shared component reuse
- Audit categories and items for repeated or ambiguous names (e.g. Car, Miscellaneous, Medical) and design a way to remove the ambiguity; resolve amounts flagged for review by the v6 upgrade (`docs/audits/security/security-v0.2.md` 3.1)
- Design updates per `0007-v0.3-design-updates.md` (plan of action made when v0.3 starts):
  - Calendar settings: week start, month boundaries (0007 §1)
  - Category structure: Income group, subcategories under Income/Savings/Expenses, calculated subcategory estimates (0007 §2)
  - Recurrence for all items; Quarterly/Annual for Debt, Utilities, Subscriptions; estimate scaling (0007 §3)
  - Add form: remove estimate fields; selected-items list; new item/subcategory flow with "Use in future" (0007 §4)
  - Budget setup overlay redesign: combined table, reordering, preview table, Save/Cancel (0007 §5)
  - Tab navigation: Add budget item / Budget (0007 §6)
  - Day (actuals only) and Annual tables (0007 §7)
- UI/UX review (human approval)
- Accessibility pass
- Security review

## v0.4 — Week/Month/Year + navigation
- Week/Month/Year table views (date-spanning columns, per-period Est./Act.)
- Historical navigation (prev/next date range)
- Estimate scaling math: replace day-based scaling (monthly ÷ 30.44 × days) so monthly-style estimates show the typed amount per month (`docs/audits/security/security-v0.2.md` 3.4)
- Estimate toggle (default on)
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
- Receipt photo capture (camera API / Capacitor if needed)
- Capacitor APK build (if native notifications required)