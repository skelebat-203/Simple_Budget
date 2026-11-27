# D004 — Google sign-in fails in hardened Firefox

- Found: 2026-11-22, in the sync end-to-end test (v0.7 step 3).
- Severity: Medium (sync can't be set up in that browser; local data is unaffected).
- What happens: in Firefox with Enhanced Tracking Protection set to Strict (and likely resistFingerprinting or First-Party Isolation), Google's sign-in pop-up opens and consent completes, but the pop-up can't report back to the app. The Sync dialog shows "The Google sign-in window closed before sign-in finished." Turning tracking protection off for the site did not help. Chromium works.
- Expected behavior: sign-in works in privacy-hardened browsers that alpha testers may use (Firefox Strict, Brave, LibreWolf).
- Proposed fix: a full-page redirect sign-in (OAuth token flow with `redirect_uri`) instead of the pop-up, at least as a fallback. Needs an Authorized redirect URI added in the Google Cloud console, and the Sync dialog must survive leaving and re-opening the app.
- Workaround: test sync in Chromium (human, 2026-11-22).
- Files: `src/storage/sync/googleSheets.ts` (`signIn`), `src/components/Sync.tsx`.
- Fix (built, v0.7 step 15b): after a pop-up failure the Sync dialog and wizard offer "Sign in another way", a full-page redirect sign-in (`0015` §7.1). Needs the app's address under Authorized redirect URIs in the Google Cloud console (human). Waiting on: the human's test in Firefox Strict and Chromium.
- Scheduled: v0.7 step 15b, before the reviews; does not block the alpha launch (human, 2026-11-22).
