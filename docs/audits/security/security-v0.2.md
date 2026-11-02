# Security Review — v0.2 (NETWORKED matrix)

Scope: v0.2 at v0.2.5 (reviewed at commit 7e3835c; fixes applied after) — PWA (Vite + React + Dexie IndexedDB), no backend yet. Treated as networked (multi-device sync planned, `0003-roadmap.md` v0.8), so rated under `issue-severity-matrix_NETWORKED.md`, matching v0.1. Domains per `security-domains.md`, ASVS 5.0.0 chapter names. Written and reviewed one domain at a time.

## Summary

### Executive summary

All 8 domains reviewed, and every finding above Info that the current code can address is fixed. v0.2 added a category tree, estimates, a Budget setup dialog and new tables, all stored locally in the browser. The review checked how the app handles files, displays text, validates input, runs in the browser, is configured for hosting, protects stored data, manages dependencies and reports errors.

No one can inject code into the app: React escapes all user text, there is no file handling beyond the new backup restore (which checks every row before writing), and production builds now carry a strict Content Security Policy. The two serious risks to the user's own data are fixed: the app asks the browser to keep its data and offers a backup file (6.1, 6.2), and upgrades no longer guess where repeated item names belong, flagging older amounts for the user to check (3.1). Money, date and name input follow one set of rules (2.1, 3.2–3.5), and storage failures now show a clear message instead of a blank page or silence (8.1–8.5).

Still open: hosting headers and HTTPS (5.1, 5.2, held for v0.9), sync configuration and encryption (5.4, 6.6, held for v0.8), estimate scaling math (3.4, v0.4), the Add form recurrence mismatch (3.6, v0.3), and dev-only build-tool advisories with no upstream fix yet (7.1).

Totals: 1 Critical (fixed), 1 High (fixed), 14 Medium (9 fixed, 5 held; plus 6.3 and 6.4, merged into 3.1 and 8.1), 10 Low (8 fixed, 1 held, 1 not fixed), 23 Info.

### Summary table

| ID | Severity | CWE | Status | Issue |
| --- | --- | --- | --- | --- |
| 1.1 | Info | CWE-400, CWE-434 | Held till v0.6 | CSV/HTML upload (v0.6) will be the first file input; it needs size, row and content-type checks. |
| 1.2 | Info | — | Held till post-v1 | Receipt photos need size limits, a content check and location data (EXIF/GPS) removed before storage. |
| 1.3 | Info | — | Held till v0.8 | When sync sends files to a server, the server must re-check them and keep them out of public paths. |
| 2.1 | Low | CWE-451, CWE-20 | Fixed | Names typed into Budget setup "Create" are stored with no length limit and keep invisible control and right-to-left override characters that can make a name display misleadingly. |
| 2.2 | Info | CWE-79 | Held till v0.6 | HTML bank statements imported in v0.6 must be parsed into an inert document and only their text kept; inserting them into the page would allow script injection. |
| 2.3 | Info | CWE-1236 | Held till v0.8 | When sync writes item names into an OnlyOffice spreadsheet, a name starting with =, +, - or @ could run as a formula; such values must be neutralized on write. |
| 2.4 | Info | CWE-20 | Held till v0.8 | Color tokens and record ids from synced data will reach CSS class names and element ids; today they come only from app code, so synced values need an allowlist check. |
| 2.5 | Info | CWE-79 | Held till v0.7 | Chart libraries added in v0.7 often build tooltips and labels as HTML; item names passed to them must be rendered as text or escaped first to prevent script injection. |
| 3.1 | High | CWE-1287, CWE-20 | Fixed | The v5 migration matches old amounts to categories by name, so amounts for repeated names such as Car or Miscellaneous are silently moved under the first same-named category (e.g. Insurance instead of Maintenance). |
| 3.2 | Medium | CWE-1284, CWE-20 | Fixed | Amounts and estimates only need to pass `Number.isFinite`, so hex (`0x1A`), exponent (`1e300`), negative estimates and more than two decimals are stored, and large values add up to Infinity in totals. |
| 3.3 | Medium | CWE-20 | Fixed | Typing letters into the Amount field shows "Amount cannot be empty" because number inputs report an empty value for bad text; the message is wrong and does not say what format is needed. |
| 3.4 | Medium | — | Held till v0.4 | Estimates are scaled by days/30.44, so a monthly estimate of 100 shows 91.98 in a February month total and 101.84 in a 31-day month, which does not match what the user typed. |
| 3.5 | Low | CWE-20 | Fixed | The date field has no minimum or maximum, accepts far past or future years that never appear in any table period, and a cleared date silently becomes today. |
| 3.6 | Low | CWE-20 | Held till v0.3 | Add budget item saves a recurrence on any item, including groceries or savings where recurrence does not apply, while Budget setup clears it for those items, so the two screens disagree. |
| 3.7 | Info | CWE-20 | Held till v0.8 | Stored frequency, estimate and amount values are trusted on read; synced records with an unknown frequency or a non-number estimate would show NaN in the table, so they need checking when read. |
| 4.1 | Medium | CWE-693 | Fixed | `index.html` sets no Content Security Policy, so if any future injection bug lets markup into the page, nothing in the browser limits what scripts, frames or connections it can use. |
| 4.2 | Low | — | Fixed | The PWA manifest points its only icon at `/vite.svg`, which is not in `public/` and is absent from the build, so install prompts and home-screen icons have no valid image. |
| 4.3 | Info | — | Held till v0.8 | The service worker takes over immediately on update (skipWaiting + clientsClaim); acceptable now, but once sync ships an open tab could run old code against a new server or schema without the user knowing. |
| 4.4 | Info | CWE-1021 | Held till v0.8 | Clickjacking protection (`frame-ancestors`) cannot be set from a meta tag and must be sent as an HTTP header by whichever host serves the app; tracked with Domain 5 configuration. |
| 4.5 | Info | CWE-79 | Held till v0.6 | Trusted Types should be turned on in the CSP when HTML import (v0.6) or chart libraries (v0.7) bring the first code that could write HTML strings into the page. |
| 5.1 | Medium | CWE-1021, CWE-693 | Held till v0.9 | No hosting config exists, so nothing sets a Content-Security-Policy, frame-ancestors, nosniff, Referrer-Policy or Permissions-Policy; the static host chosen for distribution must send them. |
| 5.2 | Medium | CWE-319 | Held till v0.9 | The distributed PWA must be served only over HTTPS with HSTS and an HTTP-to-HTTPS redirect, or a network attacker could swap in a malicious service worker or app bundle. |
| 5.3 | Low | CWE-538 | Fixed | `.gitignore` ignores `.env`, `.env.local` and `.env.*.local` but not `.env.production` or `.env.development`, which Vite also loads, so a secret placed there could be committed. |
| 5.4 | Medium | CWE-306, CWE-942, CWE-770, CWE-209 | Held till v0.8 ⚠ REQUIRES REVIEW BEFORE PROCEEDING | v0.1 deferred sync-time network config (auth, CORS, rate limits, body limits, error leakage) to sync; it is re-rated Medium under the networked matrix and must be reviewed before v0.8 work starts. |
| 5.5 | Info | — | Fixed | The dev and preview servers keep Vite's localhost-only default and production builds emit no sourcemaps, so neither the dev server nor the source is exposed to the network today. |
| 6.1 | Critical | CWE-1188 | Fixed | The app never asks the browser to keep its data, so IndexedDB is "best-effort" storage that the browser may delete without warning under disk pressure or inactivity rules, wiping every amount and estimate. |
| 6.2 | Medium | — | Fixed | There is no way to export or back up budget data, so browser eviction (6.1), clearing site data, or losing the device destroys all records with no recovery path. |
| 6.3 | Medium | CWE-20 | Fixed [merged into 3.1, which owns the v5 migration misfiling issue; tracked and fixed there so it is reported once] | Duplicate of 3.1: the v5 migration can file amounts with repeated names under the wrong parent category. |
| 6.4 | Medium | CWE-755 | Fixed [merged into 8.1, which owns the startup error-handling issue; tracked and fixed there so it is reported once] | Duplicate of 8.1: a database that fails to open leaves a blank page with no message. |
| 6.5 | Low | CWE-20 | Fixed | Rows read back from IndexedDB are used without checking their shape, so a corrupted row with a non-number amount or missing date gives wrong totals instead of being skipped or reported. |
| 6.6 | Medium | CWE-312 | Held till v0.8 | Budget amounts, estimates, due dates and category names (financial data) are stored unencrypted in IndexedDB, readable by anyone with access to the browser profile or device. |
| 6.7 | Info | CWE-311 | Held till v0.8 | Sync will send financial data off the device; it needs TLS, optional client-side encryption with a passphrase that is never stored or sent in plain form, and clear behavior when it is lost. |
| 6.8 | Info | — | Fixed | The collapsed-rows list in localStorage is parsed inside try/catch and only used for membership checks, so a corrupted or tampered value cannot crash the table or inject data. |
| 6.9 | Info | — | Fixed | The Dexie v5 upgrade runs inside the single IndexedDB version-change transaction, so an error part-way through rolls back every change and leaves the v4 data untouched. |
| 6.10 | Info | CWE-532 | Fixed | The only console logging is one `console.error` of a failed save in Add; it stays in the local devtools console and never leaves the device, and the user sees a plain message. |
| 6.11 | Info | — | Fixed | The service worker precaches only build assets (scripts, styles, HTML, icons); no budget data is written into the Cache Storage, so there is no second copy of user data to protect. |
| 7.1 | Low | CWE-1395 | Not Fixed [no patched release exists yet for glob, minimatch or deepmerge; newest published versions are still in the advisory ranges, and these run only at build time] | `npm audit` reports 10 dev-only advisories (8 moderate, 2 low: glob, minimatch, ejs/jake/filelist, deepmerge) in the PWA build plugin's dependency chain; the shipped runtime has zero advisories. |
| 7.2 | Low | — | Fixed | Neither tsconfig sets `"strict": true`; strict checking is on only because TypeScript 6 makes it the default, so a compiler change or a copied config could silently turn it off. |
| 7.3 | Low | CWE-1164 | Fixed | `DropdownWithSearch` and `CheckboxGroup` are exported from the UI barrel but not imported anywhere in the app, leaving 75 lines of unused input code that still has to be audited and maintained. |
| 7.4 | Info | — | Not Fixed [informational: the lockfile pins every installed version and checksum, so the caret ranges only matter when someone runs a fresh install or update] | `package.json` uses caret (`^`) ranges for all runtime and most dev dependencies; `package-lock.json` is committed and pins exact versions with integrity hashes. |
| 7.5 | Info | — | Not Fixed [informational: each assertion is preceded by a validation check that returns early, so none can be null at runtime today; noted so later refactors keep the guard] | `AddBudget.save` uses `target!` three times and the v5 migration uses `id!`; these are safe today only because earlier code guarantees the value, which the type system does not check. |
| 7.6 | Info | — | Not Fixed [informational: the package is private and never published, so the name has no security effect; rename at any convenient commit] | `package.json` still has the template name `"scaffold"`, which shows in `npm ls` output and tooling instead of the project's real name. |
| 7.7 | Info | CWE-694 | Held till v0.8 | Sync preconditions are missing: ids are per-device auto-increment numbers, categories have no `updatedAt`, and deletes leave no record (tombstone), so two devices would produce clashing ids and lose edits. |
| 8.1 | Medium | CWE-755 | Fixed | If the browser database can't open or seeding fails (storage blocked, quota full, newer database version), the app never renders and the user sees a blank page with no message. |
| 8.2 | Medium | CWE-755 | Fixed | When loading categories, amounts or settings fails, the error is dropped and the app shows an empty or default table, so the user can't tell it from having no data. |
| 8.3 | Medium | CWE-755 | Fixed | Budget setup Save and Create have no error handling; a storage failure shows nothing, the dialog looks unchanged, and estimates may be half-saved without the user knowing. |
| 8.4 | Medium | CWE-755 | Fixed | A database upgrade blocked by another open tab hangs startup on a blank page, and an older tab whose database is closed by an upgrade fails every later save silently. |
| 8.5 | Medium | CWE-248 | Fixed | There is no React error boundary, so any exception while rendering (for example from bad stored data) unmounts the whole app and leaves a blank page with no explanation. |
| 8.6 | Low | CWE-532 | Fixed | The Add flow logs the full storage error object to the console; today that stays on the device, but the same pattern copied into sync or a log service would send budget data off it. |
| 8.7 | Info | — | Fixed | Checked that v0.1 finding 8.1 still holds after the v0.2 rewrite: the Add flow still catches storage errors and announces "The item wasn't saved. Try again." in a status region. |
| 8.8 | Info | CWE-209, CWE-778 | Held till v0.8 | When sync adds a server, it needs logging of security events without amounts or names, and generic client error messages that never show stack traces or server details. |

