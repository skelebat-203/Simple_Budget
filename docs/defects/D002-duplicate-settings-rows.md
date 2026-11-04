# D002 — A fresh database can end up with two settings rows

- Found: 2026-11-03, while testing v0.5 on an empty database (rows with id 1 and 2, identical values).
- Severity: Low (the app always reads and updates the first row; the second is unused).
- What happens: on first load `settingsRepo.get()` is called more than once at the same time (React StrictMode runs the load effect twice, and Budget setup reads settings too). Each call finds no row and adds one.
- Fix: create the default row inside one transaction that re-checks for an existing row (or use a fixed id), and ignore extra rows on restore.
- Files: `src/storage/repository.ts` (`settingsRepo.get`), restore in `checkBackup` (keeps one row already).
- Scheduled: v0.6.
