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
- Week and Day sheets (`weekDayChecks` in `node-checks.ts`): Week purchases are dated, unmarked and take the year from the preview; Day purchases keep the date and times, a row with no matching item is a description, negative cells are credits. Overlap warning (`0013` §6): the sample Week and Day sheets share no row and day, so the overlap cases move the Day sheet onto 09/11 in memory (and use a Month sheet with a Day sheet), and check that an unticked sheet is not compared and no purchase is removed.
- ODS: `test_ods_import_data.ods` is checked against `test_xlsx_import_data.xlsx` sheet by sheet: every cell the ODS holds must equal the XLSX cell, sheet names and sheet types must match, and with a clean file the purchases, per-month counts and totals must match too. The current file (saved from LibreOffice) lost cell values where merges left empty covered cells; `ODS_LOST_CELLS` in `node-checks.ts` lists how many per sheet, and the sheet-total check is skipped for it. Replace the file with a clean copy and set `ODS_LOST_CELLS` to `{}` to make parity exact.
- Lost values (ODS): the plan's `lostValues` counts empty covered cells in the amount area of budget sheets. It must find 1,110 cells in 12 sheets of the ODS test file, none in the XLSX and CSV files or in an in-memory ODS whose merges are only in the header rows and name columns, and 2 in an in-memory ODS with covered cells among the amounts. The review warning text is pinned.
- Hostile ODS files (not a zip, no `content.xml`, bad XML, wrong or missing `mimetype`, zip bomb, entities, 14 sheets, huge repeat counts) and the formula file are built in memory in `fixtures.ts`. Trailing blank repeats (1,048,576 rows, 16,384 columns) must read quickly and without a limit error.
- `KNOWN_SHEET_DIFFS` in `node-checks.ts` lists sheets whose own cells don't add up (the anonymized data is messy). A new difference fails the run until it is checked and listed.