## Domain 1 - File Handling

**No findings against current code.** v0.2.5 has no file-handling surface, so ASVS File Handling requirements (size/count caps, extension + magic-byte checks, filename sanitization, safe storage/serving, download/Content-Disposition) have nothing to apply to.

Evidence:

| Checked | Result |
|---------|--------|
| `src/`, `index.html`, `vite.config.ts`, `public/`, `package.json` for `type="file"`, `FileReader`, `Blob`, `createObjectURL`/`revokeObjectURL`, `FormData`, `download`, `.files`, `accept=`, File System Access pickers, `navigator.share`, `arrayBuffer`/`readAsText`, `fetch(` | 0 matches |
| `<input>` elements | Only text, number, date, checkbox, decimal: `src/components/ui/Input.tsx:6`, `src/components/ui/AmountInput.tsx:5`, `src/components/ui/DatePicker.tsx:4`, `src/components/ui/DropdownWithSearch.tsx:10`, `src/components/ui/ItemSelector.tsx:46`, `src/screens/Budget.tsx:32`, `src/screens/BudgetSetup.tsx:137,146,184,205` |
| IndexedDB schema | Tables `budgetItems`, `categories`, `settings` hold structured fields only; no blob/file columns (`src/storage/db.ts:53-66`) |
| Service worker caching | Workbox precaches build output only (`vite.config.ts:23`); no runtime caching of user files |
| Static assets | Developer-supplied only: `public/favicon.svg`, `public/icons.svg`, `src/assets/vite.svg` |
| Import/export | None present |

### 1.1 — CSV/HTML upload requirements (Info, Held till v0.6)

`0003-roadmap.md` v0.6 (CSV/HTML upload) adds the first real file surface. It must ship with: a byte-size cap and row-count cap checked before parsing (CWE-400); extension + content sniffing rather than trusting `file.type` (CWE-434); the filename never used as a key or rendered unescaped; HTML statements parsed with `DOMParser` into an inert document and text-extracted, never inserted into the live DOM (cross-ref Domain 2); CSV formula-prefix neutralization if data is ever re-exported (CWE-1236); clear user-facing errors on rejection (Domain 8). Verify at v0.6 review.

### 1.2 — Receipt photo requirements (Info, Held till post-v1)

`0003-roadmap.md` Post v1.0 (receipt photos). Add image size/dimension caps, magic-byte check, EXIF/GPS stripping before storage or sync (Domain 6), and `revokeObjectURL` lifecycle for previews (Domain 4).

### 1.3 — Server-side file handling with sync (Info, Held till v0.8)

Once files travel to a backend, the server must re-validate them and store them outside any web-served path. Re-review this domain at that milestone.

## Domain 2 - Encoding and Sanitization

**No exploitable injection in current code.** All user text (item/category names, amounts, dates) reaches the DOM through React JSX text or attribute props, which React escapes. Nothing builds HTML, URLs, selectors or CSS from user text. v0.1 Domain 2 ("No findings", `docs/audits/security/security-v0.1.md:5-6`) still holds; one new Low item comes from the v0.2 Create input.

Evidence:

| Checked | Result |
|---------|--------|
| `src/`, `index.html` for `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`, `setAttribute`, `.style.`, `querySelector`, `window.location` | 0 matches |
| Names rendered as JSX text (escaped) | `src/screens/BudgetSetup.tsx:132,181`, `src/components/BudgetTable.tsx:60,65-66`, `src/components/ui/ItemSelector.tsx:81-82`, `src/budget/tree.ts:126` (`displayName`, string concat only) |
| Names in attributes (React escapes attribute values) | `aria-label` `src/screens/BudgetSetup.tsx:195`; label text `:145`; error strings interpolate the name as text `:75,93` |
| Element ids / `href` / `getElementById` | Built from numeric Dexie ids or fixed strings, never names: `src/screens/BudgetSetup.tsx:24,131,146,176-177`; `src/components/ui/ItemSelector.tsx:41,76`; `src/components/ui/DropdownWithSearch.tsx:57`. `href="#${fieldId}"` (`src/components/ui/ErrorSummary.tsx:17`) uses `est-{id}` (`src/screens/BudgetSetup.tsx:93`) and focus uses `getElementById`, which does not parse selectors, so `CSS.escape` is not needed (`src/components/ui/errors.ts:12`) |
| CSS class interpolation | `clr-${color}` only (`src/components/BudgetTable.tsx:63,78`, `src/components/ui/ItemSelector.tsx:79`, `src/screens/BudgetSetup.tsx:132,181`); color is set by app code only: `src/budget/tree.ts:129`, `src/storage/db.ts:75,86`, `src/storage/seed.ts:7` (see 2.4) |
| `localStorage` | Fixed key; value is a JSON id array parsed in `try/catch` and used only for `Set.has` (`src/components/BudgetTable.tsx:8,35`) |
| `toLocaleString` | Output is text content only (`src/budget/tree.ts:122-123`) |
| v5 migration | Copies old free-text `name` unchanged into a new category (`src/storage/db.ts:86`); rendered via the same escaped paths; covered by 2.1 |
| `index.html` | Static; no inline script, no user data (`index.html:1-13`). No CSP — defense in depth for XSS, rated under Domain 5 |
| Markdown / CSV / HTML rendering, import, export | None present |

