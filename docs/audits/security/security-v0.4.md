# Security Review — v0.4 (NETWORKED matrix)

Approved by the human 2026-11-03. Scope: v0.4 at v0.4.19 (fix applied in v0.4.20) — PWA (Vite + React + Dexie IndexedDB), no backend yet. Rated under `issue-severity-matrix_NETWORKED.md` as in v0.1–v0.3. Domains per `security-domains.md`, ASVS 5.0.0 chapter names. Open items from earlier reviews are carried forward with their original IDs (prefixed `v0.2` / `v0.3`); new findings are numbered in this file.

## Summary

### Executive summary

All 8 domains reviewed. v0.4 changed stored values ('year' → 'annual', Dexie v8), the estimate scaling math, the Week by-day and date-navigation views, the Actions menu, renaming from every table behind a confirm dialog, saved open/closed row state, and Budget setup and form layout. The review focused on the new write path (rename), the v8 upgrade and backup compatibility, the new localStorage value, and the popover and dialog code under the production CSP.

One Medium was found and fixed: rename checked the name only when the form was submitted, and the confirm dialog can stay open while another tab changes the tree, so a deleted row was reported as renamed and a sibling could end up with the same name. Rename now re-checks inside its save transaction and shows a clear error. v0.2 3.4 (estimate scaling) is fixed by the v0.4 math. The shipped runtime has no dependency advisories and the production build reports no CSP violations or console errors.

Totals (new): 1 Medium (fixed), 5 Info. Carried: v0.2 3.4 fixed; v0.3 3.4 narrowed (rename now enforced in storage); the rest unchanged and still held or not fixed.

### Summary table

| ID | Severity | CWE | Status | Issue |
| --- | --- | --- | --- | --- |
| 3.1 | Medium | CWE-367, CWE-754 | Fixed | Rename checked sibling names when the form was submitted, not when the confirm dialog saved; a row deleted in another tab was reported "Renamed", and a sibling created meanwhile got a duplicate name. |
| 3.2 | Info | CWE-20 | Fixed | Backups made before v0.4.1 store recurrence 'year'; restore maps it to 'annual' before validation, so older backups still restore and no unknown frequency value is ever stored. |
| 4.1 | Info | — | Fixed | The Go to date popover is placed by script through the CSSOM (`element.style`), and the dialog uses native `showModal`; the production CSP reports no violations in any v0.4 flow. |
| 6.1 | Info | — | Fixed | The Dexie v8 upgrade only runs `modify` on the upgrade transaction, so a failure rolls back to v7; tested on a seeded v7 database: yearly items and an Annual range converted, others unchanged. |
| 6.2 | Info | CWE-502 | Fixed | Saved open/closed row state is a list of category ids in localStorage, read with `JSON.parse` in a try/catch; a damaged value falls back to all rows open and holds no financial data. |
| 7.1 | Info | — | Not Fixed [informational: after a successful rename `focusAfter.current!` is always set by `closeRow` on the line before, so the non-null assertion cannot fail today; keep that order in refactors] | v0.4 adds one guarded non-null assertion in `commitRename` (`src/components/BudgetTable.tsx`), the same pattern as v0.2 7.5 and v0.3 7.1, which the type system cannot see. |
| v0.2 3.4 | Medium | — | Fixed | Estimates were scaled by days/30.44, so a monthly estimate did not equal itself over a month; v0.4 scales by months, so $100 monthly shows $100 in every Month total and $1,200 in the Annual total. |
| v0.3 3.4 | Info | CWE-20 | Held till v0.8 | Rename now enforces sibling-name uniqueness in storage (3.1); Budget setup Create still checks in the UI only, so sync writes from another device must be checked in the merge step. |
| v0.3 6.2, v0.2 1.3, 2.3, 2.4, 3.7, 4.3, 4.4, 6.6, 6.7, 7.7, 8.8 | Info / Medium | see v0.2, v0.3 | Held till v0.8 | Sync-time requirements (tombstones, server file checks, formula neutralizing, synced value allowlists, read checks, service worker takeover, frame-ancestors, encryption, ids, server logging) are unchanged by v0.4. |
| v0.2 5.4 | Medium | CWE-306, CWE-942, CWE-770, CWE-209 | Held till v0.8 ⚠ REQUIRES REVIEW BEFORE PROCEEDING | Sync backend network configuration (auth, CORS, rate and body limits, error leakage) must be reviewed and re-rated before any v0.8 work starts; v0.4 added no network code. |
| v0.2 1.1, 2.2, 4.5 | Info | CWE-400, CWE-434, CWE-79 | Held till v0.6 | File upload limits, inert HTML statement parsing and Trusted Types remain requirements for the v0.6 CSV/HTML import; v0.4 added no file input beyond the existing backup restore. |
| v0.2 2.5 | Info | CWE-79 | Held till v0.7 | Chart libraries in v0.7 must render item names as text or escape them before they reach tooltips and labels; v0.4 added no charts, so the requirement stands unchanged. |
| v0.2 5.1, 5.2 | Medium | CWE-1021, CWE-693, CWE-319 | Held till v0.9 | The static host chosen for distribution must send the security headers and serve only over HTTPS with HSTS; v0.4 changed no hosting or build configuration. |
| v0.2 7.1 | Low | CWE-1395 | Not Fixed [rechecked 2026-11-03: `npm audit` still lists the same 10 dev-only advisories under vite-plugin-pwa → workbox-build with no patched release; none of this code ships in dist] | `npm audit` reports 10 build-time advisories (8 moderate, 2 low) in the PWA plugin's dependency chain; the shipped runtime has zero advisories. |
| v0.2 1.2 | Info | — | Held till post-v1 | Receipt photos need size limits, a content check and EXIF/GPS removal before storage; unchanged because v0.4 added no camera or image handling of any kind. |
| v0.3 7.1, v0.2 7.4, 7.5, 7.6 | Info | — | Not Fixed [informational, unchanged: earlier guards cover the assertions, the lockfile pins versions, and the private package name has no security effect] | Guarded non-null assertions, caret ranges in `package.json` and the template package name `scaffold` are noted for later cleanup; none affects the shipped app. |

