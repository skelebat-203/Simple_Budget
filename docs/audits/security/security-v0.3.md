# Security Review — v0.3 (NETWORKED matrix)

Scope: v0.3 at v0.3.15 (fixes applied after) — PWA (Vite + React + Dexie IndexedDB), no backend yet. Rated under `issue-severity-matrix_NETWORKED.md` as in v0.1–v0.2 (sync planned for v0.8). Domains per `security-domains.md`, ASVS 5.0.0 chapter names. Open items from `security-v0.2.md` are carried forward with their v0.2 IDs (prefixed `v0.2`); new findings are numbered in this file.

## Summary

### Executive summary

All 8 domains reviewed. v0.3 added the Income group and Dexie v7 upgrade, recurrence and calendar settings, the Budget setup treegrid, the new-item flow, and editing and deleting from the budget tables. The review focused on the new data paths: the v7 upgrade, backup restore of the new structure, table edits and deletes, and names reaching element ids.

One High was found and fixed: a hand-made or damaged backup could restore a category chain deep enough to crash the app on every load, or a loop that hid rows and their amounts from all totals. Restore now rejects both, and loading skips any such rows already stored. A Medium (a delete that fails because the row changed shows a misleading "Try again") and two Lows (unchecked fields and duplicate ids in a backup) are fixed. The shipped runtime has no dependency advisories, the production CSP reports no violations, and v0.2 3.6 (Add form recurrence) is fixed by the v0.3 Add form. The remaining open items are held for the versions that bring their feature (sync, import, hosting).

Totals (new): 1 High (fixed), 1 Medium (fixed), 2 Low (fixed), 6 Info. Carried from v0.2: 1 fixed in v0.3, 24 still held or not fixed.

### Summary table

| ID | Severity | CWE | Status | Issue |
| --- | --- | --- | --- | --- |
| 2.1 | Info | — | Fixed | DOM ids now include category names (slugged to letters, digits and hyphens plus the numeric id), so names reach `id`, `aria-labelledby` and `getElementById` but cannot inject or collide. |
| 3.1 | High | CWE-674, CWE-400, CWE-20 | Fixed | Backup restore accepted category trees with parent loops or unlimited depth; a 20,000-level chain overflowed the stack on every load, and a loop silently hid rows and their amounts from every total. |
| 3.2 | Low | CWE-20 | Fixed | Restore did not type-check a category's due date, autopay, selected or computed fields, so a value such as `dueDate: "soon"` was stored and shown in the Week and Month tables as "Invalid Date". |
| 3.3 | Low | CWE-20 | Fixed | Restore did not reject duplicate category ids; the write then failed inside the restore transaction with the generic restore error instead of saying the file's category list was damaged. |
| 3.4 | Info | CWE-20 | Held till v0.8 | Sibling-name uniqueness for rename and Create is enforced in the UI only; when sync writes names from another device, the repository must enforce it too, or duplicate names reach the tables. |
| 4.1 | Info | — | Fixed | Budget setup sets one CSS custom property through the CSSOM (`style.setProperty`); CSP `style-src 'self'` allows CSSOM changes, and the production build reports no CSP violations in any flow. |
| 6.1 | Info | — | Fixed | The Dexie v7 upgrade runs only Dexie operations on the upgrade transaction (restructure is pure), so a failure rolls back to v6; it also strips the removed `needsReview` field from every amount. |
| 6.2 | Info | CWE-694 | Held till v0.8 | Deleting a purchase, or a row together with its single purchase, is permanent and leaves no record; both ask for confirmation first, and sync will need tombstones for them (see v0.2 7.7). |
| 7.1 | Info | — | Not Fixed [informational: both new non-null assertions follow a check that guarantees the value (Where? is required before `root!`, Rename shows only on rows with a parent), so neither can be null today] | v0.3 adds `root!` in the Add form new-subcategory save and `n.parent!` in Annual rename; like v0.2 7.5 they rely on earlier guards the type system does not see. |
| 8.1 | Medium | CWE-755 | Fixed | When a Week/Month row gained items or a second purchase after its delete confirmation opened (for example from another tab), the delete failed with "Try again", which cannot succeed and hides the real reason. |
| v0.2 3.6 | Low | CWE-20 | Fixed | Add budget item saved a recurrence on items where it did not apply; v0.3 removed Estimated spend and Recurrence from the Add form (0007 §4), so recurrence is set only in Budget setup. |
| v0.2 1.1, 2.2, 4.5 | Info | CWE-400, CWE-434, CWE-79 | Held till v0.6 | File upload limits, inert HTML statement parsing and Trusted Types remain requirements for the v0.6 CSV/HTML import; v0.3 added no file input beyond the existing backup restore. |
| v0.2 2.5 | Info | CWE-79 | Held till v0.7 | Chart libraries in v0.7 must render item names as text or escape them before they reach tooltips and labels; v0.3 added no charts, so the requirement stands unchanged. |
| v0.2 3.4 | Medium | — | Held till v0.4 | Estimates are still scaled by days/30.44, so a $120 monthly estimate shows about $137.98 in a 35-day whole-weeks month; v0.4 replaces the day-based scaling with per-period math. |
| v0.2 1.3, 2.3, 2.4, 3.7, 4.3, 4.4, 6.6, 6.7, 7.7, 8.8 | Info / Medium | see v0.2 | Held till v0.8 | Sync-time requirements (server file checks, formula neutralizing, synced value allowlists, read checks, service worker takeover, frame-ancestors, encryption at rest and in transit, ids/tombstones, server logging) are unchanged by v0.3. |
| v0.2 5.4 | Medium | CWE-306, CWE-942, CWE-770, CWE-209 | Held till v0.8 ⚠ REQUIRES REVIEW BEFORE PROCEEDING | Sync backend network configuration (auth, CORS, rate and body limits, error leakage) must be reviewed and re-rated before any v0.8 work starts; v0.3 added no network code. |
| v0.2 5.1, 5.2 | Medium | CWE-1021, CWE-693, CWE-319 | Held till v0.9 | The static host chosen for distribution must send the security headers and serve only over HTTPS with HSTS; v0.3 changed no hosting or build configuration. |
| v0.2 7.1 | Low | CWE-1395 | Not Fixed [rechecked 2026-11-02: `npm audit` still lists the same 10 dev-only advisories under vite-plugin-pwa → workbox-build with no patched release; none of this code ships in dist] | `npm audit` reports 10 build-time advisories (8 moderate, 2 low) in the PWA plugin's dependency chain; the shipped runtime has zero advisories. |
| v0.2 1.2 | Info | — | Held till post-v1 | Receipt photos need size limits, a content check and EXIF/GPS removal before storage; unchanged because v0.3 added no camera or image handling of any kind. |
| v0.2 7.4, 7.5, 7.6 | Info | — | Not Fixed [informational, unchanged from v0.2: lockfile pins versions, earlier guards cover the assertions, and the private package name has no security effect] | Caret ranges in `package.json`, guarded non-null assertions, and the template package name `scaffold` are noted for later cleanup; none affects the shipped app. |

