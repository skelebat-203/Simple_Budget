# Import parsing (v0.6 step 13) — review log

Work log for the human's review of plan step 13. Branch `worktree-v0.6-group-f`, worktree `.claude/worktrees/v0.6-group-f`. **Nothing is committed** (one commit after the human's review, per 2026-11-11 instruction).

## Status

Step 13 is built and tested. Nothing blocked. No UI (that is step 14). The human reviewed it on 2026-11-11; the changes below are made and re-tested.

## Review outcome (2026-11-11)

| # | Decision | Done |
|---|---|---|
| R1 | Ask the user where an unknown top-level row goes | Built: the row waits for a place (`needsPlace`, `plan.unplaced`); choices are under an existing row, onto an existing row, or skip; `applyImport` refuses while any row waits. Picker UI logged for step 14 in `RESUME-HERE.md`. Recorded in `0013` §4 |
| R3 | Non-matching names become new subcategories or items; top level follows R1 | Already so; no alias list. Due-day matching kept. Recorded in `0013` §4 |
| R9 | Keep what was built; sort out later | No change |
| R11 | Default year is the current year | Built for month, week and annual sheets. A day sheet's date has its own year, which is kept (confirmed: the default applies only when the file gives no year). Recorded in `0013` §3 and Q1 |
| R15 | Regression test Week/Day import next subversion, then find and fill gaps | Added to the roadmap's v0.7 |
| R16 | Allow dates back to 1970-01-01 | Built app-wide (`dateBounds` in `src/budget/validate.ts`, so the date pickers allow it too). Recorded in `0013` §5 |
| X1 | Upgrade fast-xml-parser on or after 2026-11-17 | Logged in `RESUME-HERE.md` step 14 (fallback step 19) |
| D003 | Fix in step 14: an amount change keeps the time and the import mark | D003 file and roadmap updated; logged in step 14 |
| Test sheets | Messy data; mismatches possible | Known Feb difference listed in the harness (`KNOWN_SHEET_DIFFS`) |
| Q-T | Commit the test harness | `tests/import/`, `npm run test:import` (README there). Database checks use `fake-indexeddb` 6.2.6 (dev dependency, approved 2026-11-11) instead of Chromium, so no browser is needed |

Other changes: `Snapshot.weekStart` removed (only the old year rule used it); `SEED_TREE` exported from `src/storage/seed.ts` so the tests use the real seed.

## What was built

| File | What it does |
|---|---|
| `src/import/grid.ts` | Shared shapes, limits, `ImportError` |
| `src/import/csv.ts` | CSV reader (quotes, BOM, CRLF), values only |
| `src/import/zip.ts` | Small zip reader: inflates each part in 4 KB steps and stops at the unzipped limit, so a zip's stated sizes are never trusted |
| `src/import/xlsx.ts` | XLSX reader: stored values, shared strings, date-formatted cells, cell notes; never reads formulas; refuses DOCTYPE/ENTITY; skips external links |
| `src/import/cells.ts` | Amount, date, time and name rules (`0013` §3.4, §4) |
| `src/import/sheets.ts` | Sheet type detection (`0013` §3.1), date columns, rows as a tree, ignored columns |
| `src/import/plan.ts` | The preview: targets per row, new rows, purchases, estimates, warnings, duplicates, month/annual choices. Pure; re-run it after each preview choice |
| `src/import/index.ts` | `readImportFile(file)`, `importSnapshot()`, `previewImport(wb, snapshot, options)` for step 14 |
| `src/storage/repository.ts` | `applyImport(plan)`: one transaction, re-checks every row it names; `undated` kept by backup checks |
| `src/storage/db.ts` | Optional `undated` on purchases (not indexed, no Dexie version bump) |
| `package.json` | `fflate` 0.8.3, `fast-xml-parser` 5.11.2 (exact pins) |
| `docs/defects/D003-…`, roadmap | New defect, see below |

## Test results

`npm run test:import`: 203 of 203 pass (87 reading and preview, 116 database through fake-indexeddb). Build, lint and type check pass.