### 2.1 — Created names not length-capped or stripped of control/bidi characters (Low, Fixed)

CWE-451, CWE-20. The Create input has no `maxLength` (`src/screens/BudgetSetup.tsx:146-150`) and `addItem` only `trim()`s before storing (`src/screens/BudgetSetup.tsx:72,78`); the v5 migration stores old names as-is (`src/storage/db.ts:86`). React escaping blocks script injection, but a name can hold U+202E (right-to-left override), U+2066–2069, zero-width or C0 control characters, which change how the name and its neighbours display in the table, selector and screen-reader output, and an unbounded name stretches layout. The duplicate check (`src/screens/BudgetSetup.tsx:74`) compares raw strings, so `Gas` and `Gas` with a zero-width space both pass. Impact is limited to the local user today; v0.8 sync makes names cross-device input. Overlaps Domain 3 (validation); fix once.

Fix: a shared `cleanName(s)` that applies `normalize('NFC')`, removes `/[\p{Cc}\p{Cf}]/gu`, collapses whitespace, trims and caps length (e.g. 60); use it in `addItem`, `categoryRepo.add`/`rename` (`src/storage/repository.ts:16,25`) and the migration; add `maxLength` to the input; run the duplicate check on the cleaned value. Verify: entering `a` + U+202E + `b` stores `ab`; a 200-character paste is cut to the cap.

**Resolution:** `cleanName` (`src/budget/validate.ts`) applies NFC, strips `\p{Cc}`/`\p{Cf}`, collapses whitespace and caps at 60; used by Budget setup Create (with `maxLength`), the duplicate check, `categoryRepo.add`/`update`/`rename`, the v5 migration and backup restore. Verified: `Ab`+U+202E+`cd`+U+200B+`  x` is stored as `Abcd x`.

### 2.2 — HTML statement import must stay inert (Info, Held till v0.6)

CWE-79. `0003-roadmap.md` v0.6 adds CSV/HTML upload (file-side checks in 1.1). Parse HTML with `DOMParser` (`text/html`) and read only `textContent` from the cells you need; never assign to `innerHTML`, never use `dangerouslySetInnerHTML`, never render an imported fragment. Imported names go through `cleanName` (2.1). Verify at v0.6 review with a fixture containing `<img src=x onerror=…>` and `<script>`.

### 2.3 — Formula injection into the sync spreadsheet (Info, Held till v0.8)

CWE-1236. v0.8 adds an OnlyOffice adapter and seeds from an OnlyOffice sheet (`0003-roadmap.md` v0.8). Item names written to cells that begin with `=`, `+`, `-`, `@`, tab or CR must be written as text (cell type string, or prefixed with `'`); values read back must be treated as strings, never evaluated. Same rule applies to any CSV export. Verify with an item named `=HYPERLINK("http://x","y")`.

### 2.4 — Synced color tokens and ids reaching class names and element ids (Info, Held till v0.8)

CWE-20. `color` is interpolated into `className` (evidence table) and ids into `id`/`href`. Today both come from app code and Dexie auto-increment, so they are safe. Once records arrive by sync (`0003-roadmap.md` v0.8), validate `color` against the token allowlist on read (fallback to a default) so an untrusted value cannot inject extra class names, and keep using `getElementById`; if a string or UUID id is ever passed to `querySelector`, wrap it in `CSS.escape`. Verify at v0.8 review.

### 2.5 — Chart labels and tooltips (Info, Held till v0.7)

CWE-79. v0.7 adds charts (`0003-roadmap.md` v0.7). Many chart libraries build tooltips/legends with HTML strings. Pick one that renders labels as text/SVG text, or HTML-escape item names before passing them to any HTML formatter callback. Verify at v0.7 review with an item named `<img src=x onerror=alert(1)>`.

## Domain 3 - Validation and Business Logic

Covers form input (amount, estimate, date, recurrence, created names), the totals and period logic in `src/budget/tree.ts`, and the Dexie v5 migration. v0.1 items 3.1/3.2 (`NaN`/`Infinity` amounts, `docs/audits/security/security-v0.1.md:9-10`) remain fixed: both forms check `Number.isFinite` (`src/screens/AddBudget.tsx:32-33`, `src/screens/BudgetSetup.tsx:93`). Name length, control characters and the duplicate check on cleaned names are covered by 2.1 and not repeated here.

Evidence:

| Checked | Result |
|---------|--------|
| Amount/estimate parsing | `Number(x)` + `Number.isFinite` only; no range, sign or decimal rules (`src/screens/AddBudget.tsx:31-33,49,51`, `src/screens/BudgetSetup.tsx:93,102`) |
| Amount input type | `type="number" step="0.01"` (`src/components/ui/AmountInput.tsx:5`); Budget setup estimate is a text box with `inputMode="decimal"` (`src/screens/BudgetSetup.tsx:184`) |
| `-0` | `formatAmount` treats `-0` as zero and shows blank (`src/budget/tree.ts:122-123`); no issue |
| `1e309` | `Number('1e309')` is `Infinity`, rejected by `Number.isFinite`; no issue |
| Estimate scaling | `PER_MONTH` and `days / 30.44` (`src/budget/tree.ts:69,72-75`); daily items scale exactly (`estimate * days`) |
| Period boundaries | Local-date strings (`src/budget/tree.ts:82-83`); week = Monday–Sunday, month columns clipped to the calendar month (`src/budget/tree.ts:92-110`); inclusive string compare on `YYYY-MM-DD` (`src/budget/tree.ts:116`). Correct for 4-digit years |
| Subtree / Net Income | `actualFor`/`estimateTotal` sum the node and all descendants (`src/budget/tree.ts:114-120`); Net Income = Pay + Incidental Income − Taxes, actuals and estimates alike (`src/components/BudgetTable.tsx:49-53`). Correct |
| Entry routing | Computed rows take no amounts; Charity/Medical route to their own non-computed `Miscellaneous` child or none (`src/budget/tree.ts:45-48`, used at `src/components/ui/ItemSelector.tsx:29`). Correct |
| Duplicate check | Case-insensitive, siblings only, on create (`src/screens/BudgetSetup.tsx:74`); `rename` has no check but has no caller in the UI (`src/storage/repository.ts:25`); see 2.1 |
| Recurrence values | `<select>` options from `FREQUENCIES`, cast `as Frequency` (`src/screens/AddBudget.tsx:108`, `src/screens/BudgetSetup.tsx:195`); not checked on read (`src/budget/tree.ts:74`) |
| v5 migration | `src/storage/db.ts:65-105`; runs inside Dexie's upgrade transaction, so a thrown error rolls back rather than half-migrating. Startup has no `.catch` (`src/main.tsx:9`) — the resulting blank page is a Domain 8 item |

### 3.1 — v5 migration routes same-named items to the wrong category (High, Fixed)

CWE-1287, CWE-20. The upgrade finds the new category for each old amount by name (`src/storage/db.ts:82`), then prefers the match whose parent is named `old.category`, else the first match (`src/storage/db.ts:83`). Amounts saved by the v0.2.3–v0.2.5 add form have `category: ''`; only the e2f16c3 checkpoint build stored the subcategory name (e.g. `Maintenance`), and those amounts match correctly. For the `''` amounts, for any name that repeats in the seed — `Car` (Insurance, Maintenance), `Miscellaneous` (Charity, Medical, Maintenance), `Medical` (Insurance item vs Medical subcategory) (`src/storage/seed.ts:26-30`) — the parent test fails and the amount goes to the lowest-id match. A Maintenance car repair moves to Car (Insurance) with no warning. Its estimate, recurrence and autopay are then written onto that wrong category (`src/storage/db.ts:90-98`), and when several old amounts share a name, the last one's estimate silently replaces the others. Amounts and grand totals survive, so this is misattribution, not loss (High rather than Critical); it affects only data created before v0.2.5, and the migration has run on any device that opened v0.2.5, so the fix must also cover already-migrated data.

Fix: when more than one category matches and `old.category` does not single one out, do not guess — put the amount under a new item named `{name} (needs review)` under Expenses, or skip setting the parent and flag it, and never copy estimates onto an ambiguous match. Only copy an estimate when the target has none, so the first value is kept. Add a migration test that seeds a v4 database with two `Car` amounts (one insurance, one repair) and two `Miscellaneous` amounts and checks where each lands. For already-migrated users, note in the v0.3 release notes that Car/Miscellaneous/Medical amounts from before v0.2.5 should be checked.

**Resolution:** The v5 upgrade no longer guesses: when a repeated name can't be placed by its old category, the amount is flagged `needsReview` and its estimate is not copied. A new v6 upgrade flags amounts the shipped v5 already migrated under a repeated name; the app lists them in a one-time notice. Ambiguity audit added to `0003-roadmap.md` v0.3. Verified with a seeded v4 database: Car flagged, estimate not copied; Groceries placed and estimate kept.

### 3.2 — Amount and estimate accept values outside sensible money rules (Medium, Fixed)

