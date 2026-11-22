# 0015 — Sync to a Google Sheet (v0.7 step 2)

Status: **approved 2026-11-21.** Decisions are marked with the question number (Q1 to Q10) they answer. Scope lives in the roadmap (v0.7, "Sync to a Google Sheet"); this doc holds the spec.

## 1. Goal

The same budget can be used and updated on several devices. A Google Sheet in the user's own Google account is the remote copy. The user links an existing sheet, or the app creates one.

## 2. Architecture (proposed)

- **No server of our own.** The PWA talks to Google directly from the browser: Google Identity Services for sign-in (OAuth token flow), and the Google Sheets API (and Drive API for "create a sheet") for reads and writes.
- **Why:** the app has no backend today. Adding one means hosting, accounts and a much larger attack surface. With a browser-only client, Google does the auth, rate limits and body limits.
- **StorageAdapter interface** in `src/storage/`: the Dexie store stays the local source of truth. A Google Sheets adapter pulls and pushes changes. Later adapters (another provider) plug into the same interface.
- **Human setup task:** a Google Cloud project with an OAuth client ID (web application, the app's origins as allowed origins), and the OAuth consent screen. Only the human can create this. The client ID is public by design; there is no client secret in a browser app.

**Android (input to the v0.9 packaging decision):** the PWA uses a Web application OAuth client. A TWA APK keeps using it; a Capacitor APK also needs an Android OAuth client and native sign-in, because Google blocks sign-in inside WebViews. Either can be added to the same Cloud project.

**Q1 — decided 2026-11-21:** browser-only, no server of ours. Several people can share one budget: each signs in with their own Google account, and the owner shares the sheet with them in Google Drive.

**Q2 — decided 2026-11-21:** scope `drive.file` with the Google Picker. The app reaches only sheets it created or the user picked. To share, user A creates the sheet in the app and shares it with user B in Google Drive; B picks it once per device with "Link a sheet". Google sign-in tokens expire after about an hour.

## 3. Sheet layout and data shape

The roadmap leaves this open: the earlier JSON-doc shape (version and `updatedAt` per record) has to fit a sheet that people can read.

**Q3 — decided 2026-11-21:** no readable layout; encryption (Q8) comes first. The sheet holds data tabs (`Categories`, `Purchases`, `Settings`), one row per record: plain `id`, `updatedAt` and `deleted` columns for matching and merging, and one encrypted column with the record's content. Mockups of the options considered: `images/v0.7-sync-layout/` (A was the base of this choice; B and C were dropped).

**Q4 — decided 2026-11-21:** the sheet can't be locked (everyone who syncs is an editor), so hand edits flow back into the app, mostly silently, through the same checks the import uses (`0013`). The sheet gets "warning only" protection. While a sync runs, the tables take no changes (no adding or editing in them). The Add purchase screen still works, but its saves are held and written once the sync completes or fails, so a save never collides with a sync.

**Q5 — decided 2026-11-21:** "Seed categories and table layout from the sheet's layout" is dropped. Linking a synced sheet already brings its categories, because categories sync like any other record.

## 4. Sync rules (decided in the roadmap; details proposed)

- **When sync runs (Q6 — decided 2026-11-21):** on open, after each save, every 1 minute while the app is open, and a Sync now button. Each run pulls, merges, then pushes. Live push is not possible without a server of our own.
- **Last-write-wins** per record, by `updatedAt` (device clock). Ties go to the remote copy.
- **Tombstones:** a deleted record keeps its row with `deleted` set, so other devices learn of the delete (v0.3 6.2). **Q7 — decided 2026-11-21:** tombstones are kept 90 days, then purged.
- **Ids:** records need ids that are unique across devices (v0.2 8.8). Dexie's auto-increment ids clash between devices, so synced records get a random UUID. This means a Dexie migration (v9).
- **Merge checks inside the write transaction** (v0.5 3.2): re-check sibling names on merge. A clash gets a suffix and a note, so a name is never dropped silently.

## 5. Encryption (open in the roadmap)

**Q8 — decided 2026-11-21:** a passcode encrypts the sheet; it is required, not optional.
- Each record's content is encrypted with AES-GCM (Web Crypto). The key comes from the passcode via PBKDF2 (Web Crypto) with a random salt stored in the sheet's `Settings` tab.
- User A sets the passcode when creating the sheet and gives it to user B outside the app. B needs both the shared sheet and the passcode.
- A lost passcode means the sheet can't be read; the local data on each device is unaffected.
- The passcode is never written to the sheet or sent anywhere. Each device remembers it (decided 2026-11-21) as a non-extractable `CryptoKey` in IndexedDB, so the key can be used but not read out; anyone with the unlocked device can sync. Unlink removes the key.
- Hand edits (Q4) to encrypted cells fail to decrypt and are skipped with a note; edits to the plain columns go through the import checks.

## 6. UI (proposed)

- A **Sync** entry next to Backup that opens a `Dialog`: sign in with Google, then create a new sheet or link one (Picker), plus last sync time, Sync now, and Unlink.
- Status messages go through the single live region. A sync error says what failed and that the local data is safe.

**Q9 — decided 2026-11-21, replaced 2026-11-22:** sync is step 1 of the onboarding wizard ("Local only" or "Sync with Google"; then tabs "New Budget" and "Existing Budget"); "Existing Budget" skips the category steps; the pay-frequency step is removed (set in Advanced options). The Sync button lives in the Budget tab panel, at the right of the date controls (v0.7 step 3b; mockups `images/v0.7-wizard-sync/`).

## 7. Security items to settle (from `security-v0.6.md`)

| Item | What it needs | With the §2 proposal |
|---|---|---|
| v0.2 5.4 (Medium) ⚠ | Network review: auth, CORS, rate and body limits, error leakage | Reviewed 2026-11-21, see §7.1; proposed re-rating Low |
| v0.2 2.3 | Formula injection into cells | Write with `valueInputOption=RAW`; encrypted text (base64) can start with `+`, so still prefix a `'` when a cell starts with `=`, `+`, `-` or `@` |
| v0.3 6.2 | Tombstones | §4 |
| v0.2 8.8 | Ids across devices | §4, UUIDs |
| v0.5 3.2 | Two-tab and multi-device name clashes | §4 merge checks |
| v0.2 1.3, 2.4, 3.7, 4.3, 4.4, 6.6, 6.7, 7.7 | File checks, synced-value allowlists, read checks, service worker takeover, frame-ancestors, encryption, logging | Each mapped to a build check in step 3 |

### 7.1 Network review (v0.2 5.4)

v0.2 5.4 was written for a sync server of our own. Q1 removed that server, so most of it no longer applies; what remains is the browser's traffic to Google.

| Part of 5.4 | With browser-only sync |
|---|---|
| Auth (CWE-306) | Google sign-in (Identity Services token flow). The access token is kept in memory only, never in storage, and expires after about an hour. The app asks only for `drive.file`. |
| CORS (CWE-942) | No server of ours, so no CORS policy to get wrong. Google's APIs allow browser calls with a token. |
| Rate and body limits (CWE-770) | Google enforces them. **Risk:** the Sheets API allows a fixed number of reads per minute per Cloud project (shared by every user) and per user. With 1-minute sync, each open app makes about one read a minute, so the project quota caps how many apps can be open at once. Mitigations: one batched read per sync; back off on a quota error (HTTP 429) and retry later; sync only while the app is visible; ask Google for a higher quota (free) before a wider release. |
| Error leakage (CWE-209) | Errors are shown as plain messages ("Sync failed, your data on this device is safe"); raw API responses are not shown or logged. |

New points the review adds:
- **CSP:** sign-in and the Picker load Google scripts and frames. Needed: `script-src` `https://accounts.google.com/gsi/client` and `https://apis.google.com`; `connect-src` `https://sheets.googleapis.com` and `https://www.googleapis.com`; `frame-src` `https://accounts.google.com` and `https://docs.google.com`. Each is an exact host, never a wildcard. `frame-ancestors` (v0.2 6.7) stays `'none'`.
- **Untrusted pulls:** every pulled row is untrusted (another device or a hand edit): it must decrypt (AES-GCM fails on any change), then pass the import checks (`0013`) before it reaches Dexie.
- **Stored key:** the remembered passcode key is non-extractable (above).

**Proposed re-rating: Medium → Low**, held open until step 3 is built and the v0.7 security review confirms each mitigation.

## 8. Testing (proposed)

- Adapter logic (merge, tombstones, formula neutralizing) tested against an in-memory fake sheet in a `tests/sync/` harness, like `tests/import/`.
- **Q10 — decided 2026-11-21:** the human provides a test Google account when the end-to-end test is reached, and creates the OAuth client (§2) with step-by-step instructions at step 3.
