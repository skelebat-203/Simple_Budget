# D005 — Google file picker shows no files ("Link a sheet")

- Found: 2026-11-26, in phone testing (screenshot: "Select a file" panel with the "Shared with me" and "My sheets" tabs, an empty list and a disabled Select button).
- Severity: Medium (an existing Google sheet cannot be linked from the phone; creating a new sheet is unaffected).
- What happens: Sync › Existing Budget › link opens the Google Picker. Both tabs are empty, so no existing sheet can be selected.
- Expected behavior: the user's sheets are listed and one can be selected.
- Suspects (not yet checked): the API key's website restriction (`googleConfig.ts` lists only `localhost:5173` and `:4173`; the phone build is served from GitHub Pages since v0.7.45, so its origin may be missing); the Picker API or Drive API not enabled for the Cloud project; the `drive.file` scope showing only files this app created or was granted, with a sheet created elsewhere needing the picker's own grant; the picker's layout on a narrow screen.
- Files: `src/storage/sync/googleSheets.ts` (`pickSheet`), `src/storage/sync/googleConfig.ts`; the API key restriction in the Google Cloud console (human).
- Scheduled: v0.7 step 15c, before the reviews.