CWE-1284, CWE-20. The only check is `Number.isFinite(Number(v))` (`src/screens/AddBudget.tsx:32-33`, `src/screens/BudgetSetup.tsx:93`), and the saved value is `Number(v)` as typed (`src/screens/AddBudget.tsx:49,51`, `src/screens/BudgetSetup.tsx:102`). In Budget setup the field is free text (`src/screens/BudgetSetup.tsx:184`), so `0x1A` saves as 26, `1e300` saves, `  12  ` saves, and `-50` saves a negative estimate that reduces totals. In Add budget item `1e308` passes; two such entries sum to `Infinity` in `actualFor` (`src/budget/tree.ts:116`) and the table shows `∞`. Values like `12.345` are stored unrounded and float sums (`0.1 + 0.2`) accumulate error that the 2-decimal display hides until it rounds the wrong way. Wrong output, not broken: Medium.

Fix: one shared `parseMoney(s)` in `src/budget/` that accepts only `/^-?\d{1,9}(\.\d{1,2})?$/` after trim (no hex, exponent or `+`), rejects negative estimates, and returns integer cents or a value rounded with `Math.round(x * 100) / 100`; use it in both forms and later in import (v0.6) and sync (v0.8). Show a clear message on rejection (e.g. "Use up to 2 decimals, max 999,999,999.99"). Verify: `0x1A`, `1e5`, `-5` (estimate) and `12.345` are rejected with that message; `12.50` and `-12.50` (amount) save.

**Resolution:** `parseMoney` (`src/budget/validate.ts`): plain decimals only, optional minus (amounts only), commas ignored, ≤ 2 decimals, ≤ 999,999,999.99; used by the Add form and Budget setup. Verified: `1e5`, `12.505`, `-5` (estimate) rejected; `-12.50`, `1,200` accepted.

### 3.3 — Letters in Amount report "cannot be empty" (Medium, Fixed)

CWE-20. Amount is `type="number"` (`src/components/ui/AmountInput.tsx:5`, used at `src/screens/AddBudget.tsx:93,101`). When the text is not a valid number (e.g. `12,50` in an English locale, or `abc` in Firefox, which allows typing it), the browser reports `value === ''`, so `validate` returns "Error: Amount cannot be empty" (`src/screens/AddBudget.tsx:31`) while the field visibly holds text. The format message at `:32` cannot fire for these inputs. Unclear user-facing error: Medium per the matrix.

Fix: either switch Amount and Estimate to `type="text" inputMode="decimal"` (as Budget setup already does) and validate with `parseMoney` (3.2), or check `input.validity.badInput` and show the format message. Verify: typing `abc` or `12,50` shows "Invalid: Amount use number format…", not "cannot be empty".

**Resolution:** The Add form reads `validity.badInput` and reports "use number format" instead of "cannot be empty".

### 3.4 — Monthly estimates do not equal themselves over a calendar month (Medium, Held till v0.4)

`estimateFor` returns `estimate * PER_MONTH[freq] * days / 30.44` (`src/budget/tree.ts:72-75`), and the month Total period has the real day count (`src/budget/tree.ts:89,110`). A monthly estimate of 100 shows 91.98 in a February total and 101.84 in a 31-day month; weekly columns clipped at the month edge (`src/budget/tree.ts:106`) get partial-week shares. Users typing "100 per month" expect 100 in the month total, and the Est. vs Act. comparison is off by up to 8%. Daily estimates are exact. This is a design choice, but it produces visibly different numbers from what was entered: Medium (incorrect output).

Fix: for the month Total, use `estimate * PER_MONTH[freq]` directly (a calendar month = 1 month); for week and day columns keep day-based scaling, using the actual days of the current month instead of 30.44 so the weekly columns add up to the Total. Verify: a 100/month item shows 100.00 in the Total for February and for March, and the week columns sum to it.

**Resolution:** Kept day-based by owner decision for now; exact month-based scaling is on `0003-roadmap.md` v0.4.

### 3.5 — Date input has no bounds and a cleared date silently becomes today (Low, Fixed)

CWE-20. `DatePicker` sets no `min`/`max` (`src/components/ui/DatePicker.tsx:4`); the value is stored as given (`src/screens/AddBudget.tsx:49`). A year like 1900 or 2099 saves, but the table only shows the current day/week/month (`src/budget/tree.ts:92-110`), so the amount is stored and never visible with no feedback. Browsers that allow 5- or 6-digit years break the `YYYY-MM-DD` string comparison (`src/budget/tree.ts:116`). Clearing the field silently swaps in today (`src/screens/AddBudget.tsx:114`), which may differ from what the user meant. Limited impact today: Low.

Fix: set `min`/`max` (e.g. 10 years back, 1 year ahead), check `/^\d{4}-\d{2}-\d{2}$/` and a real calendar date before saving, and if empty show "Error: Date cannot be empty" rather than replacing it. Mention in the saved status when the date is outside the current range. Verify: `0999-01-01` and an empty date are rejected with a message.

**Resolution:** Date input has `min` 2000-01-01 and `max` one year ahead; an empty date shows "Error: Date cannot be empty" instead of becoming today. Verified in browser.

### 3.6 — Add budget item saves recurrence where it does not apply (Low, Held till v0.3)

CWE-20. The Recurrence select is always shown (`src/screens/AddBudget.tsx:106-111`) and, whenever an estimate is entered, `frequency` is saved on any target (`src/screens/AddBudget.tsx:50-52`). Budget setup stores frequency only where `recurrenceApplies` (`src/screens/BudgetSetup.tsx:103`, rule at `src/budget/tree.ts:56`). So a Groceries estimate of 50 "per week" from Add budget item scales weekly (`src/budget/tree.ts:74`), while Budget setup hides the control and next save clears it to monthly — the same item's estimate changes meaning depending on the screen. Low.

Fix: show the Recurrence field only when `recurrenceApplies(target)`, and save `frequency: recurrenceApplies(target) ? frequency : undefined`. Verify: picking Groceries hides Recurrence and the saved category has no `frequency`.

**Resolution:** Owner decision: `0007-v0.3-design-updates.md` §4 removes Recurrence from the Add form in v0.3, which resolves this.

### 3.7 — Stored values trusted on read (Info, Held till v0.8)

CWE-20. Today only the app writes the database, and `<select>` limits frequency (cast at `src/screens/AddBudget.tsx:108`, `src/screens/BudgetSetup.tsx:195`). `estimateFor` looks up `PER_MONTH[c.frequency ?? 'month']` (`src/budget/tree.ts:74`) and sums `amount`/`estimate` without type checks (`src/budget/tree.ts:116,120`); an unknown frequency or a string/`NaN` value from synced or imported records (`0003-roadmap.md` v0.6, v0.8) would make totals `NaN` across the whole subtree. At sync, validate each record on read (frequency in `FREQUENCIES`, `amount`/`estimate` via `parseMoney` (3.2), date per 3.5, `parentId` pointing to an existing node with no cycle — `buildTree` attaches nodes only under found parents (`src/budget/tree.ts:19-22`), so nodes in a cycle never reach a root and silently vanish with their amounts) and reject or quarantine bad rows with a visible message. Verify at v0.8 review.

## Domain 4 - Web Frontend Security

**No exploitable browser-side weakness in current code.** The app loads only same-origin scripts and styles, has no external links, iframes, `postMessage`, object URLs, redirects or third-party resources, and keeps only a non-sensitive id list in `localStorage`. One hardening gap (no CSP, 4.1) and one manifest defect (4.2). Output escaping is covered in Domain 2 and not repeated. v0.1 Domain 4 ("No findings", `docs/audits/security/security-v0.1.md:12-13`) still holds for links and object URLs.

Evidence:

| Checked | Result |
|---------|--------|
| CSP / meta protections | None in source or build: `index.html:3-8`, `dist/index.html:3-10` (see 4.1) |
| Scripts and styles loaded | Same-origin only: bundle + CSS + `/registerSW.js` (`dist/index.html:8-10`); CSS imports are local files (`src/main.tsx:3-5`); no web fonts, CDN or analytics in `src/` or `index.html` |
| Links, `target`, `rel` | Only in-page `href="#fieldId"` anchors with `preventDefault` and `getElementById` focus (`src/components/ui/ErrorSummary.tsx:17`); no `target="_blank"`, no external URLs |
| `postMessage`, `window.open`, `location` writes, redirects, `iframe`, `createObjectURL` | 0 matches in `src/`, `index.html` |
| `<dialog>` focus | Native modal via `showModal()`, focus moved to the heading and returned to the opener on unmount (`src/screens/BudgetSetup.tsx:53-58`); Escape/close route through `onClose` (`src/screens/BudgetSetup.tsx:114,118`, `src/App.tsx:36`). No trap beyond the intended modal, nothing leaks focus to hidden content |
| `localStorage` | One fixed key holding collapsed category ids; read in `try/catch`, result used only for `Set.has`; write wrapped in `try/catch` (`src/components/BudgetTable.tsx:5-9,35`). No budget amounts, names or secrets stored there. Malformed values cannot do more than mis-collapse rows |
| Service worker scope | Registered at `/sw.js` with scope `/` (`dist/registerSW.js:1`); precaches build output only (`vite.config.ts:35-37`, `dist/sw.js:1`); navigation fallback to cached `index.html` (`dist/sw.js:1`); no runtime caching of cross-origin or API responses |
| Service worker update | `registerType: 'autoUpdate'` (`vite.config.ts:22`) generates `self.skipWaiting()` + `clientsClaim()` and `cleanupOutdatedCaches()` (`dist/sw.js:1`) (see 4.3) |
| PWA manifest | `display: standalone`, `start_url: '/'`, same-origin icon reference (`vite.config.ts:23-34`); icon file missing (see 4.2) |
| Framing | No framing defence possible from meta; header belongs to Domain 5 (see 4.4) |