## Domain 1 - File Handling

**No new findings.** The only file input is still the v0.2 backup restore (`src/components/Backup.tsx`); its content checks are Domain 3. No other file surface was added (grep of `src/` for `type="file"`, `FileReader`, `Blob`, `createObjectURL`, `download`: only the existing backup component).

## Domain 2 - Encoding and Sanitization

**No injection.** All user text still reaches the DOM as JSX text or attribute values. `grep` for `innerHTML`, `dangerouslySetInnerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`, `setAttribute`: 0 matches. The only `querySelector` calls use fixed selectors (`src/components/ui/useTreegrid.ts:3,25,57`, `src/components/BudgetTable.tsx:61`) or a fixed tab id (`src/components/ui/Tabs.tsx:60`).

### 2.1 — Names in DOM ids (Info, Fixed)

v0.3 builds ids as `{field}-{parent}-{item}-{databaseId}` (`domId`, `src/budget/tree.ts`) using `slug` (`src/budget/validate.ts`), which keeps only Unicode letters and digits joined by `-`. Ids therefore contain no spaces (safe in `aria-labelledby`/`aria-describedby` lists), no selector syntax, and stay unique through the numeric id. Lookups use `getElementById`, which does not parse selectors. No action.

## Domain 3 - Validation and Business Logic

Evidence: Week/Month Add value uses `parseMoney` with negatives allowed and the shared money cap (`src/components/BudgetTable.tsx`); rename and Create use `cleanName` and compare sibling names as slugs; Add form new items go through `addNewItem`, one transaction for subcategory, item and amount (`src/storage/repository.ts`); Budget setup save adds new rows parents-first in one transaction and throws if a parent is missing; calendar settings are range-checked on read and restore (`cleanSettings`).

### 3.1 — Backup restore accepts looping or unbounded category trees (High, Fixed)

CWE-674, CWE-400, CWE-20. `checkBackup` checked each category's shape and that amounts point at real categories, but not the parent links. Verified on v0.3.15: a backup with Insurance's parent set to its own item Car was accepted and both rows vanished from every table and total (`buildTree` never reaches a loop from the top level). A backup adding a 20,000-level chain was accepted, and `buildTree`/`flatten` (recursive) threw "Maximum call stack size exceeded"; once restored, every load would crash into the error screen, and the Backup control sits on the screen that crashed. A hostile or damaged file is realistic input under the matrix.

**Resolution:** `badTreeRows` (`src/storage/repository.ts`) walks each row's parents iteratively and flags loops, self-parents and rows deeper than category › subcategory › item (the deepest the app creates; deep nesting is v0.6). `checkBackup` rejects such files ("has categories nested in a loop or more than three levels deep…"), and `categoryRepo.list` skips such rows already stored and reports them through the existing "Some saved records couldn't be read" notice. Verified: loop, self-parent, 20,000-deep chain and a fourth level are rejected; a real export is accepted; a 20,000-deep chain written straight into IndexedDB loads with the notice instead of crashing.