## Domain 1 - File Handling

**No new findings.** The only file input is still the backup restore (`src/components/Backup.tsx`); its content checks are Domain 3.

## Domain 2 - Encoding and Sanitization

**No injection.** `grep` of `src/` for `innerHTML`, `dangerouslySetInnerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`, `setAttribute`: 0 matches. New user text (renamed names, dialog message, tooltip, column names) reaches the DOM as JSX text or attribute values. After a rename, focus moves to an id rebuilt with `slug` (v0.3 2.1), looked up with `getElementById`.

## Domain 3 - Validation and Business Logic

Evidence: Go to date accepts only the `<input type="date">` ISO value and only within the Date field's limits (string compare before `parseIso`, `src/screens/Budget.tsx`); Previous and Next stop at the same limits. Rename uses `cleanName` and slug comparison.

### 3.1 — Rename not re-checked when it saves (Medium, Fixed)

CWE-367, CWE-754. v0.4 puts a confirm dialog between the rename check and the save. `categoryRepo.rename` was a plain `update`, which re-checked nothing and returns 0 for a missing row. Verified on v0.4.19 with a second writer while the dialog was open: deleting the row, then Confirm, showed "Renamed …" though nothing changed (false success, Domain 8 under the matrix); adding a sibling with the new name, then Confirm, stored two siblings with the same name, which 0007 §8 forbids.

**Resolution (v0.4.20):** `categoryRepo.rename` (`src/storage/repository.ts`) runs in a transaction: the row must exist and have a parent, and no sibling may share the name's slug. It throws `RowInUseError` or `NameTakenError`; the table shows "Error: {name} wasn't renamed because it no longer exists." (form closes, table reloads) or "Invalid: Name "{name}" already exists in {parent}" on the field (form stays open). Verified in the production build for all three cases: normal rename, deleted row, sibling clash.

### 3.2 — Older backups use 'year' (Info, Fixed)

`checkBackup` maps a category `frequency` of 'year' to 'annual' before `validCategory`, which accepts only the new set. No other stored field held 'year' (`defaultRange` never allowed it; `cleanSettings` already resets invalid values to 'day').

## Domain 4 - Web Frontend Security

The production CSP meta tag is unchanged. Verified on `vite preview`: no CSP violations or console errors across Day, Week, Month and Annual, the popover, the Actions menu, the rename dialog and Budget setup.

### 4.1 — Popover and dialog (Info, Fixed)

The popover uses the native `popover` attribute, positioned by setting `element.style` (CSSOM, allowed by `style-src 'self'`); values are pixel numbers from `getBoundingClientRect`, never user text. `Dialog` (`src/components/ui/Dialog.tsx`) uses `<dialog>` + `showModal`. No action.

## Domain 5 - Configuration

**No changes.** `vite.config.ts`, `index.html` and `public/` are unchanged since v0.3. v0.2 5.1, 5.2 and 5.4 stay held.

## Domain 6 - Data Protection

### 6.1 — Dexie v8 upgrade is atomic (Info, Fixed)

The v8 upgrade (`src/storage/db.ts`) is two `modify` calls on the upgrade transaction with no other `await`, so a failure rolls back to v7 (same guarantee as v0.3 6.1).

### 6.2 — Saved row state in localStorage (Info, Fixed)

CWE-502. `useCollapsed` (`src/components/ui/useTreegrid.ts`) stores closed row ids under `simple-budget:collapsed`. Parsing is wrapped in try/catch and a damaged value means "all open"; non-id entries match nothing. Only same-origin code can write it, and it holds no names or amounts. No action.

## Domain 7 - Secure Coding and Architecture

Evidence: `npm audit --omit=dev`: 0 vulnerabilities. `npm audit`: the same 10 dev-only advisories as v0.2 7.1. No dependency added or changed (`package.json` differs from v0.3 only in `version`). Storage is still reached only through `src/storage/repository.ts`. Dialogs share one `Dialog` component; menus one `ActionsMenu`.

### 7.1 — New non-null assertion (Info, Not Fixed)

`focusAfter.current!` in `commitRename` (`src/components/BudgetTable.tsx`) runs right after `closeRow`, which sets it. Keep that order if refactored.

## Domain 8 - Security Logging and Error Handling

Evidence: rename failures now give a reason (3.1) instead of a false success or a generic "Try again"; other new UI (navigation, menu, popover) makes no storage calls. Logging is unchanged.