### 4.1 — No Content Security Policy (Medium, Fixed)

CWE-693. Neither `index.html:3-8` nor the built `dist/index.html:3-10` carries a CSP. Domain 2 found no injection sink today, so this is defense in depth (best-practice hardening is Medium under the matrix). It matters more as v0.6 HTML import, v0.7 charts and v0.8 sync bring untrusted content and network endpoints. The app is fully same-origin with no inline scripts (`dist/index.html:8-10`), so a strict policy works as a meta tag.

Fix: add to `index.html` `<head>`, before any script:
`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">`
Check whether React/Vite emit any inline style attributes needing `style-src-attr 'unsafe-inline'` (React `style={}` props are set via CSSOM and are not blocked). Note `vite dev` injects inline scripts for HMR, so apply the meta only to the production build (e.g. a `transformIndexHtml` hook with `apply: 'build'`) or accept a looser dev policy. Extend `connect-src` with the sync origin at v0.8. Verify: `npm run build && npm run preview`, app loads, service worker installs, console shows no CSP violations; an injected `<script>alert(1)</script>` via devtools `innerHTML` does not run.

**Resolution:** Production builds get a CSP `<meta>` (`vite.config.ts`, `csp-meta` plugin): `default-src 'self'`, no inline script or style, `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`. Dev server is excluded (it injects inline scripts). Verified: no CSP violations in the built app; Lighthouse a11y still 100. Header delivery stays with 5.1.

### 4.2 — Manifest icon points to a missing file (Low, Fixed)

The manifest's only icon is `/vite.svg` (`vite.config.ts:31-33`), but that file lives at `src/assets/vite.svg`, not `public/`, and `dist/vite.svg` does not exist. Browsers fall back to a generic icon or refuse the install prompt (Chrome requires a 192px and 512px icon). Not a security issue; noted because the manifest is in scope.

Fix: point the manifest at an icon in `public/` (e.g. `/favicon.svg`) and add 192×192 and 512×512 PNGs. Verify: after build, `dist/` contains every icon `src` listed in `dist/manifest.webmanifest`, and Chrome DevTools > Application > Manifest shows no icon errors.

**Resolution:** `vite.svg` moved from `src/assets/` to `public/`, so the manifest icon is served and precached.

### 4.3 — Immediate service worker takeover (Info, Held till v0.8)

`autoUpdate` makes the new worker call `skipWaiting()` and `clientsClaim()` (`vite.config.ts:22`, `dist/sw.js:1`), so a deploy takes over open tabs without a prompt. Today the app is one bundle with no server, so an old tab keeps working. When sync arrives (`0003-roadmap.md` v0.8), an old tab could talk to a changed API or Dexie schema. Then either switch to `registerType: 'prompt'` with a "reload to update" message, or version the sync protocol so the server rejects stale clients with a clear error (Domain 8). Verify at v0.8 review.

### 4.4 — Clickjacking protection needs a header (Info, Held till v0.8)

CWE-1021. `frame-ancestors` is ignored in a meta CSP, and `X-Frame-Options` is header-only, so 4.1 cannot cover framing. The app has no hosting config in the repo. When it is deployed for sync (`0003-roadmap.md` v0.8), the host must send `Content-Security-Policy: frame-ancestors 'none'` (or `X-Frame-Options: DENY`). Tracked under Domain 5 (Configuration); verify there.

### 4.5 — Trusted Types once HTML-producing code arrives (Info, Held till v0.6)

CWE-79. No DOM HTML sinks exist (Domain 2 evidence), so Trusted Types adds nothing today. When v0.6 HTML import (2.2) or v0.7 charts (2.5) land, add `require-trusted-types-for 'script'; trusted-types 'none'` (or a named policy for an audited library) to the 4.1 CSP so any accidental `innerHTML` write fails in supporting browsers. Verify at v0.6 review.

## Domain 5 - Configuration

**No exploitable configuration issue in current code.** There is no backend and no hosting config yet, so most of this domain is requirements for the distribution host (`0003-roadmap.md` v0.9) and the sync backend (`0003-roadmap.md` v0.8). One Low `.gitignore` gap applies now. CSP was deferred here from Domain 2 as defense in depth for XSS.

Evidence:

| Checked | Result |
|---------|--------|
| Dev/preview server binding | No `server`/`preview` block in `vite.config.ts:5-27`; scripts are plain `vite` / `vite preview` with no `--host` (`package.json:6-11`). Vite 8 defaults to `localhost` (see 5.5) |
| Production sourcemaps | No `build.sourcemap` in `vite.config.ts:5-27` (Vite default `false`); `dist/` contains no `sourceMappingURL` (grep, 0 matches) |
| Build script | `tsc -b && vite build` (`package.json:8`) |
| PWA / Workbox | `registerType: 'autoUpdate'` (`vite.config.ts:9`); precache build output only (`vite.config.ts:22-24`); no runtime caching of external origins; manifest has no secrets (`vite.config.ts:10-21`) |
| Built page scripts | `dist/index.html` loads only same-origin external scripts (`/assets/index-*.js`, `/registerSW.js`); no inline script, so a strict `script-src 'self'` works (cross-ref `index.html:1-13`) |
| Security headers / hosting | No `_headers`, `netlify.toml`, `vercel.json`, nginx or other host config in the repo; `index.html:3-8` has no CSP `<meta>` |
| `.gitignore` | `node_modules/` (`.gitignore:2`), `dist/` `build/` `out/` (`.gitignore:5-7`), `.env` `.env.local` `.env.*.local` (`.gitignore:10-12`), logs, IDE, `.claude/` |
| Network calls / backend | None (Domain 1 evidence: 0 `fetch(` matches) |
| v0.1 Domain 5 | "No findings"; network config (CORS, proxy, body limits, rate limiting, auth) deferred to sync (`docs/audits/security/security-v0.1.md:15-16`), see 5.4 |

### 5.1 — Security headers required from the static host (Medium, Held till v0.9)

CWE-1021, CWE-693. Nothing in the repo sets response headers (evidence above), so whatever host is chosen at `0003-roadmap.md` v0.9 will serve the app with its own defaults. Without them, the page can be framed (clickjacking), an XSS bug has no second line of defense, and the referrer can leak URLs. Budget data lives on the same origin (IndexedDB), so a script-injection bug would read all of it.

Fix: the host must send, on every response:
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` (add the sync origin to `connect-src` at v0.8; check whether React inline `style` props need `style-src 'unsafe-inline'` and record that if so)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()` (revisit `camera` for receipt photos post-v1)
- `Cache-Control: no-cache` on `/sw.js`, `/registerSW.js`, `/index.html` and `manifest.webmanifest`, so `autoUpdate` (`vite.config.ts:9`) picks up security fixes promptly

Keep the host config in the repo so it is reviewed with the code. Verify: `curl -sI https://<host>/` and `/sw.js` show every header; the browser console shows no CSP violations while using every screen; securityheaders.com scores A or better.

### 5.2 — HTTPS-only distribution (Medium, Held till v0.9)

CWE-319. Service workers only register on HTTPS (or localhost), but a host that also answers on plain HTTP lets a network attacker serve a modified first page. Since the service worker then controls the origin and auto-updates (`vite.config.ts:9`), a tampered bundle would keep running from cache.

Fix: serve only over HTTPS (TLS 1.2+); redirect HTTP to HTTPS with 301; send `Strict-Transport-Security: max-age=31536000; includeSubDomains` (add `preload` only if the domain is dedicated). The sync endpoint at v0.8 follows the same rule. Verify: `curl -sI http://<host>/` returns 301 to `https://`; HTTPS responses carry the HSTS header; SSL Labs grade A.

### 5.3 — `.gitignore` misses mode-specific `.env` files (Low, Fixed)

CWE-538. `.gitignore:10-12` covers `.env`, `.env.local` and `.env.*.local`, but not `.env.production` / `.env.development` / `.env.staging`, which Vite loads by mode. Sync credentials or endpoints (v0.8) are the likely first entries. Also note that any `VITE_`-prefixed variable is inlined into the public bundle, so client secrets must never go in env files at all (cross-ref 5.4).

Fix: replace `.gitignore:10-12` with `.env` and `.env.*`, plus `!.env.example` if a template is wanted. Verify: `touch .env.production && git status --porcelain` shows nothing; remove the file afterwards.

