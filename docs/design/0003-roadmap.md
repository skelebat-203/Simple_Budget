# Roadmap

## v0.1 — Web PWA foundation
- Scaffold project (React + TS, Vite, PWA plugin)
- Plain CSS design tokens (colors, spacing, typography)
- In-house UI components: button, input, dropdown-with-search, date picker, amount input, checkbox group
- IndexedDB storage via Dexie + repository layer
- Add flow (dropdown search, date picker default today, amount required, save)
- Budget screen skeleton (table view, Day/Week toggles)
- PWA manifest + service worker (offline cache)
- Security review

## v0.2 — Finalize UI/UX
- Finalize color tokens and theme (primary brown placeholder → brand colors)
- Finalize category model and seed data
- Table design and structure (columns, sorting, grouping)
- Form validation (required fields, amount parsing)
- Accessibility pass (keyboard nav, ARIA, contrast)
- Security review

## v0.3 — Edit/Delete + Categories
- Edit flow (matching items checkbox group, "New value" inputs, save)
- Delete flow (matching items checkbox group, save)
- Categories CRUD (create/rename/delete/list)
- Search/filter dropdown shared component reuse
- Security review

## v0.4 — Budget views + rewards/settings
- Budget screen: Month/Year/Historic toggles
- Rewards animation + settings toggle (rewardsEnabled)
- Notifications toggle (notificationsEnabled)
- Security review

## v0.5 — Graphs and charts
- Chart view (Table/Chart switch)
- Chart types for Budget screen
- Accessibility pass for charts (alt text, keyboard nav, screen reader)
- Security review

## v0.6 — Sync
- StorageAdapter interface + OnlyOffice adapter
- JSON-doc storage shape (version + updatedAt per record)
- Sync-on-open: pull then push, last-write-wins, tombstones
- Optional passphrase client-side encryption
- Seed categories/table layout from OnlyOffice sheet
- Security review

## v0.7 — Distribution + polish
- Per-OS install instructions (web, Android, GrapheneOS)
- Offline robustness + cache eviction handling
- Final accessibility audit
- Security review

## Post v1.0
- Receipt photo capture (camera API / Capacitor if needed)
- Capacitor APK build (if native notifications required)
