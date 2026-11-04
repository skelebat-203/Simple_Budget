# Security Review — v0.5 (NETWORKED matrix)

Scope: v0.5 at v0.5.9 — PWA (Vite + React + Dexie IndexedDB), no backend yet. Rated under `issue-severity-matrix_NETWORKED.md` as in v0.1–v0.4. Domains per `security-domains.md`, ASVS 5.0.0 chapter names. Open items from earlier reviews are carried forward with their original IDs (prefixed `v0.2` / `v0.3` / `v0.4`); new findings are numbered in this file. Approved by the human 2026-11-04.

## Summary

### Executive summary

All 8 domains reviewed. v0.5 added: schedule fields on categories (weekday, day of month, next date) and the placement of an estimate on its payment dates; Preferences in Budget setup (rewards, daily reminder with the browser notification permission); placeholder reward image and sound; a first-run onboarding questionnaire with a multi-select that can create an item from typed text; a single app-wide live region that moves into open dialogs; and removal of the table keyboard code. The review focused on the new stored values and their restore path, the one new free-text input, the notification permission, the audio code, and the production CSP across every new flow.

No Medium or higher finding was found, so nothing needed fixing. One Low is held for sync (a second Create path that checks names only in the UI), and two Info items are noted. The shipped runtime has no dependency advisories, no dependency was added, and the production build reports no CSP violations or console errors in any v0.5 flow.

Totals (new): 1 Low (held), 7 Info (6 fixed, 1 not fixed). Carried: v0.2 3.4 stays fixed (v0.4); v0.3 3.4 is replaced by 3.2; the rest are unchanged and still held or not fixed.

### Summary table