**Resolution:** `.gitignore` now ignores `.env` and `.env.*` (except `.env.example`).

### 5.4 — Sync backend configuration (Medium, Held till v0.8) ⚠ REQUIRES REVIEW BEFORE PROCEEDING

CWE-306, CWE-942, CWE-770, CWE-209. v0.1 deferred all network config to sync (`docs/audits/security/security-v0.1.md:16`; it named v0.4, the roadmap now places sync at `0003-roadmap.md` v0.8). It was not tagged `NETWORK-ONLY`, but it is the same kind of deferral, so per the networked matrix's standing rule it is surfaced and re-rated here: from "no finding" to Medium (requirement), rising to High if any item below is missing when sync ships, because budget data would reach a remote attacker. Before v0.8 work proceeds, confirm:
- **Auth:** every sync request is authenticated (OnlyOffice tokens/OAuth); tokens are not stored in `localStorage` or env-bundled (`VITE_*`); scoped to the one document; revocable.
- **CORS:** if a proxy/backend is added, `Access-Control-Allow-Origin` is the exact app origin, never `*` with credentials and never reflected.
- **Rate limiting and body limits:** the backend or proxy caps request size and request rate per token; the client caps the size of documents it pulls (cross-ref 1.3).
- **Error leakage:** server errors return generic messages, no stack traces or upstream URLs (Domain 8).
- **Transport:** HTTPS only (5.2); add the sync origin to CSP `connect-src` (5.1).

Verify at the v0.8 security review: an unauthenticated request is rejected; a cross-origin request from another origin is blocked; an oversized body returns 413; a burst returns 429; a forced error body contains no stack trace.

### 5.5 — Localhost-only dev servers and no production sourcemaps (Info, Fixed)

`vite.config.ts:5-27` sets no `server.host`/`preview.host`, and `package.json:7,10` pass no `--host`, so `vite` and `vite preview` bind to `localhost` only and are not reachable from the LAN. No `build.sourcemap` is set, and `dist/` has no `sourceMappingURL`, so original source is not published. Keep both: if LAN testing on a phone is needed, use `--host` only for that session, never in `package.json`. Verify after any config change: `ss -ltn` shows the dev port on `127.0.0.1`/`::1`, and `grep -r sourceMappingURL dist` is empty.

## Domain 6 - Data Protection

**One Critical, four Medium, one Low against current code.** v0.1 Domain 6 noted plaintext IndexedDB with encryption deferred (`docs/audits/security/security-v0.1.md:18-19`); that is carried as 6.6. The main new risk is loss, not exposure: data lives only in best-effort browser storage with no persistence request and no backup.

Evidence:

| Checked | Result |
|---------|--------|
| What is persisted | IndexedDB `simple-budget`: `budgetItems` (category id, amount, date, timestamps), `categories` (name, color, parent, estimate, frequency, autopay, due date), `settings` (`src/storage/db.ts:11-50,52-58`). Writes via `src/storage/repository.ts:3-40`; seed tree is fixed app data (`src/storage/seed.ts:11-36,38-52`) |
| localStorage | One key `simple-budget:collapsed` holding a JSON id array (`src/components/BudgetTable.tsx:5,8,35`) |
| Encryption at rest | None; rows stored as plain objects (`src/storage/repository.ts:6,16`) |
| `navigator.storage.persist` / `estimate` | 0 matches in `src/` |
| Export / import / backup | None present in `src/`; not on `0003-roadmap.md` before v0.8 |
| Upgrade atomicity | Dexie 4.4.7 runs all upgraders on the native `versionchange` transaction and rejects it on any error (`node_modules/dexie/dist/dexie.js:3744-3748,3761-3765,4547-4553`) |
| Startup | `seedCategories().then(render)` with no `.catch` (`src/main.tsx:9-15`) |
| Read-side validation | Totals add `i.amount` from rows with no type check (`src/budget/tree.ts:116`) |
| Console output | Single `console.error(err)` (`src/screens/AddBudget.tsx:61`) |
| Service worker | Workbox `globPatterns` for build files only, no runtime caching (`vite.config.ts:22-24`) |

### 6.1 — Storage not marked persistent; browser may evict all data (Critical, Fixed)

CWE-1188. Nothing calls `navigator.storage.persist()` (evidence table), so the origin's IndexedDB is best-effort. Browsers may delete best-effort data without telling the user: under storage pressure (Chromium, Firefox), and Safari removes script-writable storage for sites not used for 7 days unless installed to the home screen. Since the app holds the only copy (6.2), eviction is silent loss of all user data, which the matrix rates Critical. Likelihood depends on browser and usage, but nothing in the app reduces it.

Fix: at startup call `navigator.storage?.persist?.()` (after `navigator.storage.persisted()` returns false); if it returns false, show a one-time notice suggesting installing the app and exporting a backup (6.2). Verify: in Chromium devtools Application > Storage shows "Persistent"; on refusal the notice appears.

**Resolution:** The app calls `navigator.storage.persist()` at startup; if the browser refuses, a dismissible notice explains the risk and recommends installing the app and exporting backups.

### 6.2 — No export or backup (Medium, Fixed)

No export, import or backup exists (evidence table), so eviction (6.1), "Clear site data", or a lost device is unrecoverable until v0.8 sync. Best-practice gap, so Medium; it is what turns 6.1 into total loss.

Fix: Settings > "Export data" writing all three tables to a versioned JSON file, and "Import" that validates the shape (6.5) and asks before replacing. Verify: export, clear site data, import, totals match. Cross-ref 1.1 for file-input checks on import.