| Check (`0013` §11) | Result |
|---|---|
| Every test file into an empty and into the seeded database | Pass, all 7 files × 2 |
| Imported purchases per sheet = the sheet's own row totals (Monthly Act.) | Pass for every sheet except Feb: $7.50 more, because the Feb "Drugs" week cells add up to $128.25 but its Monthly cell says $120.75 (the preview warns on that row) |
| CSV and XLSX give the same result | Pass (Sep, Oct, Week, Day: same counts and totals) |
| No `RV Spending` or `Mom Support` rows | Pass |
| Misc rows land in Incidentals › Miscellaneous with descriptions | Pass (99 in the workbook, all described) |
| Every undated purchase is marked | Pass (the tooltip itself is step 14) |
| Annual-only import = workbook import | Only for May, Jun, Aug, Sep. The annual sheet's numbers differ from the month sheets for the other months (see Test sheet findings) |
| Malformed, oversized, zip bomb, entity bomb, 14 sheets, 6,000 rows, unclosed quote, random bytes, truncated file, .ods, .txt | Each fails with a plain "Invalid: Import file …" message; data unchanged |
| A formula cell never changes a value | Pass (a formula with a stored 5 imports 5; formula text such as `=1+2`, `@SUM(1)`, `+5` is skipped with a warning; `=HYPERLINK(...)` as a name is stored as plain text) |
| Preview made stale by another tab (row deleted) | Apply refuses, writes nothing |
| Already imported (§6) | Second import warns on 51 rows; "Skip those items" drops them |

The checks are in `tests/import/` (see Review outcome, Q-T).

## Best guesses for review

As first built. See Review outcome above for what changed.

