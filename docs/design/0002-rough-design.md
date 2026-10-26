# Rough Design

Companion to `0001-initial-requirements.md`. High-level architecture and stack recommendations for a single-codebase budget app targeting Web, Android, and GrapheneOS.

## Stack

- **Framework**: React + TypeScript (web-first, single codebase).
- **Mobile packaging**: PWA for v1 (no cert, instant updates). Capacitor/APK deferred (needed later for reliable local notifications).
- **Styling**: Plain CSS with CSS variables. UI built in-house (no component kit) for full accessibility control.
- **Core principle**: Generalize, reuse, reduce (components, classes, functions, methods).
- **State**: IndexedDB via Dexie (web) for persistence. No backend required for v1 (sync via adapter).
- **Charts**: A lightweight lib (e.g. Recharts or Chart.js) for the Budget screen.
- **Dates**: A small date library (date-fns or dayjs).

## Data Model (local)

- `BudgetItem`: id, name, category, type (income/savings/expense), amount, date, createdAt, updatedAt.
- `Category`: id, name, color (CRUD: create/rename/delete/list).
- `Settings`: rewardsEnabled (bool), notificationsEnabled (bool), theme, etc.
- Storage behind a repository interface; backend swappable (IndexedDB vs SQLite) without touching UI.
- Sync: shared-account adapter (vendor-agnostic); OnlyOffice for testing + seed data. Timestamped records, sync-on-open (pull then push), last-write-wins per item. Dropped device-stored sync-on-open.

## Architecture

- Single SPA with two screens: Update Budget, Budget (per requirements).
- Routing: client-side (React Router), with deep links for install flows.
- Components organized by screen + shared UI (dropdown-with-search, date picker, amount input, checkbox group, reward animation).
- Business logic in pure functions (filtering, matching, aggregation) for testability.
- Storage behind a repository interface; UI never touches storage directly.

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
