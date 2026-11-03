# Rough Design

Companion to `0001-initial-requirements.md`. High-level architecture and stack recommendations for a single-codebase budget app targeting Web, Android, and GrapheneOS.

## Stack

- **Framework**: React + TypeScript (web-first, single codebase).
- **Mobile packaging**: PWA for v1 (no cert, instant updates). Capacitor/APK deferred (needed later for reliable local notifications).
- **Styling**: Plain CSS with CSS variables. UI built in-house (no component kit) for full accessibility control.
- **Core principle**: Generalize, reuse, reduce (components, classes, functions, methods).
- **Mobile-first**: Design and implement mobile-first; single-column centered forms; touch targets ≥44px; responsive reflow at 320/640px.
- **State**: IndexedDB via Dexie (web) for persistence. No backend required for v1 (sync via adapter).
- **Charts**: A lightweight lib (e.g. Recharts or Chart.js) for the Budget screen.
- **Dates**: A small date library (date-fns or dayjs).

## Data Model (local)

- `BudgetItem` (one recorded amount): id, **categoryId**, amount (negative = credit), date, createdAt, updatedAt. Linked by id because names repeat across the tree (Car, Miscellaneous).
- `Category` (any tree node: category, subcategory or item): id, name, color, **parentId** (tree), **computed** flag, **selected** (Budget setup), **estimate**, **frequency**, **autopay**, **dueDate** (CRUD: create/rename/delete/list). Estimate fields describe the item, not a single amount.
- `Settings`: rewardsEnabled (bool), notificationsEnabled (bool), **defaultRange** (day/week/month), theme, etc.
- Storage behind a repository interface; backend swappable (IndexedDB vs SQLite) without touching UI.
- Sync: shared-account adapter (vendor-agnostic); OnlyOffice for testing + seed data. Adapter interface `{ read, write, list, delete }`. Storage shape: one JSON doc per dataset with top-level `version` and per-record `updatedAt`. Sync-on-open = pull then push, last-write-wins per record. Soft-delete tombstones. Optional passphrase client-side encryption before upload. Dropped device-stored sync-on-open.

## Architecture

- Single SPA with two screens: Update Budget, Budget (per requirements).
- Routing: client-side (React Router), with deep links for install flows.
- Components organized by screen + shared UI (dropdown-with-search, date picker, amount input, checkbox group, reward animation).
- Business logic in pure functions (filtering, matching, aggregation) for testability.
- Storage behind a repository interface; UI never touches storage directly.

## UI/UX Design Rules

- **Mobile-first**: design for small screens first, then scale up.
- **Form layout**: form content centered and single column; no multi-column form layouts; validation inline with focus management per `digital_accessibility.md`.
- **Table structure**: follows `docs/design/0004-table-design.md` (Day/Week/Month/Annual layouts, indents 0/1/2, colors by category, computed rows, only rows with amounts, category grouping).
- **No inline `style` attributes**: use reusable CSS classes.
- **Combined Item control**: single "Item" control replacing name + type, with autocomplete/filtering; categories larger/bold, subcategories bold, items normal; color coding; ordered category→subcategory→alpha.
- **Negative amounts allowed** (credits).
- **Separate estimate flow**: "Set estimates" button → "Budget setup" overlay (checkbox group, create inputs, expander table with Item name / Estimated spending / Recurrence / Autopay; recurrence only income/debt/utilities/subscriptions; autopay for debt/utilities/subscriptions; Charity exception).
- **Bi-monthly = twice a month**.
- **Prototype**: `docs/design/0006-prototype.html` is the clickable reference for the v0.2 UI (open it in a browser).
- **UI/UX review gate**: human UI/UX approval precedes every accessibility pass (per `docs/design/0005-ui-ux-review-checklist.md`).

## Reward System

- A toggleable "cute reward" on save (confetti/animation + optional sound).
- Controlled by `Settings.rewardsEnabled`; defaults on; one setting turns it off globally.

## Distribution (no cert)

- **Web**: hosted static site (PWA) with install prompt.
- **Android/GrapheneOS**: sideloadable APK built via Capacitor (unsigned/debug build acceptable for personal use) OR install the PWA via a browser. Include per-OS install instructions in `docs/` (GrapheneOS: install via F-Droid/Aurora or sideload APK with "install unknown apps" enabled).

## Phased Roadmap (rough)

1. v0.0: Initial design
2. v0.1: Web PWA, Add flow, local storage, Budget screen (table).
3. v0.2: Edit/Delete flows, search/filter dropdown, date picker.
4. v0.3: Rewards + settings toggle, chart view.
5. v0.4: Capacitor Android build + install docs for Android/GrapheneOS.
6. v0.5: Polish, accessibility, offline robustness.

## Open Questions

- Reward animation style preference (held).
- Sync conflict resolution (timestamps / last-write-wins) and adapter auth flow.
- Sync data format (JSON/CSV) and encryption approach.
- Whether PWA notifications suffice or Capacitor needed for daily reminder.
- Receipt photo capture feasibility (post-v1).