### 3.2 — Restore did not type-check due date and flags (Low, Fixed)

CWE-20. `validCategory` checked name, color, parent, estimate, frequency and order, but not `dueDate`, `autopay`, `selected` or `computed`. `dueDate: "soon"` was accepted and rendered as "Due Invalid Date" in Week and Month.

**Resolution:** `validCategory` requires `dueDate` to match `YYYY-MM-DD` and the three flags to be booleans when present. Verified: both cases rejected on restore.

### 3.3 — Duplicate category ids in a backup (Low, Fixed)

CWE-20. Two categories with the same id passed `checkBackup`; `bulkAdd` then failed inside the restore transaction (nothing written), showing the generic restore error.

**Resolution:** `checkBackup` rejects duplicate ids with "has a damaged category list". Verified.

### 3.4 — Name uniqueness enforced in the UI only (Info, Held till v0.8)

CWE-20. Create, rename and the Add form check sibling names (Budget setup `nameTaken`, Annual `rename`, `assertFree` in `addNewItem`), but `categoryRepo.rename` itself does not. Only app code calls it today. When sync writes names from another device (v0.8), enforce uniqueness in the repository or merge step.

## Domain 4 - Web Frontend Security

The production CSP meta tag (v0.2 4.1) is unchanged. Verified on the production build (`vite preview`): no CSP violations or console errors across Add purchase, Budget setup, every table range and the small-screen Screens menu.

### 4.1 — CSS custom property set through the CSSOM (Info, Fixed)

`src/screens/BudgetSetup.tsx:40` sets `--footer-h` with `style.setProperty`. CSP restricts style attributes in markup, not CSSOM changes, so `style-src 'self'` stays strict. The value is a number of pixels from `offsetHeight`, never user text. No action.

## Domain 5 - Configuration

**No changes.** `vite.config.ts`, `index.html` and `public/` are unchanged since v0.2 (`git diff b38dc01 HEAD`). `.gitignore` now also ignores `human_scratch_files/`. v0.2 5.1, 5.2 and 5.4 stay held (see summary).

## Domain 6 - Data Protection

### 6.1 — Dexie v7 upgrade is atomic (Info, Fixed)

The v7 upgrade (`src/storage/db.ts`) reads categories, restructures them with the pure `toV7Structure` (`src/storage/structure.ts`), then `clear` + `bulkAdd` and a `modify` on amounts, all on the upgrade transaction with no other `await`, so v0.2 6.9's guarantee holds: a failure rolls back to v6. Verified on a seeded v6 database: every amount and estimate kept, totals unchanged, `needsReview` removed.

### 6.2 — Permanent deletes (Info, Held till v0.8)

CWE-694. Day deletes a purchase; Week/Month deletes a row and, if it has exactly one, that purchase (`categoryRepo.removeEmpty`, checked inside the transaction). Both confirm in the row first and name the purchase. Nothing is kept after a delete; the backup export is the recovery path. Sync must record these deletes (v0.2 7.7).

## Domain 7 - Secure Coding and Architecture

Evidence: `npm audit --omit=dev`: 0 vulnerabilities. `npm audit`: the same 10 dev-only advisories as v0.2 7.1. No dependency added or changed (`package.json` differs from v0.2 only in `version`). UI code still reaches storage only through `src/storage/repository.ts`; table keyboard support is one shared hook (`src/components/ui/useTreegrid.ts`) used by Budget setup and the budget tables.

### 7.1 — New non-null assertions (Info, Not Fixed)

`root!` (`src/screens/AddBudget.tsx:89-90`) runs only after validation requires Where? for a new subcategory; `n.parent!` (`src/components/BudgetTable.tsx:106`) runs only from the Rename control, which is shown only on rows with a parent. Keep the guards if these are refactored.

## Domain 8 - Security Logging and Error Handling

Evidence: every new storage call reports failure to the user: Day delete, Add value, rename and row delete set a `role="alert"` message (`src/components/BudgetTable.tsx`); `addNewItem` maps a taken name to the Item or Category field and other errors to the save message (`src/screens/AddBudget.tsx`); Budget setup save reports a failure and changes nothing. Logging is unchanged (name and message only, v0.2 8.6).

### 8.1 — Row delete failure shows "Try again" (Medium, Fixed)

CWE-755. `removeEmpty` re-checks the row inside its transaction, but every failure showed "Error: {name} wasn't deleted. Try again." If the row gained an item or a second purchase after the confirmation opened (another tab), retrying cannot work and the message hides why. Unclear user-facing errors are at least Medium under the matrix.

**Resolution:** `removeEmpty` throws `RowInUseError` with the reason; the table shows "Error: {name} wasn't deleted because it has more than one purchase. Delete them in the Day table first." (or the items / top-level reason), closes the confirmation and reloads. Verified by adding a second purchase between opening and confirming the delete.
