# Security Review — v0.6 (NETWORKED matrix)

Scope: v0.6 at v0.6.36 plus the fixes made in this review (v0.6.37) — PWA (Vite + React + Dexie IndexedDB), no backend yet. Rated on the calibration of v0.1–v0.5 under `issue-severity-matrix_NETWORKED.md` (the matrix file sits outside the folders this review session can read, so the human confirms the ratings, 3.1 and 7.1 in particular). Domains per `security-domains.md`, ASVS 5.0.0 chapter names. Open items from earlier reviews are carried forward with their original IDs (prefixed `v0.2` to `v0.5`); new findings are numbered in this file. Approved by the human 2026-11-21.

## Summary

### Executive summary

All 8 domains reviewed. v0.6 added the first user-chosen file input that the app parses (CSV, XLSX and ODS import, with a review dialog and an all-or-nothing write), typed sums in amount fields, a purchase description, and a restructured Backup dialog and onboarding wizard. The review focused on the import readers (zip and XML handling, resource limits, formulas, text that reaches the screen and the database), the write path, the restore path for the new stored fields, the production CSP across every new flow, and the two new runtime dependencies.

One Low finding was found and fixed: the XLSX reader looped over every cell note once per row, so a 128 KB file with 40,000 notes froze the reader for 28 s (now 0.4 s, with a regression test). One Info finding was fixed (backup restore did not clean descriptions). One Medium was found and fixed: `package.json` and the lockfile pinned fast-xml-parser 5.12.0, but the installed copy in this checkout was 5.11.2, so a build from this checkout would have shipped the older parser (7.1; installed 5.12.0 with the human's approval, tests and build re-run). Everything else is Info. The production build reports no CSP violations or console errors in 111 browser states at three widths, and `npm audit --omit=dev` reports no advisories.

Totals (new): 1 Medium (fixed), 1 Low (fixed), 9 Info (8 fixed, 1 not fixed). Carried: nothing new is held; sync-related items move with the sync work from v0.8 to v0.7 (roadmap decision 2026-11-18).

### Summary table

| ID | Severity | CWE | Status | Issue |
| --- | --- | --- | --- | --- |
| 1.1 | Info | CWE-400, CWE-434 | Fixed | Import checks the file before and while reading it: 5 MB, extension, zip signature, 2,000 zip parts, 40 MB unzipped (never trusting stated sizes), 13 sheets, 5,000 rows, 256 columns, 300,000 cells and 500 characters per cell; 24 hostile files fail with a plain message and write nothing. |
| 2.1 | Info | CWE-79, CWE-776 | Fixed | Imported names and notes go through `cleanName` and `cleanDescription` and reach the screen as text only; formulas are never read or run, XML with a DOCTYPE or ENTITY is refused before parsing, and no HTML parsing or HTML-writing call exists anywhere in `src/`. |
| 3.1 | Low | CWE-407 | Fixed | The XLSX reader checked every cell note against every row, so work grew with rows times notes: a 128 KB file with 40,000 notes and 5,000 rows blocked the tab for 28 s (300,000 notes would take minutes). Notes are now grouped by row once (0.4 s), with a regression test. |
| 3.2 | Info | CWE-20 | Fixed | Restoring a backup kept each purchase description as stored, with control and bidirectional-override characters, while names were already cleaned; descriptions now get the same `cleanDescription` as typed and imported ones, with a regression test. |
| 3.3 | Info | CWE-20 | Not Fixed [informational: `createdAt`, `updatedAt` and `id` in a restored backup are not shape-checked, but they are only used to sort and to print a time, so a bad value shows "Invalid Date" and nothing else; checking them on read could hide old rows, so no check is added] | A restored backup file is checked for category, amount, date and description shape, but the purchase timestamps and id are copied through unchecked, so a hand-edited file can store a nonsense time. |
| 3.4 | Info | CWE-20 | Fixed | The import write re-checks every row it touches inside the transaction, refuses a plan with unplaced rows, validates each amount and date, and stops cleanly when another tab changed the data; typed sums (`12.50+3`) are parsed with a fixed pattern and no evaluator, with the 999,999,999.99 cap. |
| 4.1 | Info | — | Fixed | The production CSP reports no violation and the console no error or warning across wizard, import review, Backup, Add purchase, all four tables and every dialog, at 1280, 375 and 320px; v0.6 added no inline script, inline style, remote host or `connect-src` entry. |
| 6.1 | Info | CWE-20 | Fixed | New stored values (`description`, `undated`, the time taken from a day sheet) are unindexed so Dexie stays at v8, all pass the row shape checks, survive backup and restore, and nothing leaves the device: `src/` has no `fetch`, `XMLHttpRequest`, WebSocket or `sendBeacon` call. |
| 7.1 | Medium | CWE-1395 | Fixed | The parser that reads untrusted ODS and XLSX XML was out of sync in this checkout: `npm ls` reported 5.11.2 as invalid, so a build made here bundled the older version; now 5.12.0 as pinned. |
| 7.2 | Info | — | Fixed | The two runtime dependencies added in v0.6 are pinned exactly and are old enough: fflate 0.8.3 (published 2026-05-16) and fast-xml-parser 5.12.0 (2026-11-03, 18 days before this review; 5.12.1 is 8 days old and not used); `npm audit --omit=dev` finds 0 vulnerabilities. |
| 8.1 | Info | — | Fixed | Every import and restore failure says what is wrong and what to do ("Invalid: File unpacks to more than 40 MB…"); unexpected exceptions show one generic sentence with no stack, file name or internals, and `console.error` still logs only the error name and message. |
| v0.5 3.2 | Low | CWE-367 | Held till v0.7 | Onboarding Done and Budget setup Save write rows from a snapshot and check new names only in the UI; a second tab can cause a duplicate sibling name or overwritten fields. The import write (3.4) does re-check inside its transaction, the others are unchanged; merge rules belong to the sync step now in v0.7. |
| v0.5 4.3 | Info | CWE-770 | Not Fixed [informational: each reward makes one short-lived audio context, closed after 1.5 s; browsers cap open contexts, but creation sits in try/catch so a refusal only means no sound; unchanged in v0.6] | Every reward creates a new `AudioContext`; many rapid saves could reach the browser's limit on open audio contexts, in which case the sound is skipped and the image still shows. |
| v0.4 7.1 | Info | — | Not Fixed [informational: after a successful rename `focusAfter.current!` is always set by `closeRow` on the line before, so the non-null assertion cannot fail today; keep that order in refactors] | v0.4 added one guarded non-null assertion in `commitRename` (`src/components/BudgetTable.tsx`), the same pattern as v0.2 7.5 and v0.3 7.1, which the type system cannot see. |
| v0.3 6.2, v0.2 1.3, 2.4, 3.7, 4.3, 4.4, 6.6, 6.7, 7.7, 8.8 | Info / Medium | see v0.2, v0.3 | Held till v0.7 | Sync-time requirements (tombstones, server file checks, synced value allowlists, read checks, service worker takeover, frame-ancestors, encryption, ids, server logging) are unchanged by v0.6 and move to v0.7 with the sync item (roadmap, 2026-11-18). |
| v0.2 2.3 | Info | CWE-1236 | Held till v0.7 | Formula injection into the sync spreadsheet: imported descriptions are cleaned text but may start with `=`, `+`, `-` or `@`, so the v0.7 sync must neutralize them (and typed ones) before writing cells. |
| v0.2 5.4 | Medium | CWE-306, CWE-942, CWE-770, CWE-209 | Held till v0.7 ⚠ REQUIRES REVIEW BEFORE PROCEEDING | Sync backend network configuration (auth, CORS, rate and body limits, error leakage) must be reviewed and re-rated before any v0.7 sync work starts; v0.6 added no network code. |
| v0.2 1.1 | Info | CWE-400, CWE-434 | Fixed | The v0.2 requirement for upload limits and type checks on the first parsed file input is met by the CSV, XLSX and ODS import. |
| v0.2 2.2 | Info | CWE-79 | Not Fixed [informational: v0.6 reads CSV, XLSX and ODS only; no HTML is parsed or inserted anywhere (no DOMParser, innerHTML or similar), so the requirement has nothing to apply to unless an HTML import is scoped later] | HTML bank statements were once planned for import and had to be parsed into an inert document; the import format changed and no HTML import exists. |
| v0.2 4.5, 2.5 | Info | CWE-79 | Held till v0.7 | Trusted Types in the CSP and escaped item names in chart labels remain requirements for the v0.7 chart libraries; v0.6 added no chart and no HTML-producing code. |
| v0.2 5.1, 5.2 | Medium | CWE-1021, CWE-693, CWE-319 | Held till v0.9 | The static host chosen for distribution must send the security headers and serve only over HTTPS with HSTS; v0.6 changed no hosting or build configuration. |
| v0.2 7.1 | Low | CWE-1395 | Not Fixed [rechecked 2026-11-21: `npm audit` lists 4 moderate advisories (glob, minimatch, workbox-build, vite-plugin-pwa) with the fix only in a breaking downgrade; all are build-time and none of this code ships in dist] | `npm audit` reports 4 build-time advisories in the PWA plugin's dependency chain (down from 10 in v0.5); the shipped runtime has zero advisories. |
| v0.2 1.2 | Info | — | Held till post-v1 | Receipt photos need size limits, a content check and EXIF/GPS removal before storage; unchanged because v0.6 added no camera or image handling. |
| v0.3 7.1, v0.2 7.4, 7.5, 7.6 | Info | — | Not Fixed [informational, unchanged: earlier guards cover the assertions, the lockfile pins versions, and the private package name has no security effect] | Guarded non-null assertions, caret ranges in `package.json` and the template package name `scaffold` are noted for later cleanup; none affects the shipped app. |

## Domain 1 - File Handling

### 1.1 — Import file limits (Info, Fixed)

CWE-400, CWE-434. Covers v0.2 1.1. The checks, in the order they run (`src/import/index.ts`, `zip.ts`, `grid.ts`, `csv.ts`):

| Check | Limit | Where |
| --- | --- | --- |
| File size | 5 MB | `readImportFile` |
| Type | `.csv`, `.xlsx`, `.ods` by extension; XLSX and ODS must start with the zip signature; CSV must not (zip signature or a NUL byte is refused); ODS `mimetype` entry must be the ODS type | `readImportFile`, `readOds` |
| Zip parts | 2,000; password-protected and zip64 files refused; parts that are neither stored nor deflated are skipped | `Zip` |
| Unzipped size | 40 MB in total, counted while inflating in 4 KB steps; stated sizes are never trusted | `Zip.text` |
| Sheets, rows, columns | 13, 5,000, 256 | readers |
| Cells | 300,000 across the workbook | `CellBudget` |
| Text per cell, sheet name | 500 characters | readers |
| Repeat counts (ODS) | 2^24 at most; a bad count is a damaged file | `repeat` |

Nothing is extracted to disk, so zip paths cannot escape anywhere. Reading runs on the main thread. Measured in Node: a file that unzips to about 34 MB of XML reads in 0.6 s (XLSX and ODS); a 200 MB zip bomb is stopped at 40 MB in about 150 ms; deeply nested ODS spans (1,000 to 100,000 levels) are refused as damaged in under 20 ms.

Tests (`npm run test:import`, 288 checks): 24 hostile or malformed files (zip bombs, 14 sheets, entity expansion, truncated, garbage, huge, unclosed quote, no budget sheet, too many rows or columns, bad repeat counts, wrong type, missing mimetype, password-protected XLSX and ODS, wrong extension, fake XLSX) each fail with "Invalid: …", and the database is unchanged afterwards. The two password-protected files were added in this review.

## Domain 2 - Encoding and Sanitization

### 2.1 — Imported text and formulas (Info, Fixed)

CWE-79, CWE-776. `grep` of `src/` for `innerHTML`, `dangerouslySetInnerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`, `DOMParser`, `createObjectURL`: only `createObjectURL` in the backup download (`Backup.tsx`, revoked right after the click). `setAttribute` appears only in `announcer.ts` with fixed role and aria values.

- Row and item names from a file go through `importName` then `cleanName` (NFC, control and format characters removed, spaces collapsed, 60 characters). Cell notes become descriptions through `cleanDescription` (120 characters). Sheet names, file names and error text reach the page as JSX text or `textContent`.
- Formulas: the XLSX reader reads `<v>` values only (never `<f>`); the ODS reader never reads `table:formula`. Text such as `=1+2` or `+5` in an amount cell is not evaluated: `parseAmount` returns "bad", the cell is skipped and a warning names it (tests: XLSX, ODS and CSV formula files).
- XML: both readers refuse any part that contains `<!DOCTYPE` or `<!ENTITY` before parsing, and the parser runs with `htmlEntities: false` and no value parsing.
- Cleaned descriptions keep a leading `=`, `+`, `-` or `@`; v0.2 2.3 (sync) must neutralize them.

## Domain 3 - Validation and Business Logic

### 3.1 — Quadratic work on XLSX cell notes (Low, Fixed)

CWE-407. `readXlsx` (`src/import/xlsx.ts`) looped over every note of the sheet inside the loop over every row (and ran the cell-reference pattern on each), so time grew with rows times notes, while the 40 MB unzip limit allows about 800,000 notes. Measured before the fix (rows 5,000): 5,000 notes 2.0 s, 20,000 notes 10.9 s, 40,000 notes 27.9 s (a 128 KB file). Impact: the tab freezes until the browser offers to stop the page; nothing is written and the person chose the file, which is why this is Low. Fix: notes are grouped by row once (`notesByRow`), each row reads only its own, and notes on rows with no cells keep one pass. After: 0.2 s, 0.3 s, 0.4 s. Regression check: `40000 notes on 5000 rows read in … ms (limit 5000 ms)` (`tests/import/node-checks.ts`, fixture `manyNotesXlsx`). Side effect: a row with no cells but several notes now keeps all of them (it kept only the first before).

### 3.2 — Restore did not clean descriptions (Info, Fixed)

CWE-20. `checkBackup` (`src/storage/repository.ts`) accepted a description of up to 120 characters as is, so a hand-edited backup could store control characters or a right-to-left override that typed and imported text cannot. It is shown as text only, so there was no injection. Descriptions now go through `cleanDescription` and an empty result is dropped. Check: `restore cleans descriptions…` (`tests/import/db-checks.ts`).

### 3.3 — Backup timestamps and id unchecked (Info, Not Fixed)

CWE-20. `validItem` checks category, amount, date, description and `undated`, but not `id`, `createdAt` or `updatedAt`. `createdAt` is used in two places only (`BudgetTable.tsx`: sort order and the "Purchase, 5:26 PM" label), so a bad value prints "Invalid Date". A bad `id` fails the restore transaction, which is all-or-nothing and tells the person their data was not changed. Adding the check to `validItem` would also drop stored rows that lack a timestamp when they are read.

### 3.4 — Import write and typed sums (Info, Fixed)

CWE-20. `applyImport` runs in one transaction: it refuses a plan that still has `unplaced` rows, re-reads the tree and fails with "File changed in another tab while the preview was open" if any row it names is gone, requires each amount to be a finite number within the cap and each date to be `YYYY-MM-DD`, bounds a day sheet's minutes to 0–1,439, and writes categories parents-first. Tests cover the stale preview, rows without a place, every hostile file leaving the data unchanged, and a repeat of the same file after a failed write. `parseAmount` (`src/budget/validate.ts`) accepts digits, `.`, `,`, `+` and `-` by pattern, adds in whole cents and applies the same range check; no evaluator.

## Domain 4 - Web Frontend Security

### 4.1 — CSP across new flows (Info, Fixed)

The production build (`vite preview`, CSP from `vite.config.ts`: `script-src 'self'`, `style-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `form-action 'none'`) was driven in headless Chromium with a `securitypolicyviolation` listener and console capture through 37 states at 1280, 375 and 320px (wizard, import review, Backup, Add purchase, all four tables, Edit, highlight, Rename, Budget setup): no violations, no console error or warning. `vite.config.ts` and `index.html` were read in full: no remote host, no `unsafe-*` source. The file input only offers an `accept` hint; the type is enforced in code (1.1).

## Domain 5 - Configuration

**No new findings.** `vite.config.ts` (CSP, PWA plugin) and `index.html` were read in full: the CSP lists only `'self'` sources (plus `data:` for images), `object-src 'none'` and `form-action 'none'`, and v0.6 needed no new directive. v0.2 5.1, 5.2 and 5.4 stay held.

## Domain 6 - Data Protection

### 6.1 — New stored values (Info, Fixed)

CWE-20. v0.6 stores `BudgetItem.description`, `BudgetItem.undated`, a `createdAt` taken from a day sheet's time, and `Settings.onboarded` (unchanged from v0.5). None is indexed, so `db.ts` is still at version 8. `validItem` checks description length and the `undated` type on every read, `checkBackup` carries both through restore (the harness checks that every imported purchase and mark survives a backup round trip), and the settings row is still rebuilt through `cleanSettings`. No data leaves the device: `grep` for `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` in `src/`: 0 matches. localStorage use is unchanged (collapsed rows, "Got it" notice).

## Domain 7 - Secure Coding and Architecture

### 7.1 — Parser out of sync in this checkout (Medium, Fixed)

CWE-1395. `package.json` and `package-lock.json` pin `fast-xml-parser` 5.12.0 (upgraded in v0.6.23 for GHSA-474x-hrwr-fgx4, approved 2026-11-11). `npm ls` in this checkout reports "fast-xml-parser@5.11.2 invalid" and `node_modules/fast-xml-parser/package.json` says 5.11.2, so the tests and builds run in this review used 5.11.2. A clean install from the lockfile is right; a release built from this folder as it is would not be. This is the parser that reads untrusted XML from imported files, hence Medium. Fixed 2026-11-21 with the human's approval: `npm install --save-exact fast-xml-parser@5.12.0` (this one package; `package.json` and the lockfile did not change). `npm ls fast-xml-parser` shows 5.12.0; lint, `npm run test:import` (288 passed) and `npm run build` pass.

### 7.2 — New dependencies (Info, Fixed)

`fflate` 0.8.3 and `fast-xml-parser` 5.12.0 are exact pins (the import test harness also uses `fake-indexeddb` 6.2.6, a dev dependency, exact). Registry dates: fflate 0.8.3 on 2026-05-16, fast-xml-parser 5.12.0 on 2026-11-03 (18 days; the two-week rule holds). `npm audit --omit=dev`: 0 vulnerabilities. `npm audit`: 4 moderate, all dev-only (v0.2 7.1). Storage is still reached only through `src/storage/repository.ts`; the import module reads through `categoryRepo` and `budgetItemRepo` and writes through `applyImport`.

## Domain 8 - Security Logging and Error Handling

### 8.1 — Import and restore messages (Info, Fixed)

`ImportError` texts are full sentences with the cause and the next step, shown after "Invalid:" (`ImportSection.tsx`); a write failure shows "Error: The import couldn’t be saved. Your existing data was not changed."; a restore failure shows "Error: The backup couldn’t be restored. Your existing data was not changed."; any other exception while reading shows one generic sentence. Messages go through the single live region. `console.error` appears in three places and logs only the error name and message (`main.tsx`, `ErrorBoundary.tsx`, `AddBudget.tsx`).

## Method notes

- Commands: `npm run test:import` (288 checks, fake-indexeddb), `npm run build`, `npm run lint`, `npm audit` with and without `--omit=dev`, `npm ls`, `npm view … time`.
- Timing scripts for 3.1 and the 34 MB and nested-XML cases ran in the session scratchpad, not in the repository; the 3.1 case is kept as a regression check in the harness.
- Browser checks used the same production build and scripts as `a11y-v0.6.md`.
