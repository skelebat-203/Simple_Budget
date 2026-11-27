# Security Review — v0.7 (NETWORKED matrix)

Scope: v0.7 at v0.7.67 plus the fixes made in this review (released in v0.8.0). PWA (Vite + React + Dexie IndexedDB) with browser-only sync to a Google Sheet. Rated on the calibration of v0.1–v0.6 under `issue-severity-matrix_NETWORKED.md` (the matrix file sits outside the folders this review session can read, as in v0.6, so the human confirms the ratings, 4.1, 3.1, 3.2 and v0.5 3.2 in particular). Domains per `security-domains.md`, ASVS 5.0.0 chapter names. Open items from earlier reviews keep their original IDs (prefixed `v0.2` to `v0.5`); new findings are numbered in this file. Run 2026-11-27; approved by the human 2026-11-27.

## Summary

### Executive summary

All 8 domains reviewed. v0.7 added the first network code: Google sign-in (pop-up and redirect), the Sheets API and the Google Picker, passcode encryption of every synced record, a merge engine that treats every pulled row as untrusted, the first Content-Security-Policy loosening, a GitHub Pages deployment, moving rows between parents, name abbreviation parsing, the Annual Misc. Breakdown and an update popup. The review read the sync code in full (`src/storage/sync/`, the sync components, the CSP in `vite.config.ts`, the Pages workflow), the restore and setup write paths, and ran the three test suites and `npm audit`.

Four Low findings were found and fixed: a restored backup could carry any record id, which becomes a row id in the shared sheet (3.1); a sheet with a huge number of rows, or thousands of damaged rows, could freeze the app and fill the screen with notes (3.2); Budget setup and the wizard wrote from a stale snapshot and could overwrite a change made by another tab or by a sync (v0.5 3.2, held since v0.5); and sync dialogs showed the text of any error, not only the app's own messages (8.1). One Low is not fixed by decision: the CSP now allows inline styles and the whole `apis.google.com` host (4.1). The v0.2 5.4 network review is closed at Low: the mitigations in `0015` §7.1 are in the code and tested. The sync items held since v0.2 are closed. Held for hosting (v0.9): security headers on the static host, and `frame-ancestors`. Human decisions 2026-11-27: the CSP risk (4.1) is approved, and local encryption is not part of the app (v0.2 6.6).

Totals (new): 3 Low fixed (3.1, 3.2, 8.1), 1 Low not fixed by decision (4.1), 13 Info (3.3, 4.3, 5.1, 5.2, 5.3 and 6.2 are not fixed, each with its reason; the rest are fixed). Carried: v0.5 3.2 (Low) fixed, v0.2 5.4 closed at Low, the sync items from v0.2 and v0.3 fixed, 6 items held (v0.2 6.6, 4.3, 4.4, 5.1, 5.2, 2.5/4.5). `npm audit --omit=dev` reports 0 advisories. The production build reports no CSP violation or console error in 72 browser states at three widths (`a11y-v0.7.md`). Tests after the fixes: import 338, sync 63, dialogs 127, all passing.

### Summary table

