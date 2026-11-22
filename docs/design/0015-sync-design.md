# 0015 — Sync to a Google Sheet (v0.7 step 2)

Status: **draft, not authoritative.** Open questions are marked **Q**. Nothing here is built until the human answers them and approves this doc. Scope lives in the roadmap (v0.7, "Sync to a Google Sheet"); this doc holds the spec.

## 1. Goal

The same budget can be used and updated on several devices. A Google Sheet in the user's own Google account is the remote copy. The user links an existing sheet, or the app creates one.

## 2. Architecture (proposed)

- **No server of our own.** The PWA talks to Google directly from the browser: Google Identity Services for sign-in (OAuth token flow), and the Google Sheets API (and Drive API for "create a sheet") for reads and writes.
- **Why:** the app has no backend today. Adding one means hosting, accounts and a much larger attack surface. With a browser-only client, Google does the auth, rate limits and body limits.
- **StorageAdapter interface** in `src/storage/`: the Dexie store stays the local source of truth. A Google Sheets adapter pulls and pushes changes. Later adapters (another provider) plug into the same interface.
- **Human setup task:** a Google Cloud project with an OAuth client ID (web application, the app's origins as allowed origins), and the OAuth consent screen. Only the human can create this. The client ID is public by design; there is no client secret in a browser app.

**Q1.** Is browser-only (no server of ours) acceptable? It decides how v0.2 5.4 is re-rated (see §7).

**Q2.** Which OAuth scope? Options:

| Scope | What the app can reach | Notes |
|---|---|---|
| `drive.file` (recommended) | Only sheets the app created or the user picked with the Google Picker | Least access. "Link an existing sheet" then goes through the Picker. Non-sensitive scope: no Google verification review. |
| `spreadsheets` | Every sheet in the user's Drive | Sensitive scope: Google verification needed before the public can use it. |

## 3. Sheet layout and data shape

The roadmap leaves this open: the earlier JSON-doc shape (version and `updatedAt` per record) has to fit a sheet that people can read.

**Q3.** Which layout?

| Option | Layout | Readable by people | Sync reliability |
|---|---|---|---|
| A. Data tabs (recommended) | One tab per table (`Categories`, `Purchases`, `Settings`), one row per record, a header row, hidden columns `id`, `updatedAt`, `deleted` | Yes, as plain lists | High: one row = one record |
| B. Budget-like tab | Tabs that look like the app's Month or Annual table | Most readable | Low: hard to map edits back to records; human edits break sync |
| C. A + B | Option A for sync, plus a read-only summary tab the app rewrites | Yes | High; the summary tab is ignored on pull |

**Q4.** May people edit the sheet by hand, and should the app pick those edits up? If yes, every pulled cell is untrusted input and goes through the same checks as an import (`0013`). If no, the app overwrites hand edits.

**Q5.** "Seed categories and table layout from the sheet's current layout" (roadmap): does this mean that linking a sheet made by the app on another device copies its categories here? Or does it mean reading a sheet the human made by hand, like the import does? The second one is the import flow with a live sheet, a much larger job.

## 4. Sync rules (decided in the roadmap; details proposed)

- **Sync-on-open:** pull, merge, then push. Also after each save while online (**Q6:** or only on open, plus a "Sync now" button?).
- **Last-write-wins** per record, by `updatedAt` (device clock). Ties go to the remote copy.
- **Tombstones:** a deleted record keeps its row with `deleted` set, so other devices learn of the delete (v0.3 6.2). **Q7:** how long are tombstones kept before they're purged (proposed: 90 days)?
- **Ids:** records need ids that are unique across devices (v0.2 8.8). Dexie's auto-increment ids clash between devices, so synced records get a random UUID. This means a Dexie migration (v9).
- **Merge checks inside the write transaction** (v0.5 3.2): re-check sibling names on merge. A clash gets a suffix and a note, so a name is never dropped silently.

## 5. Encryption (open in the roadmap)

**Q8.** Do you want optional passphrase encryption?
- **On:** cells hold encrypted text (AES-GCM, key from the passphrase via PBKDF2 or Argon2). The sheet is then unreadable to people, which removes the point of a readable layout (§3). A lost passphrase means lost remote data.
- **Off (proposed for v0.7):** the sheet is plain and protected by the Google account. Encryption is then deferred.

## 6. UI (proposed)

- A **Sync** entry next to Backup that opens a `Dialog`: sign in with Google, then create a new sheet or link one (Picker), plus last sync time, Sync now, and Unlink.
- Status messages go through the single live region. A sync error says what failed and that the local data is safe.

**Q9.** Should sync be offered in onboarding (the wizard) too, or only from the Sync button?

## 7. Security items to settle (from `security-v0.6.md`)

| Item | What it needs | With the §2 proposal |
|---|---|---|
| v0.2 5.4 (Medium) ⚠ | Network review: auth, CORS, rate and body limits, error leakage | No server of ours: Google handles auth, CORS and limits. Remaining: the CSP `connect-src` and `script-src` additions for Google, token kept in memory only (not in storage), errors shown without raw API text. To re-rate after Q1. |
| v0.2 2.3 | Formula injection into cells | Write with `valueInputOption=RAW`, and prefix a `'` when text starts with `=`, `+`, `-` or `@` |
| v0.3 6.2 | Tombstones | §4 |
| v0.2 8.8 | Ids across devices | §4, UUIDs |
| v0.5 3.2 | Two-tab and multi-device name clashes | §4 merge checks |
| v0.2 1.3, 2.4, 3.7, 4.3, 4.4, 6.6, 6.7, 7.7 | File checks, synced-value allowlists, read checks, service worker takeover, frame-ancestors, encryption, logging | Each mapped to a build check in step 3 once Q1 to Q8 are answered |

## 8. Testing (proposed)

- Adapter logic (merge, tombstones, formula neutralizing) tested against an in-memory fake sheet in a `tests/sync/` harness, like `tests/import/`.
- **Q10.** A real end-to-end test needs a test Google account and the OAuth client from §2. Will you provide a test account, or do you want to run those checks yourself? (Google sign-in can't run in the sandbox.)
