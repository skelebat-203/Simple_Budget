# Security Review — v0.2 (LOCAL matrix)

Scope: v0.2 — local PWA (Vite + React + Dexie IndexedDB); no backend, no network exposure yet (sync planned v0.4). Rated under `issue-severity-matrix_LOCAL.md` (local threat model: hostile/malformed input, no remote attacker). Domains per `security-domains.md` (OWASP ASVS chapter names; domain numbers permanent).

## Domain 1 - File Handling

No file upload surface exists in v0.2. Verified by searching `src/` for `<input type="file">`, `FileReader`, `Blob`, `URL.createObjectURL`, `FormData`, and upload endpoints: none present — only text/checkbox `<input>` elements and static assets (`public/favicon.svg`, `public/icons.svg`). IndexedDB (`dexie` tables `budgetItems`, `categories`, `settings`) stores only structured primitives (strings, numbers, booleans); no user files are written or read. No import/export features exist in v0.2. MIME/magic-byte validation, size/count caps, and filename sanitization are therefore N/A for this version.

**Domain 1 complete — no findings.** No CWE applies (no finding).