| ID | Severity | CWE | Status | Issue |
| --- | --- | --- | --- | --- |
| 1.1 | Info | CWE-400, CWE-434 | Fixed | Import file limits are unchanged from v0.6 (5 MB, zip and cell caps, 24 hostile files); v0.7 only added a warning for overlapping Week and Day sheets and 44 more checks, with no new file reading code. |
| 2.1 | Info | CWE-79, CWE-1236 | Fixed | No HTML-producing call exists in `src/`; synced cells are written RAW and any text starting with = + - or @ gets a leading apostrophe; pulled names and descriptions pass `cleanName` and `cleanDescription`; the update popup renders fixed JSON as text. |
| 3.1 | Low | CWE-20 | Fixed | A restored backup kept any `uid` string on categories and purchases, including very long, odd-character or repeated ones; these become row ids in the shared sheet, so one bad id made that record fail on every device that pulled it. |
| 3.2 | Low | CWE-770 | Fixed | The sync read had no cap on rows, and every damaged row added a note shown as a list item, so a sheet with hundreds of thousands of rows (written by anyone it was shared with, no passcode needed) could freeze or crash the app on every sync. |
| 3.3 | Info | CWE-345 | Not Fixed [by design (0015 Q4): the id, updatedAt and deleted columns stay plain so devices can match and merge rows; the content cannot be forged without the passcode, so the worst case is a person with edit access hiding or reverting records] | The plain `updatedAt` and `deleted` columns are not tied to the encrypted content, so someone with edit access to the sheet can mark rows deleted or change times; the encrypted content itself fails to decrypt if changed. |
| 3.4 | Info | CWE-20 | Fixed | Every pulled row is decrypted (AES-GCM, bound to its tab and id), then checked like an import: color pattern, money range, enum frequency, date shape, 24 hours of clock skew, depth and loop checks inside the write transaction, and sibling name clashes renamed with a note. |
| 4.1 | Low | CWE-79, CWE-1021 | Not Fixed [risk approved by the human 2026-11-27: needed for sync to work in browsers with strict security (D005, `0015` §7.1); Google's Picker adds inline styles and scripts stay limited to exact hosts] | The CSP now allows inline styles and the full `apis.google.com` host for scripts; an injected style could restyle the page (hide or fake controls), and a script on that host that could be reached from a script-injection bug would run. No injection point exists today. |
| 4.2 | Info | CWE-352, CWE-598 | Fixed | The redirect sign-in (token in the address fragment) checks a random `state` kept in sessionStorage, removes the fragment, keeps the token in memory only and forgets the pending state at once; a forged return is ignored (tests). |
| 4.3 | Info | CWE-613 | Not Fixed [informational: the access token lives only in memory for about an hour and is gone on reload; unlinking forgets the key and link but does not revoke the token, so a person who stays on the page can link again without signing in] | `signOut()` (which revokes the Google token) exists but nothing in the app calls it, so Unlink leaves the person signed in with Google until the page is reloaded or the token expires. |
| 5.1 | Info | CWE-829 | Not Fixed [informational: the workflow runs only when started by hand, has read-only contents permission, and uses GitHub's own actions at major versions; pinning to commit hashes needs the human to look up and approve the hashes] | `.github/workflows/pages.yml` pins `actions/checkout`, `setup-node`, `upload-pages-artifact` and `deploy-pages` by major version tag (`@v4`, `@v3`), not by commit hash. |
| 5.2 | Info | CWE-668 | Not Fixed [informational: the human owns every page on this account's github.io origin; a custom domain or a separate account for the app would remove the sharing, which belongs with the v0.9 hosting decision] | On GitHub Pages the app shares its browser origin (`{account}.github.io`) with any other project site of the same account, so another page there could read the app's IndexedDB budget; today there is none. |
| 5.3 | Info | CWE-798 | Fixed | The Picker API key and OAuth client id are public by design; the human confirmed on 2026-11-27 that the Google settings are restricted to the single site that hosts the app, so a copied key cannot be used from another address. |
| 6.1 | Info | CWE-312 | Fixed | New stored values (record uids, `updatedAt`, sync link, sync records) pass the same shape checks on read; the sheet key is a non-extractable CryptoKey, the access token is kept in memory only, and localStorage holds only collapse state, two notices and the last-seen version. |
| 6.2 | Info | CWE-521 | Not Fixed [human decision Q8: an 8-character minimum passcode; Google holds the salt and ciphertext, so a short passcode could be guessed offline (600,000 PBKDF2 rounds slow this); a strength meter would add UI] | The sheet passcode only has to be 8 characters; anyone who can read the sheet (Google, or a person it is shared with) has the salt and encrypted rows and can try passcodes offline at a cost of 600,000 PBKDF2 rounds each. |
| 7.1 | Info | CWE-1395 | Fixed | Runtime dependencies are unchanged since v0.6 (dexie, fast-xml-parser 5.12.0, fflate 0.8.3, react, react-dom); `npm ls` shows none invalid or missing; `npm audit --omit=dev` finds 0 vulnerabilities; the Google libraries load from two exact hosts under the CSP. |
| 8.1 | Low | CWE-209 | Fixed | The Sync dialog and wizard showed the message of any error thrown while linking or creating a sheet, so a browser, database or crypto error text (not written by the app) could reach the screen; only the app's own sync errors are shown now. |
| 8.2 | Info | CWE-532 | Fixed | Sync failures show one plain sentence plus "Your data on this device is safe"; Google's response text is never shown or logged; `console.error` appears in three places and logs only an error name and message; the token, passcode and key are never logged. |
| v0.5 3.2 | Low | CWE-367 | Fixed | Budget setup and the wizard wrote rows from a snapshot taken when they opened, checking sibling names only in the form, so a change from another tab or a sync pull was overwritten and a duplicate sibling name could be saved. Now checked inside the write transaction. |
| v0.2 5.4 | Low (was Medium) | CWE-306, CWE-942, CWE-770, CWE-209 | Fixed | Network review closed: auth is Google's token flow with the token in memory, there is no server of ours (no CORS or body limits to set), quota errors back off up to 16 minutes, and error text is ours only (8.1, 8.2); re-rated Low. Quota per Cloud project still needs a raise before a wide release. |
| v0.2 2.3 | Info | CWE-1236 | Fixed | Formula injection into the sync sheet: cells are written RAW, text beginning with = + - or @ gets a leading apostrophe that is removed on read, tests cover each character, and no cell written by the app starts with one. |
| v0.3 6.2, v0.2 7.7 | Info | CWE-694 | Fixed | Sync preconditions are in place: random UUID record ids (Dexie v9), `updatedAt` on every record, and tombstone rows kept 90 days then purged, with tests for local deletes, remote deletes and expiry. |
| v0.2 8.8 | Info | CWE-209, CWE-778 | Fixed | The sync has no server of ours to log on; client errors are generic and never show stack traces or Google's response text (8.1, 8.2). |
| v0.2 2.4, 3.7 | Info | CWE-20 | Fixed | Pulled color tokens and ids must match fixed patterns; frequencies, estimates, amounts and dates are checked on read before they reach the tables, and rows that fail are skipped with a note (tests: bad color, estimate, amount, date, loops, depth). |
| v0.2 1.3 | Info | — | Fixed | No files are sent anywhere: sync writes text cells only, through Google's API; there is no server of ours that stores or serves files. |
| v0.2 6.7 | Info | CWE-311 | Fixed | Synced data is encrypted on the device before it leaves it (AES-GCM, key from the passcode by PBKDF2 with a random salt); the passcode is never sent or stored, only a non-extractable key; a lost passcode leaves local data intact. |
| v0.2 6.6 | Medium | CWE-312 | Not Fixed [human decision 2026-11-27: local encryption will not be part of the app; the data stays in the browser profile, protected by the device's own lock and the browser's storage rules; the sheet copy is encrypted] | Budget data in IndexedDB on the device is stored unencrypted, readable by anyone with access to the browser profile or the unlocked device; sync encrypts only the sheet copy. |
| v0.2 4.3 | Info | — | Held till v0.8 | The service worker takes over on update (autoUpdate), and the sheet carries no format version, so a device on older code could push rows without newer fields; add a version row before the first sheet format change. |
| v0.2 4.4 | Info | CWE-1021 | Held till v0.9 | `frame-ancestors` cannot be set from a meta tag, and GitHub Pages cannot send headers; the app's final host must send it (clickjacking). Tracked with v0.2 5.1. |
| v0.2 5.1, 5.2 | Medium | CWE-1021, CWE-693, CWE-319 | Held till v0.9 | Security headers on the host are still not set. GitHub Pages (manual test deploys, `pages.yml`) serves HTTPS with HSTS but cannot send CSP headers, frame-ancestors, nosniff, Referrer-Policy or Permissions-Policy; the v0.9 host decision settles both. |
| v0.2 2.5, 4.5 | Info | CWE-79 | Held till v0.8 | Trusted Types in the CSP and escaped item names in chart labels remain requirements for the v0.8 chart libraries; charts moved to v0.8 and v0.7 added no chart. |
| v0.2 2.2 | Info | CWE-79 | Not Fixed [informational: no HTML import exists; no DOMParser, innerHTML or similar is used anywhere, so the requirement has nothing to apply to unless an HTML import is scoped later] | HTML bank statements were once planned for import and had to be parsed into an inert document; the import format changed and no HTML import exists. |
| v0.2 7.1 | Low | CWE-1395 | Not Fixed [rechecked 2026-11-27: `npm audit` lists 4 moderate advisories (glob, minimatch, workbox-build, vite-plugin-pwa) with the fix only in a breaking downgrade; all are build-time and none ships in dist] | `npm audit` reports 4 build-time advisories in the PWA plugin's dependency chain; the shipped runtime has zero advisories. |
| v0.2 1.2 | Info | — | Held till post-v1 | Receipt photos need size limits, a content check and EXIF/GPS removal before storage; unchanged because v0.7 added no camera or image handling. |
| v0.4 7.1, v0.3 7.1, v0.2 7.4, 7.5, 7.6 | Info | — | Not Fixed [informational, unchanged: earlier guards cover the assertions, the lockfile pins versions, and the private package name has no security effect] | Guarded non-null assertions, caret ranges in `package.json` and the template package name `scaffold` are noted for later cleanup; none affects the shipped app. |
| v0.6 3.3, v0.5 4.3 | Info | CWE-20, CWE-770 | Not Fixed [informational, unchanged from v0.6: backup timestamps only sort and print, and a refused audio context only means no sound] | Backup `createdAt` and `updatedAt` are not shape-checked, and each reward makes one short-lived `AudioContext`; neither can cause more than a wrong time or a missing sound. |

## Domain 1 - File Handling

### 1.1 — Import limits unchanged (Info, Fixed)

CWE-400, CWE-434. `src/import/` changed only for the Week and Day overlap warning (step 14). The v0.6 limits (`security-v0.6.md` 1.1) still apply; `npm run test:import` runs the 24 hostile files and the database-unchanged checks (338 checks in total). Sync handles no files (v0.2 1.3).

## Domain 2 - Encoding and Sanitization

### 2.1 — Text sinks and formulas (Info, Fixed)

CWE-79, CWE-1236. `grep` of `src/` for `innerHTML`, `dangerouslySetInnerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`, `DOMParser`: no matches. `createObjectURL` is only in the backup download. Pulled and typed names reach the screen as JSX text. `updates.json` is fixed text bundled at build time and rendered as text.

- Formulas (v0.2 2.3): `valueInputOption=RAW` on every write, plus `neutralize` (apostrophe) for cells starting with `=`, `+`, `-` or `@` (base64 can start with `+`); `unneutralize` on read. Checks in `tests/sync/checks.ts`: each character, and no written cell starting with one.
- Pulled values (v0.2 2.4): category colors must match `^[a-z][a-z-]{0,39}$`, ids `^[A-Za-z0-9_-]{1,64}$`, names and descriptions pass `cleanName` and `cleanDescription`.

## Domain 3 - Validation and Business Logic

### 3.1 — Restored record ids (Low, Fixed)

CWE-20. `checkBackup` copied each purchase's and category's `uid` when it was a string. A hand-edited backup could set a 10,000-character id, one with `=` or spaces, or the same id on two rows. After restore the next sync writes the id as a row id: a bad one fails the `ID_RE` check when pulled (the row is skipped on every device and re-pushed each time), and a repeated one makes two records collapse into one. Impact: the person's own sync is damaged by a file they chose to restore; no other data is exposed, hence Low. Fix: `UID_RE` (one pattern, `src/storage/db.ts`, also used by `cells.ts`) keeps a uid once if it matches, and any other row gets a fresh id from the database hook. Check: `restore keeps a well-formed id once…` and `restore drops a category id with odd characters` (`tests/import/db-checks.ts`).

### 3.2 — Unbounded sheet size and notes (Low, Fixed)

CWE-770. `syncOnce` read every row of every tab, and each damaged row added a note; the Sync dialog printed every note as a list item. Anyone with edit access to the sheet (the owner's partner, or anyone it was shared with by mistake) needs no passcode to add rows, and the app would try to decrypt each one on every sync (once a minute while open). Impact: a frozen or crashed tab on every device until the rows are deleted by hand in Google Sheets; local data is not changed. Fix: a sheet with more than 50,000 rows in one tab (`MAX_ROWS_PER_TAB`; a long-time user adds a few thousand purchases a year) is refused before any row is parsed, with "The sheet has more than 50,000 rows in one tab, which is more than Simple Budget can read. Delete the extra rows in the sheet and try again."; the Sync dialog shows the first 20 notes and "…and N more." Check: `a sheet with more than 50,000 rows in a tab is refused with a plain message` (the local purchases are unchanged). The existing 20,000-character cap per cell stays.

### 3.3 — Plain columns not authenticated (Info, Not Fixed)

CWE-345. Each row's encryption is bound to its tab and id (additional data), so content cannot be moved between rows, but `updatedAt` and `deleted` are plain on purpose (`0015` Q3, Q4: devices match and merge without the passcode, and hand edits are allowed). Someone with edit access can set `deleted` on rows (the devices delete the records and keep a tombstone; clearing the flag within 90 days restores them from the content that is still in the sheet) or move a time up to 24 hours ahead (`CLOCK_SKEW_MS`). They cannot read or forge any content. Everyone who can edit the sheet already holds a share the owner granted.

### 3.4 — Untrusted pulls (Info, Fixed)

CWE-20. Covers v0.2 3.7 and 2.4. Order in `syncOnce`: row shape (`parseRow`: id pattern, integer time within 24 h of this device's clock, deleted mark), size (20,000 characters), decrypt (any change fails), `JSON.parse`, then `readCat`, `readItem`, `readSettings` reuse `validCategory`, `validItem`, `cleanSettings`. In the write transaction: parent must exist, no loops, depth at most 2, a delete is refused while the row still has items or purchases, duplicate sibling names get a suffix and a note. Tests (`tests/sync/checks.ts`, 63 checks) cover bad color, estimate, amount, date, future time, orphan, too deep, tampered cell, repeated row, name clash, wrong passcode and 429 back-off.

### v0.5 3.2 — Stale writes from Budget setup and the wizard (Low, Fixed)

CWE-367. `saveSetup` (`src/storage/repository.ts`) wrote the rows the person edited from a snapshot taken when the dialog opened and checked sibling names only in the form. With sync running every minute, a pull could change a row while Budget setup was open, and the save would overwrite it (or bring back a row another device deleted); two tabs could also save the same name twice. Fix: inside the transaction `saveSetup` re-reads the categories and refuses (a `SetupConflictError`) when a row it is about to write changed since the snapshot, when a new row's parent is gone, or when a written row would share a name with a sibling. Nothing is written, and the person is told: "The budget changed in another tab or on another device while this was open, so nothing was saved. Close this and open it again." Checks in `tests/import/db-checks.ts`: an unchanged save works; a row changed elsewhere is not overwritten; a repeated name is refused with nothing written; a new row under a removed parent is refused. The import write (v0.6 3.4), rename, move and the sync merge already did these checks.

## Domain 4 - Web Frontend Security

### 4.1 — CSP loosened for Google (Low, Not Fixed)

CWE-79, CWE-1021. The production CSP (meta tag, `vite.config.ts`): `default-src 'self'`; `script-src 'self' https://accounts.google.com/gsi/client https://apis.google.com`; `style-src 'self' 'unsafe-inline'`; `connect-src 'self' https://sheets.googleapis.com https://www.googleapis.com`; `frame-src https://accounts.google.com https://docs.google.com`; `img-src 'self' data:`; `object-src 'none'`; `base-uri 'self'`; `form-action 'none'`. Two points weaken it: inline styles (the Picker's file list stays invisible without them; decided 2026-11-26) and a script host rather than a single file (the Picker loads further files from `apis.google.com`, so a path-only source breaks it). The Google scripts also have no integrity hash (Google does not offer one). Nothing in the app lets text become markup, so there is no injection point today; the rating is Low and the human confirms it. If the Picker is ever replaced by an own list of sheets, both loosenings can go.

### 4.2 — Redirect sign-in (Info, Fixed)

CWE-352, CWE-598. `signInRedirect` stores a random `state` (`crypto.randomUUID()`) and the return target in sessionStorage and sends the person to Google's OAuth page with the app's own address as `redirect_uri`. `readRedirect` removes the pending value first, accepts the return only when `state` matches, removes the fragment with `history.replaceState`, checks that the granted scope includes `drive.file`, and keeps the token in memory. A return without a stored `state` (forged or stale) is ignored. Tests: `tests/sync/checks.ts` (state match, forged state, denied, missing scope, no token written to storage). The token is in the URL fragment for the moment the page loads; fragments are not sent to servers.

### 4.3 — Unlink does not sign out (Info, Not Fixed)

CWE-613. See the table. The token is memory only and expires in about an hour (`TOKEN_MARGIN_MS` expires it a minute early). To revoke on Unlink, call `signOut()` there; the cost is a new sign-in when relinking in the same visit.

## Domain 5 - Configuration

### 5.1, 5.2, 5.3 — GitHub Pages deployment (Info, Not Fixed)

`pages.yml` runs only on a manual start, with `contents: read`, `pages: write`, `id-token: write`, `npm ci` from the lockfile and the build with `BASE_PATH=/Simple_Budget/`. GitHub Pages is HTTPS only with HSTS (v0.2 5.2 for this host), but it cannot send response headers (v0.2 5.1, 4.4, held to v0.9). `vite.config.ts` and `index.html` were read in full. Open question for the human, 5.3: confirm in the Google Cloud console that the OAuth client lists the Pages origin and redirect URI and that the API key is limited to that site and the Picker API (the redirect sign-in was tested on the Pages address on 2026-11-26, so the OAuth side works).

### v0.2 5.4 — Network review (closed, Low)

Checked against `0015` §7.1: **auth** Google token flow only, token in memory, scope `drive.file` only (`acceptToken` rejects a grant without it); **CORS** no server of ours, calls go straight to Google with a Bearer token; **rate limits** one batched read and at most one write call per tab per sync, back-off 1, 2, 4, 8, 16 minutes after HTTP 429 (tested), sync only while the page is visible; **error leakage** messages are ours (8.1, 8.2). Remaining risk: the Sheets read quota is per Cloud project, shared by every user, so many open apps can exhaust it; ask Google for a higher quota before a wide release (human task).

## Domain 6 - Data Protection

### 6.1 — Stored values (Info, Fixed)

CWE-312. New in v0.7: Dexie v9 (record `uid`, `updatedAt`, `syncRecords`, `syncConfig`) and v10 (the Incidentals › Miscellaneous row). `syncConfig` holds the sheet id, the last sync time and the non-extractable key (a check proves `exportKey` fails). The access token is never stored. `sessionStorage` holds only the pending sign-in `state` and return target, removed on return. localStorage: collapse state, two notices, the last-seen version. Backups do not include the sync key or link.

### 6.2 — Passcode strength (Info, Not Fixed)

CWE-521. AES-GCM per record (random 12-byte IV, tab and id as additional data), PBKDF2-SHA-256 with 600,000 rounds, random 16-byte salt in the Settings tab, key length 256. A new sheet needs 8 or more characters and the same passcode twice; a linked sheet has no length rule (it must match). A short passcode is the weakest point against someone who can read the sheet.

## Domain 7 - Secure Coding and Architecture

### 7.1 — Dependencies (Info, Fixed)

CWE-1395. `package.json` runtime dependencies were read: dexie ^4.4.7, fast-xml-parser 5.12.0, fflate 0.8.3, react and react-dom ^19.3.1; the same set as `security-v0.6.md` 7.2. `npm ls --depth=0` shows nothing invalid, missing or extraneous. `npm audit --omit=dev`: 0 vulnerabilities; `npm audit`: 4 moderate, all build-time (v0.2 7.1). Dev tools added in v0.7 (lighthouse, puppeteer-core) do not ship. Storage is reached only through `src/storage/`; the sync engine writes through Dexie in one transaction marked `sync`.

## Domain 8 - Security Logging and Error Handling

### 8.1 — Only the app's own messages are shown (Low, Fixed)

CWE-209. `plainError` (`src/components/syncActions.ts`) returned `e.message` for any `Error`. In the Sync dialog and wizard the actions that sign in, create a sheet and link one can fail inside the browser (storage, Web Crypto, a blocked pop-up) with text the app did not write. Now only `PasscodeError`, `AuthError`, `RemoteError` and `RateLimitError` messages are shown; anything else is "Something went wrong." plus "Your data on this device is safe." The redirect return builds its message through `AuthError`. The controller already used the same rule for background syncs.

### 8.2 — Sync failures and logging (Info, Fixed)

CWE-532. `call()` in `googleSheets.ts` maps 429, 401, 403/404 and other failures to fixed sentences and discards the body. `console.error` appears in three places (`main.tsx`, `ErrorBoundary.tsx`, `AddBudget.tsx`) and logs only an error name and message. No log line contains a token, passcode, key, sheet id or amount.

## Decisions by the human (2026-11-27)

- Ratings confirmed. 4.1 approved: the CSP loosening is needed for sync in browsers with strict security.
- v0.2 6.6: local encryption will not be part of the app; not carried further.
- 5.3: Google settings are restricted to a single site; closed. The Sheets quota is reviewed before a wider release.
- 3.3, 6.2, 5.1, 5.2: accepted as Info.
- 4.3 (Unlink does not sign out): left as Info, not fixed (human, 2026-11-27: the token is memory only, lasts about an hour and reaches only sheets the app created or the person picked).

## Method notes

- Commands: `npm run test:all` (import 338, sync 63, dialogs 127), `npm run lint`, `npx tsc -b`, `npm run build`, `npm audit` with and without `--omit=dev`, `npm ls --depth=0`, `grep` for sinks and storage use.
- Files read in full: everything in `src/storage/sync/`, `src/components/{Sync,WizardSync,syncActions,syncForms,useSyncState,UpdatePopup}`, `src/updates/`, `vite.config.ts`, `.github/workflows/pages.yml`, `docs/design/0015-sync-design.md`, and the restore and setup code in `src/storage/repository.ts`.
- Browser checks used the production build and the script described in `a11y-v0.7.md`.