| ID | Severity | CWE | Status | Issue |
| --- | --- | --- | --- | --- |
| 3.1 | Info | CWE-20 | Fixed | The new schedule fields (weekday 0–6, day 1–27 or 'last', next date) are shape-checked when rows are read and when a backup is restored, and the placement code only loops over the shown period, so a bad stored value cannot hang the table. |
| 3.2 | Low | CWE-367 | Held till v0.8 | Onboarding Done and Budget setup Save write rows from a snapshot and check new names only in the UI (storage has no check, as in v0.3 3.4), so a second tab can cause a duplicate sibling name or overwritten fields; merge rules are a v0.8 sync task. |
| 3.3 | Info | CWE-20 | Fixed (limit behaviour logged as defect D001, v0.6) | The one new free-text input, "add your own" in onboarding, goes through `cleanName` (NFC, control and format characters removed, 60-character cap) and a duplicate check; a 200-character entry was stored as 60 characters in the production build. |
| 4.1 | Info | — | Fixed | The production CSP reports no violations or console errors across onboarding, rewards, the live region moving into dialogs, Preferences, the notification toggle and all four tables; no inline script or style was added. |
| 4.2 | Info | CWE-940 | Fixed | The notification permission is requested only from a click on the Daily reminder box, the notification text is a fixed string with no budget data, and `sendReminder()` is not called anywhere, so nothing is shown yet. |
| 4.3 | Info | CWE-770 | Not Fixed [informational: each reward makes one short-lived audio context, closed after 1.5 s; browsers cap open contexts, but creation sits in try/catch so a refusal only means no sound, and 9 saves in about 1 s produced no error] | Every reward creates a new `AudioContext`; many rapid saves could reach the browser's limit on open audio contexts, in which case the sound is skipped and the image still shows. |
| 6.1 | Info | CWE-20 | Fixed | New stored values are `onboarded` (a boolean forced by `cleanSettings`) and the schedule fields on `Category`; none is indexed so no Dexie bump is needed, restore runs them through the same checks, and a restored 'reminder on' without permission is harmless because `sendReminder` re-checks it. |
| 8.1 | Info | — | Fixed | All status, error and notice text goes through one polite live region built with `createElement` and `textContent`; permission-denied and unsupported-browser cases show a specific message and leave the reminder off, and there are no new generic failure messages. |
| v0.4 7.1 | Info | — | Not Fixed [informational: after a successful rename `focusAfter.current!` is always set by `closeRow` on the line before, so the non-null assertion cannot fail today; keep that order in refactors] | v0.4 added one guarded non-null assertion in `commitRename` (`src/components/BudgetTable.tsx`), the same pattern as v0.2 7.5 and v0.3 7.1, which the type system cannot see. |
| v0.3 6.2, v0.2 1.3, 2.3, 2.4, 3.7, 4.3, 4.4, 6.6, 6.7, 7.7, 8.8 | Info / Medium | see v0.2, v0.3 | Held till v0.8 | Sync-time requirements (tombstones, server file checks, formula neutralizing, synced value allowlists, read checks, service worker takeover, frame-ancestors, encryption, ids, server logging) are unchanged by v0.5. |
| v0.2 5.4 | Medium | CWE-306, CWE-942, CWE-770, CWE-209 | Held till v0.8 ⚠ REQUIRES REVIEW BEFORE PROCEEDING | Sync backend network configuration (auth, CORS, rate and body limits, error leakage) must be reviewed and re-rated before any v0.8 work starts; v0.5 added no network code. |
| v0.2 1.1, 2.2, 4.5 | Info | CWE-400, CWE-434, CWE-79 | Held till v0.6 | File upload limits, inert HTML statement parsing and Trusted Types remain requirements for the v0.6 CSV/HTML import; v0.5 added no file input beyond the existing backup restore. |
| v0.2 2.5 | Info | CWE-79 | Held till v0.7 | Chart libraries in v0.7 must render item names as text or escape them before they reach tooltips and labels; v0.5 added no charts, so the requirement stands unchanged. |
| v0.2 5.1, 5.2 | Medium | CWE-1021, CWE-693, CWE-319 | Held till v0.9 | The static host chosen for distribution must send the security headers and serve only over HTTPS with HSTS; v0.5 changed no hosting or build configuration. |
| v0.2 7.1 | Low | CWE-1395 | Not Fixed [rechecked 2026-11-04: `npm audit` still lists the same 10 dev-only advisories under vite-plugin-pwa → workbox-build with no patched release; none of this code ships in dist] | `npm audit` reports 10 build-time advisories (8 moderate, 2 low) in the PWA plugin's dependency chain; the shipped runtime has zero advisories. |
| v0.2 1.2 | Info | — | Held till post-v1 | Receipt photos need size limits, a content check and EXIF/GPS removal before storage; unchanged because v0.5 added no camera or image handling of any kind. |
| v0.3 7.1, v0.2 7.4, 7.5, 7.6 | Info | — | Not Fixed [informational, unchanged: earlier guards cover the assertions, the lockfile pins versions, and the private package name has no security effect] | Guarded non-null assertions, caret ranges in `package.json` and the template package name `scaffold` are noted for later cleanup; none affects the shipped app. |

## Domain 1 - File Handling

**No new findings.** The only file input is still the backup restore (`src/components/Backup.tsx`); v0.5 added no upload. Its checks are Domain 3.

## Domain 2 - Encoding and Sanitization

**No injection.** `grep` of `src/` for `innerHTML`, `dangerouslySetInnerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`: 0 matches. `setAttribute` appears only in `src/components/ui/announcer.ts`, setting fixed role and aria values. User text (onboarding names, schedule labels, announcements) reaches the DOM as JSX text, attribute values, or `textContent`; the live region never takes HTML.

## Domain 3 - Validation and Business Logic

### 3.1 — Schedule fields (Info, Fixed)

CWE-20. `validCategory` (`src/storage/repository.ts`) accepts `dueWeekday` only as an integer 0–6 and `dueDay` / `dueDay2` only as 'last' or an integer 1–27; `dueDate` keeps the YYYY-MM-DD check. A row failing any check is skipped and counted in the existing "damaged record" notice. `paymentDates` (`src/budget/tree.ts`) iterates only the days or months inside the displayed period; an unparseable date compares false and ends the loop. The setup form offers only valid choices and clears a schedule that no longer fits when the recurrence changes.