| # | Situation | What I did |
|---|---|---|
| R1 | A top-level sheet row the app doesn't know (not Income, Pay, Incidental Income, Taxes, Net Income, Savings, Expenses) | Put it under Expenses (as a subcategory or item) |
| R2 | A name deeper than Category › Subcategory › Item (column D under C) | Its amounts go on the item above, with its name as the description |
| R3 | Names with a due-day note ("Power 8th", "Mortgage 1st", "Life Ins 11th / 13th") | Matching tries the full name first, then without the trailing "8th"-style note, so "Power 8th" matches Power. New rows keep the full name. Many sheet names still don't match the seed (Gen. Self Care, Trad 401k, Treat / Snacks, Date Day, Car Ins. Will 25th…); the preview dropdown fixes them. An alias list could cover the common ones. Want one? |
| R4 | Cell notes on a name cell or an empty cell in the name columns (most notes in the workbook sit in column D) | Treated as a row note: the description of every purchase in the row. Exception: a note that starts with an amount ("$1082.25 Replaced windshield") goes only on the purchase with that amount, when exactly one matches. A note on an amount cell goes on that purchase only |
| R5 | Estimates | Monthly Est. total, frequency Monthly (Q3). Several month sheets: the latest month's value wins. A week sheet's Weekly Est. is used (frequency Weekly) only when no month sheet gives one. An existing estimate is never overwritten; the preview says so |
| R6 | Selection | Every row that gets purchases or an estimate becomes "selected". Needed: estimates only count for selected rows, and the Charity rule (`0009` §6) starts when Charity has a selected item |
| R7 | Day sheet times (Q10) | Stored as the purchase's `createdAt`, which the Day table already shows and sorts by. No new field. Imported purchases without a time get the import time, in sheet order |
| R8 | Day sheet purchase row that matches no item, under a row that has items (for example Incidentals in the seeded app) | Goes to that row's Miscellaneous, with the name as the description. Under a top-level row (Expenses): a new item |
| R9 | `0013` §7 annual-only month that already has data | The preview lists it with a choice: "existing" (default; skips that month from the annual sheet) or "import". **Not built:** "it then asks whether to replace the imported annual data with the existing data". I couldn't work out what that step does. What should happen? |
| R10 | Month sheet and annual sheet for the same month | Default: the month sheet (it has the weekly detail) |
| R11 | Default year (Q1) | The most recent year **not in the future** where the first week starts on the week start day (2023 for the test files). Day sheets keep their own year. Annual-only files have no week, so the default is last year (2025), and the user must change it to 2023 for the test file |
| R12 | Q2 "existing item" in Incidentals | Also counts rows that have an estimate in any month or week sheet of the same file, so "QT Food" is an item in every month, not only in months where it has an estimate. Annual-only files have no estimates, so every Incidentals row not already in the app goes to Miscellaneous (QT Food, Date Day, …) |
| R13 | An existing item with purchases or an estimate gets its first child from the import | Its purchases, estimate and schedule move to a new Miscellaneous under it (the `0007` §2.1 pattern). Purchases that would land on a total row go to its Miscellaneous |
| R14 | Import into a database with no rows at all | The five top-level rows are created with their seed colors |
| R15 | A week sheet and a day sheet for the same day (`test_xlsx_week_day.xlsx`, 09/12) | Both import; nothing checks the overlap (the spec only covers month vs annual). Their 09/12 items differ in the invented data. Should overlapping week/day sheets be flagged like month/annual? |
| R16 | Dates outside 2000-01-01 to a year from today | Skipped with a row warning (the app's date limits) |
| R17 | Text in an amount cell ("Misc", "3 items", `=1+2`, `+5`) | Skipped with a row warning naming the cell |
| R18 | Extra checks | Besides week vs Monthly: a total row vs the rows under it, and the annual Misc row vs the Misc. Breakdown per month. Many fire on the test workbook (below) |
| R19 | .ods files before step 13a | Plain error: "is an ODS file, which can't be imported yet. Save it as .xlsx or .csv" |
| R20 | Limits (for the security review) | 5 MB file, 13 sheets, 5,000 rows and 256 columns per sheet, 300,000 cells, 40 MB unzipped, 2,000 zip parts, 500 characters per cell |
| R21 | Pay row description | The row's own name ("Employer"); a note is added after " — " |
| R22 | CSV sheet name | The file name without `.csv` |
| R23 | Preview dropdown choices | `targets[rowKey]` takes `'auto'`, `'skip'`, `'misc'` or `{ categoryId }` (an existing row). Choosing a new row name in the dropdown is left for step 14's design |

## Deviations

| # | What | Why |
|---|---|---|
| X1 | `fast-xml-parser` **5.11.2**, not 5.12.0 | 5.12.0 was published 2026-11-03, under two weeks old. **Security note:** 5.11.2 has advisory GHSA-474x-hrwr-fgx4 (low: slow parsing of unterminated "stop node" tags). It only affects the `stopNodes` option, which the importer doesn't use. 5.12.0 fixes it and becomes two weeks old on 2026-11-17. Upgrade then, or now? |
| X2 | `src/components/Backup.tsx` is not changed | Step 13 has no UI. The Import section belongs to steps 14 and 15 |
| X3 | `RESUME-HERE.md` is not updated yet | It gets marked ✅ in the single commit after your review |
| X4 | No commit | Per your instruction |

## Test sheet findings

These come from the sheets themselves, not the importer. Are they expected after the anonymizing?

- Subscriptions totals leave out a row in most months (Sep: rows $78, total $48).
- Feb "Drugs": week cells $128.25, Monthly $120.75.
- The annual sheet differs from the month sheets for Jan, Feb, Mar, Apr, Jul and Oct (Mar: annual $33,642.75, month sheet $25,391.25). For Oct the only difference is the Misc. Breakdown, which has no October entries ($455.25).
- Annual totals that don't match their rows: Charity, Incidentals, Insurance, Subscriptions.
- "Roth 401(k)" in the annual sheet becomes "Roth 401" (known; `0013` §4).

## New defect

**D003:** editing a purchase in the Day dialog resets its time and drops its import mark (`docs/defects/D003-day-edit-resets-time.md`). Imported Day times are lost on the first edit. Proposed for v0.6 with step 14 and added to the roadmap's v0.6 defect line. Confirm the version.

## For step 14 (not done here)

- The undated tooltip in the Day table.
- The preview screen: sheets to tick, year, conflicts, annual-existing choices, rows with target dropdowns, warnings, ignored columns, "Skip those items".
- Error and success messages. `ImportError` messages finish the sentence "Invalid: Import file …".