**Resolution:** New Backup section: Export backup saves a JSON file of all data; Restore checks the file (≤ 5 MB, `.json`, format/version, every row's shape, category references) before showing a confirmation, then replaces all data in one transaction. Verified export → restore round trip and rejection of a non-backup file. Full import/export is on `0003-roadmap.md` v0.6.

### 6.3 — v5 migration can misfile amounts with repeated names (Medium, merged into 3.1)

Same issue as 3.1; see 3.1 for evidence and fix.

### 6.4 — Blank page when the database fails to open (Medium, merged into 8.1)

Same issue as 8.1; see 8.1 for evidence and fix.

### 6.5 — Stored rows used without shape checks (Low, Fixed)

CWE-20. Rows from Dexie are trusted as typed: `actualFor` adds `i.amount` and compares `i.date` as strings (`src/budget/tree.ts:116`). A corrupted row (string amount, missing date) gives string concatenation or silently omits the row, with no error. Only app code writes rows today (input is checked at `src/screens/AddBudget.tsx:32-33`), so impact is limited. This becomes untrusted input once sync (v0.8) or import (6.2) writes rows.

Fix: a `isBudgetItem(row)` guard (finite `amount`, `YYYY-MM-DD` `date`, integer `categoryId`) applied on list and on any import/sync write; drop or report invalid rows. Verify: a hand-inserted row `{ amount: "5" }` is ignored and totals stay numeric.

**Resolution:** `budgetItemRepo.list` and `categoryRepo.list` drop rows that fail a shape check (integer ids, finite amounts within range, `YYYY-MM-DD` dates, known frequencies); the app shows how many records were left out. Settings fall back to safe defaults.

### 6.6 — Financial data stored in plaintext (Medium, Held till v0.8)

CWE-312. All tables are stored unencrypted (evidence table); anyone with access to the unlocked device or browser profile, or a malicious extension with site access, can read amounts, due dates and the list of subscriptions and debts. This is the normal browser model and data does not leave the machine, so this is a hardening item (Medium), carried from v0.1. `0003-roadmap.md` v0.8 lists optional passphrase client-side encryption; apply it to the local store as well as the synced copy, or record why local-only encryption is not worth it (the key would have to live next to the data).

### 6.7 — Sync encryption and passphrase requirements (Info, Held till v0.8)

CWE-311. When `0003-roadmap.md` v0.8 sync sends data off the device (High under the matrix if exposed), it must use TLS only; derive the encryption key from the passphrase with a slow KDF (PBKDF2 ≥600k iterations or Argon2id) and a random salt, using AES-GCM with a unique IV per record; never store or send the passphrase or key, and keep any cached key in memory or a non-extractable `CryptoKey`; tell the user plainly that a lost passphrase means the synced copy is unrecoverable; and send only the fields needed (no device-specific `settings`). Tombstones must not keep deleted names in clear. Verify at the v0.8 review.

### 6.8 — localStorage parsed defensively (Info, Fixed)

`JSON.parse` and `localStorage` access are wrapped in `try/catch` with a safe default (`src/components/BudgetTable.tsx:8,35`). `new Set` on a non-iterable throws inside the same `try`; a string becomes a set of characters, which only affects `Set.has` on numeric ids. No sensitive data is stored there. No action.

### 6.9 — v5 upgrade is atomic (Info, Fixed)

Dexie runs every `upgrade()` on the native `versionchange` transaction and calls `rejectTransaction` on any error (`node_modules/dexie/dist/dexie.js:3744-3748,3761-3765`), which aborts it; IndexedDB then rolls back all writes and the version stays at 4. The upgrade awaits only Dexie operations on `tx` (`src/storage/db.ts:67-105`), so the transaction does not auto-commit early. A throw mid-way leaves the v4 data intact; the visible symptom is 6.4. Keep future upgrades free of non-Dexie `await`s (e.g. `fetch`), which would commit the transaction early.

### 6.10 — Console logging (Info, Fixed)

`console.error(err)` on a failed save (`src/screens/AddBudget.tsx:61`) logs a Dexie error to the local devtools only; the user gets a plain message (`:62`). Nothing is sent off-device. When remote error reporting is added, send the error name only, never record contents (cross-ref Domain 8).

### 6.11 — Service worker does not cache data (Info, Fixed)

Workbox precaches build files only and has no runtime caching rules (`vite.config.ts:22-24`); with no `fetch` in the app, no budget data enters Cache Storage. Re-check at v0.8 that sync API responses are excluded from any runtime caching.

## Domain 7 - Secure Coding and Architecture

**No exploitable issue in shipped code.** Runtime has three dependencies and zero advisories; storage sits behind a repository layer; business logic in `src/budget/tree.ts` is pure. v0.1 Domain 7 ("No findings", `docs/audits/security/security-v0.1.md:21-22`) still holds for the runtime; v0.2 adds the dev-only advisories and a few cleanup items below.

Evidence:

| Checked | Result |
|---------|--------|
| `npm audit --omit=dev --json` | 0 vulnerabilities; 5 prod packages |
| `npm audit --json` | 10 (2 low, 8 moderate, 0 high/critical), all under `vite-plugin-pwa` → `workbox-build` (7.1). `lighthouse` (newly added dev dependency, `package.json:22`) has no advisories |
| Runtime deps | `dexie`, `react`, `react-dom` only (`package.json:12-16`); `npm ls --depth=0` shows nothing extraneous |
| `npm outdated` | Minor updates only (`@vitejs/plugin-react`, `lighthouse`, `oxlint`); majors available for `@types/node` and `typescript` 7. None security-related |
| Lockfile | `package-lock.json` tracked in git (`git ls-files`), `lockfileVersion` 3 (`package-lock.json:4`), 521 `integrity` hashes |
| Storage access | UI imports only `./storage/repository` (`src/App.tsx:5`, `src/screens/BudgetSetup.tsx:3`, `src/screens/AddBudget.tsx:3`); other `storage/db` imports are `import type` (`src/App.tsx:6`, `src/budget/tree.ts:3`, `src/components/BudgetTable.tsx:2`, `src/screens/Budget.tsx:2`, `src/screens/BudgetSetup.tsx:4`, `src/screens/AddBudget.tsx:4`). `main.tsx:7` imports `seedCategories` from the storage layer for first-run seeding, which is fine. No `db.` or `useLiveQuery` in any `.tsx` |
| Business logic | `buildTree`, `entryTarget`, `estimateFor`, `periodsFor`, `actualFor` (`src/budget/tree.ts:15,45,72,92,114`) take data and return values; no storage or DOM access |
| TypeScript | `tsconfig.app.json` / `tsconfig.node.json` set `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, no `strict` key; `tsc --showConfig` lists no strict flags; TS 6.0.3 compile of a probe file with no config reported TS7006 (implicit any) and TS2322 (null to string), confirming strict defaults on (7.2) |
| Non-null assertions | `src/main.tsx:10` (`#root`, standard), `src/screens/AddBudget.tsx:49,51,53`, `src/storage/db.ts:75,91,99,103` (7.5) |

### 7.1 — Dev-only advisories in the PWA build chain (Low, Not Fixed)

`npm audit` flags `glob` (GHSA-3g3m-2fjr-6pw4), `minimatch` (GHSA-g3hv-75wg-m249), `deepmerge` (GHSA-gcqx-w48m-w2h4) and the `ejs`/`jake`/`filelist` chain, all reached only through `vite-plugin-pwa@2.0.0` → `workbox-build` (`package.json:24`). These run on the developer's machine during `vite build` against the project's own files; none of their code is in `dist/`, and the prod audit is clean. Under the networked matrix a remote attacker cannot reach them, so they are rated Low, not Medium (CWE-1395, vulnerable third-party component). npm's offered fix is downgrading to `vite-plugin-pwa@1.1.0` (major change); do not take it.

Fix: watch for a `vite-plugin-pwa`/`workbox-build` release that clears them; or add `overrides` for `glob`/`minimatch` to patched versions if the build still passes. Verify: `npm audit --json` shows 0 under `workbox-build`; `npm audit --omit=dev` stays 0.

**Resolution:** npm `overrides` were approved, but the newest releases at least two weeks old (glob 13.0.6, minimatch 10.2.6, deepmerge 4.3.1) are still inside the advisory ranges, so an override can't fix them; only ejs has a fix (a 3 → 7 major jump) for one of ten advisories. Re-check when upstream releases fixes.

### 7.2 — `strict` relies on the TypeScript 6 default (Low, Fixed)

No `"strict"` in `tsconfig.app.json:2-26` or `tsconfig.node.json`. Strict null and implicit-any checks are active only through the TS 6 default (see evidence). Fix: add `"strict": true` to both configs' `compilerOptions`. Verify: `npx tsc -p tsconfig.app.json --showConfig` lists `"strict": true`; `npm run build` passes.

**Resolution:** `"strict": true` set in `tsconfig.app.json` and `tsconfig.node.json`; build passes.

### 7.3 — Unused UI components (Low, Fixed)

`DropdownWithSearch` (`src/components/ui/DropdownWithSearch.tsx`, 70 lines) and `CheckboxGroup` (`src/components/ui/CheckboxGroup.tsx`, 5 lines) are re-exported at `src/components/ui/index.ts:4,6`, but `grep` finds no other import in `src/`. Item selection uses `ItemSelector` instead. Dead input-handling code adds review surface (CWE-1164). Fix: delete both files and their two barrel lines. Verify: `grep -rn "DropdownWithSearch\|CheckboxGroup" src` returns nothing; build passes. Note this also removes the `src/components/ui/DropdownWithSearch.tsx:10` input listed in Domain 1 evidence.

**Resolution:** `DropdownWithSearch.tsx` and `CheckboxGroup.tsx` deleted and removed from the UI barrel.

### 7.4 — Caret version ranges (Info, Not Fixed)

All three runtime deps and all dev deps except `typescript` (`~6.0.3`) use `^` (`package.json:12-26`). The committed lockfile (see evidence) pins exact versions and hashes, so builds are reproducible as long as installs use `npm ci`. Use `npm ci` in any CI or deploy pipeline added for v0.8.

### 7.5 — Non-null assertions on data (Info, Not Fixed)

`target!` at `src/screens/AddBudget.tsx:49,51,53` is safe because `validate()` sets an error when `!target` (`AddBudget.tsx:30`) and `save()` returns early on any error (`AddBudget.tsx:42-46`). Migration `id!` uses (`src/storage/db.ts:75,91,99,103`) apply to rows just read from or added to IndexedDB, where Dexie always sets `id`. Optional cleanup: narrow once (`const t = target; if (!t) return`) so the compiler checks it.

### 7.6 — Template package name (Info, Not Fixed)

`package.json:2` `"name": "scaffold"`; `"private": true` (`package.json:3`) prevents publishing. Fix: rename to e.g. `simple-budget`. Verify: `npm ls --depth=0` header shows the new name.

### 7.7 — Data model not yet sync-ready (Info, Held till v0.8)

For `0003-roadmap.md` v0.8 (multi-device sync) the sync adapter can plug in behind `src/storage/repository.ts`, since the UI uses only that layer. The data model needs three changes first (CWE-694, use of multiple resources with duplicate identifier):
- ids are per-device auto-increment (`++id`, `src/storage/db.ts:59-66`); two devices will assign the same id to different rows. Use UUIDs or a device-prefixed id.
- `Category` has no `updatedAt` (`src/storage/db.ts:27-42`) and `categoryRepo.update`/`updateMany`/`rename` do not stamp one (`src/storage/repository.ts:18-25`); `budgetItemRepo` does (`repository.ts:5-10`). Conflict resolution needs it on every synced table.
- `remove` hard-deletes (`repository.ts:12,26`), so a delete cannot propagate. Add a soft-delete/tombstone field.

Synced values must also pass the checks in 2.3 and 2.4. Verify at the v0.8 review.

## Domain 8 - Security Logging and Error Handling

**Four Medium gaps, all one cause: only the Add flow handles storage errors.** Every other storage call either has no `catch` or is not awaited by anything that has one, so any IndexedDB failure (storage disabled by browser policy or private-browsing settings, quota exceeded, `VersionError` after a downgrade, blocked upgrade) reaches the user as a blank page, an empty table, or nothing at all. Under the networked matrix an unclear or unhandled user-facing error is at least Medium. No verbose error detail reaches the UI; no server-side logging exists yet (8.8).

Evidence:

| Checked | Result |
|---------|--------|
| `src/` for `catch`, `onerror`, `unhandledrejection`, `ErrorBoundary`, `componentDidCatch`, `on('blocked'`, `versionchange`, `console.` | Only `src/screens/AddBudget.tsx:60-61` and two `localStorage` guards (`src/components/BudgetTable.tsx:8,35`) |
| Startup | `seedCategories().then(render)`, no `catch` (`src/main.tsx:9-15`); seeding opens the database via `count()`/`transaction` (`src/storage/seed.ts:38-52`) |
| Initial loads | `categoryRepo.list().then(setCats)`, `budgetItemRepo.list().then(setItems)`, `settingsRepo.get().then(...)`, no `catch` (`src/App.tsx:16-23`); state defaults are empty arrays and `'day'` (`src/App.tsx:10-14`) |
| Reloads after writes | `onSaved` / `onChanged` call the same uncaught loaders (`src/App.tsx:30,37`) |
| Add flow | `try/catch/finally` around both writes with status message (`src/screens/AddBudget.tsx:47-65`), shown in `role="status"` (`src/screens/AddBudget.tsx:118`) |
| Budget setup | `addItem` awaits `categoryRepo.add` with no `try` (`src/screens/BudgetSetup.tsx:71-82`); `save` awaits `updateMany` then `settingsRepo.update` with no `try` (`src/screens/BudgetSetup.tsx:89-111`); both called from un-awaited handlers (`src/screens/BudgetSetup.tsx:150-151,231`) |
| Repository | Thin pass-throughs, no error handling (`src/storage/repository.ts:3-41`); `settingsRepo.update` does a separate `get` then `update`, not one transaction (`src/storage/repository.ts:37-40`) |
| Dexie setup | Five versions with a v5 data migration, no `db.on('blocked')`, `on('versionchange')` or `on('close')` handlers (`src/storage/db.ts:52-109`) |
| Error wording | Field errors follow the "Error:/Invalid:" format (`src/screens/AddBudget.tsx:30-33`, `src/screens/BudgetSetup.tsx:75,93`); error summary/focus rule implemented (`src/components/ui/errors.ts:9-13`) |

### 8.1 — Startup failure leaves a blank page (Medium, Fixed)

CWE-755. `src/main.tsx:9-15` renders only inside `seedCategories().then(...)`. If the database can't open or the seed transaction fails (`src/storage/seed.ts:38-52`), the promise rejects, nothing is rendered, and the only trace is an unhandled rejection in the console. Realistic causes: IndexedDB blocked by browser or enterprise policy or by private-browsing settings on some browsers, `QuotaExceededError`, `VersionError` when a newer build's database meets an older cached service-worker build, or a v5 upgrade that throws (`src/storage/db.ts:65-105`).

Fix: render unconditionally and handle seeding in the result, e.g. `seedCategories().then(renderApp, err => renderStartupError(err))`, where the error screen is plain HTML with an `<h1>`, text such as "Error: Simple Budget can't open its storage on this device. Check that site storage is allowed, then reload.", and a Reload button; give the error name only, not the stack. Verify: in DevTools, block site storage (or stub `db.open` to reject) and reload; the message appears instead of a blank page and is read by a screen reader.

**Resolution:** `main.tsx` catches startup failure and renders a plain message chosen by error type (storage full, blocked/private window, newer data, other). Verified with IndexedDB removed: message shown, no blank page.

### 8.2 — Load failures look like "no data" (Medium, Fixed)

CWE-755. The three initial loads (`src/App.tsx:16-23`) and the reloads after a save (`src/App.tsx:30,37`) have no `catch`. On failure the state keeps its defaults (`src/App.tsx:10-14`), so the table renders empty and the range falls back to Day; a user with stored data is shown what looks like an empty budget, which invites re-entering data. After an Add, the Add flow announces "Saved …" (`src/screens/AddBudget.tsx:53`) even if the follow-up reload fails, so the table and the message disagree.

Fix: track a `loadError` state; add `.catch(() => setLoadError(true))` to every loader; when set, show a `role="alert"` message above the table ("Error: Your budget couldn't be loaded. Reload to try again.") and do not render the empty table as if it were real. Verify: stub `categoryRepo.list` to reject; the alert appears and the table is not shown as empty.

**Resolution:** Initial and post-save loads in `App.tsx` catch failures and show "Error: Your budget couldn’t be loaded".

### 8.3 — Budget setup Save and Create fail silently (Medium, Fixed)

CWE-755. `addItem` (`src/screens/BudgetSetup.tsx:71-82`) and `save` (`src/screens/BudgetSetup.tsx:89-111`) await storage with no `try`, and the click/Enter handlers don't await them (`src/screens/BudgetSetup.tsx:150-151,231`), so a rejection is unhandled: no status, no error, the dialog stays as it was. In `save`, `updateMany` commits in its own transaction before `settingsRepo.update` runs (`src/storage/repository.ts:20-24,37-40`), so a failure in the second step leaves estimates saved but the default range not, with nothing telling the user. This is the v0.1 8.1 gap reappearing in code added in v0.2.

Fix: wrap both bodies in `try/catch` as in `src/screens/AddBudget.tsx:47-65`; on failure set the existing `role="status"` text (`src/screens/BudgetSetup.tsx:232`) to e.g. "Error: Your estimates weren't saved. Try again." / "Error: {name} wasn't created. Try again."; put the category and settings writes in one `db.transaction('rw', db.categories, db.settings, …)` so Save is all-or-nothing; disable Save while saving. Verify: stub `categoryRepo.updateMany` to reject; the message is announced and no partial change is stored.

**Resolution:** Budget setup Save and Create catch failures and show an error; Save writes category patches and the default range in one transaction (`saveSetup`), so it can't half-save.

### 8.4 — Blocked or interrupted database upgrades are not handled (Medium, Fixed)

CWE-755. `src/storage/db.ts:52-109` registers no `blocked`, `versionchange` or `close` handlers. Two realistic cases with a PWA open in several tabs: (a) a new build with a higher schema version opens while an old tab holds the database — the upgrade waits, `seedCategories` never settles, and the new tab stays blank (same visible result as 8.1, but no error is ever raised); (b) Dexie's default closes the old tab's connection on `versionchange`, after which every write there fails with `DatabaseClosedError`, silently outside the Add flow (8.3). Any future schema version bump will hit this.

Fix: `db.on('blocked', () => showBanner('Close other Simple Budget tabs to finish updating.'))`; `db.on('versionchange', () => { db.close(); showBanner('Simple Budget was updated in another tab. Reload to continue.') })`; show both in a `role="alert"` region. Verify: open two tabs, raise the version in one build, and confirm the blocked message in the new tab and the reload message in the old one.

**Resolution:** `db.ts` publishes `blocked` and `versionchange` events (closing the database on `versionchange`); the app shows what to do (close other tabs / reload).

### 8.5 — No React error boundary (Medium, Fixed)

CWE-248. No error boundary exists anywhere in `src/` (evidence table). An exception during render — e.g. tree building over unexpected stored or, after v0.8, synced data (`src/App.tsx:25`) — unmounts the whole tree under `src/main.tsx:10-14`, leaving a blank page.

Fix: one class component with `getDerivedStateFromError` wrapping `<App />` in `src/main.tsx`, rendering a heading, "Error: Something went wrong while showing your budget. Your saved data is unchanged.", and a Reload button; no stack in the UI. Verify: throw in a component under a test flag; the fallback renders and receives focus.

**Resolution:** `ErrorBoundary` wraps the app and shows a recovery message instead of a blank page.

### 8.6 — Raw error object written to the console (Low, Fixed)

CWE-532. `src/screens/AddBudget.tsx:61` logs the whole caught error. Dexie errors can include the failing key or operation details; today this stays in the device's own console, so impact is limited. The risk is the pattern: when sync (v0.8) or any remote error reporting is added, logging the raw object would send budget details off the device (see 8.8).

Fix: log a fixed message and `err.name` only (`console.error('Add save failed:', (err as Error)?.name)`), and use the same helper for the new catches in 8.1–8.4. Verify: trigger a failed save; the console shows the message and error name only.

**Resolution:** All `console.error` calls log only the error name and message.

### 8.7 — v0.1 8.1 still holds in the Add flow (Info, Fixed)

Re-checked after the v0.2 rewrite: both Add writes are inside `try/catch/finally`, failure sets "The item wasn’t saved. Try again." and the Save button is disabled while saving (`src/screens/AddBudget.tsx:47-65,117`), announced through `role="status"` (`src/screens/AddBudget.tsx:118`). Wording note for the 8.3 fix: start storage-failure messages with "Error:" to match the field-error format in the digital accessibility standard, and use `role="alert"` for failures so they are not missed alongside success messages.

### 8.8 — Server-side logging and error responses with sync (Info, Held till v0.8)

CWE-209, CWE-778. `0003-roadmap.md` v0.8 (Sync) adds the first server. At that review: log authentication, sync conflicts and rejected requests with time, device and outcome, never amounts, names or tokens; return generic error bodies with no stack traces or library versions; show the client a clear message for each sync failure (offline, conflict, rejected) per this domain's Medium floor.