### 3.2 — Snapshot writes without a storage check (Low, Held till v0.8)

CWE-367. Onboarding Done (`src/screens/Onboarding.tsx`) and Budget setup Save both call `saveSetup`, which writes whole rows from the dialog's snapshot and does not re-check sibling names inside the transaction (rename does, v0.4 3.1). With two tabs, a name added in the other tab after the dialog opened can end up twice under one parent, and edits made there to the same rows are overwritten. Only one person uses one browser profile, and the app already warns when another tab upgrades the database, so impact is limited to the user's own data. Replaces v0.3 3.4; a storage-side name check and per-record versions belong in the v0.8 merge step.

### 3.3 — Onboarding custom name (Info, Fixed)

CWE-20. `add` in `Onboarding.tsx` runs `cleanName`, rejects an empty result, and rejects a name that matches an existing Expenses child (slug comparison via `nameTaken`) or one already added in the dialog. The text box has no `maxLength` but the stored name is cut to 60 characters. Verified on the production build with a 200-character entry.

## Domain 4 - Web Frontend Security

### 4.1 — CSP across new flows (Info, Fixed)

Verified on `vite preview` with a `securitypolicyviolation` listener and console capture: onboarding with the multi-select, Add purchase with rewards (9 saves), all four tables, Budget setup with Preferences, the notification toggle and Preview reward: no violations, errors or warnings. The reward image is inline SVG from React elements, the sound is Web Audio oscillators (no files), and the live region is styled by a class, so `style-src 'self'` and `script-src 'self'` are unaffected.

### 4.2 — Notification permission (Info, Fixed)

CWE-940. `requestNotifications` (`src/notifications.ts`) runs from the checkbox change handler only. Denied and unsupported results leave the box off with a message. The reminder text is a constant; nothing from the budget is put in a notification.

### 4.3 — Audio contexts (Info, Not Fixed)

CWE-770. `RewardLayer` creates one `AudioContext` per reward and closes it after 1.5 s (`src/rewards/RewardLayer.tsx`). The browser limit on open contexts could be reached by many saves within about a second; the constructor is inside a try/catch, so the image still shows without sound.

## Domain 5 - Configuration

**No changes.** `vite.config.ts`, `index.html` and `public/` are unchanged since v0.3. v0.2 5.1, 5.2 and 5.4 stay held.

## Domain 6 - Data Protection

### 6.1 — New stored values (Info, Fixed)

CWE-20. `Settings.onboarded` is set to `true` only when stored as `true` (`cleanSettings`); the schedule fields are covered by 3.1. Neither needs a Dexie version because neither is indexed. `checkBackup` restores settings through `cleanSettings`, so a backup cannot inject other values. A backup with the reminder on, restored on a device without permission, only shows the box checked; `sendReminder` returns without showing anything unless permission is granted. localStorage use is unchanged (the row state moved to `src/components/ui/useCollapsed.ts`, same key and parsing as v0.4 6.2). No financial data leaves the device.

## Domain 7 - Secure Coding and Architecture

Evidence: `npm audit --omit=dev`: 0 vulnerabilities. `npm audit`: the same 10 dev-only advisories as v0.2 7.1. No dependency added or changed (`package.json` differs from v0.4 only in `version`). Storage is still reached only through `src/storage/repository.ts`. The table keyboard code was removed (about 130 lines), reducing custom behaviour. Messages share one announcer module; dialogs share one `Dialog`.

## Domain 8 - Security Logging and Error Handling

### 8.1 — Messages and the live region (Info, Fixed)

Every message that was a separate `role="status"` or `role="alert"` now goes through `announce()` (`src/components/ui/announcer.ts`), which writes `textContent` into one region. Visible copies stay on screen as plain text. Failure messages keep naming the cause and the next step (for example the denied-notification text). `console.error` calls still log only the error name and message (`src/main.tsx`, `ErrorBoundary.tsx`, `AddBudget.tsx`).
