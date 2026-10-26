# Security Review — v0.1 (NETWORKED matrix)

Scope: v0.1 Web PWA foundation (scaffold, CSS tokens, UI components, IndexedDB storage + repository, Add flow, Budget skeleton, PWA manifest/SW). App will be networked (sync in v0.4); rated under the NETWORKED matrix. npm audit: 0 vulnerabilities.

## Domain 2 — Encoding and Sanitization
- No `dangerouslySetInnerHTML` or raw HTML injection. React escapes text output. **No findings.**

## Domain 3 — Validation and Business Logic
- 3.1 `AmountInput`/Add flow: `Number(amount)` can yield `NaN`/`Infinity` for malformed input; no guard. Severity: Medium. Status: fixed — guard with `Number.isFinite` + required check.
- 3.2 Add flow save button disabled when `!name || !amount`, but amount like "abc" passes the truthy check. Covered by 3.1 (fixed).

## Domain 4 — Web Frontend Security
- Object URLs / link `rel`: none used in v0.1. **No findings.**

## Domain 5 — Configuration (network-facing)
- PWA manifest + SW: precache app shell only; no secrets. CORS/proxy/request-body-limits/rate-limiting/auth are N/A for the client-only v0.1 (no backend). These must be reviewed when sync (v0.4) lands. **No findings for v0.1.**

## Domain 6 — Data Protection
- IndexedDB stores budget data in plaintext (expected for local v0.1; encryption deferred to v0.4 sync). **No action for v0.1.**

## Domain 7 — Secure Coding and Architecture
- Lockfile present; deps minimal. **No findings.**

## Domain 8 — Security Logging and Error Handling
- Repository/storage errors are not surfaced to the user (unhandled promise rejections possible). Severity: Medium. Status: fixed — user-facing error message in Add flow; errors logged via console.error.

## Summary
2 Medium findings (3.1/3.2, 8.1) — both fixed in this pass. No Critical/High. No NETWORK-ONLY items introduced. Network-facing concerns deferred to v0.4 sync review.
