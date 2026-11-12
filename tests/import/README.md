# Import tests

Checks for spreadsheet import (`docs/design/0013-import-mapping.md` §11). They use the test files in `docs/test_sheets/` (anonymized real data plus invented Week and Day sheets).

```sh
npm run test:import
```

Prints PASS or FAIL per check and exits 1 on any failure. No browser is needed.

| File | What it holds |
|---|---|
| `run.mjs` | Entry point. Loads the TypeScript checks through Vite (no extra test tool) |
| `fixtures.ts` | Test file list, the seeded tree (from `src/storage/seed.ts`), hostile and malformed files built in memory |
| `node-checks.ts` | Reading, the preview and the safety limits |
| `db-checks.ts` | What `applyImport` writes: purchases, marks, Day times, duplicates, refusals, stale previews |

## Notes

- The database is `fake-indexeddb` (a dev dependency): an in-memory IndexedDB that Dexie uses in Node. `run.mjs` loads it before anything else. The real browser is covered by hand testing of the import screen (plan step 14) and the UI/UX review.
- `TODAY` is fixed at 2026-11-11 and every run passes `SHEET_YEAR` (2023), the year of the test sheets, because the default year is the current year.
- `KNOWN_SHEET_DIFFS` in `node-checks.ts` lists sheets whose own cells don't add up (the anonymized data is messy). A new difference fails the run until it is checked and listed.
