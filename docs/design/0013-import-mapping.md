# 0013 — Import mapping (v0.6 steps 13–14)

**Status: reviewed 2026-11-11; ready for work.** Decided items are marked **Decided**; everything else is a proposal. Questions and their answers are in §12. Roadmap: v0.6 import items. Related: `0009` §5 (the Backup dialog holds Import), `0014` (Annual Misc. Breakdown), `docs/audits/security/security-v0.2.md` 1.1, 2.2, 6.2 (file handling).

## 1. Inputs

**Decided 2026-11-08:** the importer accepts CSV, XLSX and ODS. **Changed 2026-11-11:** ODS moves to its own item right after this one (roadmap and plan step 13a): the ODS test files written so far fail to open in OnlyOffice ("format error in content.xml"), so a valid ODS file is obtained first. This doc's rules apply to ODS too; step 13 builds CSV and XLSX only.

Test files are in `docs/test_sheets/` (anonymized copies of the human's real budget; amounts and names are changed, RV Spending and Mom Support are removed; Counselor and Psychiatrist stay). **Commit plan (human, 2026-11-11):** they are committed once this doc is ready for work, and the next commit follows when the import is complete.

| File set | Content |
|---|---|
| `test_csv_4_wk_mn.csv`, `test_csv_5_wk_mn.csv`, `test_csv_annual.csv` | One sheet each: September (4 weeks), October (5 weeks, has a DIF column), Annual (with the Misc. Breakdown table under it) |
| `test_xlsx_import_data.xlsx`, `test_ods_import_data.ods` | The same 13-sheet workbook in two formats (active tab: Sep). The ODS file is known not to open in OnlyOffice and is not used until step 13a. Sheets: Jan to Nov, Annual, and " Subscriptions " (a non-budget sheet the importer must skip; note the spaces in its name) |
| `test_csv_week.csv`, `test_csv_day.csv`, `test_xlsx_week_day.xlsx` | **Invented data** (not from the human's budget), written 2026-11-11 because the real files have no Week or Day sheets. A Week sheet: names in A to D, an Est. and Act. pair for each of the 7 days (headed `MM/DD`), then a Weekly pair that sums the days, then a notes column. A Day sheet (the human corrected its layout 2026-11-11): the full date in A1, amounts in D, times in E |

Things in the files the importer must handle:

- Week and Monthly columns can be hidden in a workbook; hidden columns still hold data.
- Week headers are merged cells (one header over an Est. and an Act. column). In CSV only the first column of the pair has the text.
- XLSX and ODS cells can hold formulas (sums such as `=13.5+27+3`) with a stored result. CSV holds only the result.
- XLSX and ODS cells can have notes (for example "$172.50 New Glasses").
- Messy text: misspellings ("Expences", "Maintainance"), notes in names ("Charity (cash / dd)"), `$-135.50` negatives, accounting-style text (`_($* 593.02_)`, `$198.50_)`), blank cells mixed with `$0.00`, a UTF-8 byte order mark on the CSVs.

## 2. Safety (applies to every format)

- Formulas are never calculated or run. Only stored values are read. Text starting with `=`, `+`, `-` or `@` is data, never evaluated, and is escaped if the app ever writes it back to a spreadsheet.
- Limits (proposed, to review in the security step): file size, number of sheets, number of cells, and the size after unzipping XLSX and ODS (zip bombs). Over a limit the import stops with a plain error and writes nothing.
- **Decided 2026-11-11:** at most 13 sheets in a file (one per month plus the annual sheet). More than that is refused.
- Nothing is written until the user confirms the preview (step 14). A failed or cancelled import changes nothing. The write is one database transaction.
- No network access, no macros, no external links, no embedded objects.

## 3. Finding the data

1. **Sheets.** A workbook lists its sheets. A sheet is a *month sheet* when row 1 has two or more week ranges (`MM/DD - MM/DD`) and a "Monthly" header. It is a *week sheet* when row 1 has two or more single dates (`MM/DD`) and a "Weekly" header. It is a *day sheet* when row 1 has one full date (`MM/DD/YYYY`) and a "Time" header. It is an *annual sheet* when row 1 has the headers Jan to Dec. Any other sheet (such as " Subscriptions ") is listed as skipped. The user can untick sheets in the preview. A CSV is one sheet; its type is detected the same way.
2. **Date columns.** Each date header covers two columns, Est. then Act. In a month sheet the headers are week ranges and the Monthly header covers the last pair (4 or 5 weeks, from the headers, not from the month). In a week sheet the headers are the 7 days and the Weekly header covers the last pair (the sum of the days). Columns to the right of Monthly are ignored (§8).
3. **Name columns.** Names are in columns A to D. A row's level is the first non-empty column among them (A = category, B = subcategory or item, C = item under a subcategory). Level builds the tree: a row belongs to the nearest row above it with a lower level.
4. **Amounts.** Parse the text or number: strip `$`, spaces, thousands commas, a leading `_(` and trailing `_)`; `$-135.50` and `(135.50)` are negative; an empty cell and `$0.00` mean no amount.
5. **Year.** The month sheets give month and day only (**open, Q1**).

## 4. Month sheet to budget tree

| Sheet row | Becomes |
|---|---|
| Row above "Incidental Income" (the employer name in the test files) | Income › Pay. The sheet's name for it is used as the purchase description |
| Incidental Income | Income › Incidental Income |
| Taxes | Taxes |
| Net Income | Skipped (computed) |
| Savings and its items | Savings and items under it. The Savings row is a total, skipped |
| "Expences" or "Expenses" and everything under it | Expenses and its subcategories and items |
| Any row with rows under it | A total. Skipped as an amount; its name creates a subcategory if none matches |
| Any row without rows under it | An item (or a subcategory that takes purchases, when it sits directly under a top-level category, as Groceries does in the app) |

**Names.** **Decided 2026-11-11:** remove parentheses and everything inside them ("Charity (cash / dd)" becomes "Charity", "Medical Ins. (ck)" becomes "Medical Ins."). Then trim and collapse spaces. Matching an existing node is case-insensitive and ignores spaces at the ends. Known spelling aliases are applied (Expences to Expenses, Maintainance to Maintenance); a general spell check belongs to the v0.7 input parsing item. Consequence to know: "Roth 401(k)" becomes "Roth 401", which does not match the monthly sheets' "Roth 401k". The preview shows the proposed target for every row and lets the user change it (§9).

**Matching.** A row's parent chain is matched to the existing tree by name. A match uses the existing node. No match creates a new node under the matched parent, with the colour of its siblings.

**Miscellaneous.** In Incidentals, rows after the usual items hold one-off purchases (Drugs, Boardgame, Cup, and so on). In the sheet they have no estimate and appear in one week. **Proposed:** these become purchases in Incidentals › Miscellaneous, with the row's name as the purchase description, so the Annual Misc. Breakdown (`0014`) can group them. How to tell a Misc row from a normal item is **open, Q2**.

**Charity.** Follows `0009` §6: purchases go to Charity until it has items; importing items under it makes it a total and moves its own purchases to Charity › Miscellaneous.

## 5. Amounts and dates

**Actuals (Act. columns).** Each non-empty, non-zero Act. cell becomes one purchase on a leaf row. A negative cell is a negative purchase (a credit; the Day table shows it as a return once that v0.7 item lands).

**Dates. Decided 2026-11-11:** if the file has a date for a purchase, use it. If it has none, add the purchase to the first day of the week it appears in. For a month sheet that is the first date of the week header (for example `09/03`). For an annual sheet's month cell it is the first day of that month. A week sheet's day columns each have a date (month and day; the year comes from Q1), so those purchases are dated and not marked. A day sheet has a full date, so its purchases are dated and not marked.

**Day sheet rows.** A row with a value in the Time column is one purchase (the amount is in column D). Rows without a Time are the tree (§4). The row's name is matched against the items under the row above it: a match makes it a purchase of that item (Coffee Shops); no match makes it the description of a purchase on the row above, which takes purchases directly ("Weekly shop" on Groceries). The preview shows the choice and lets the user change it. The time is kept so the Day table shows the purchases in the same order and with the same times (**Q10**). Every purchase row in the Day test sheet has an amount and a time; the totals above it add up.

**Undated purchases. Decided 2026-11-11:** every purchase whose date was not in the file is marked, and the Day table shows a tooltip note on that purchase, for example "Date not in the imported file. Placed on the first day of the week." The mark is stored on the purchase (an optional field, not indexed, so no database version bump). The tooltip must work by keyboard and screen reader (the tooltip component is not specified yet in `components.md`; it is specified when built).

**One cell, one purchase.** A sum such as `=13.5+27+3` imports as one purchase with the stored total, in every format, so the three formats give the same result. Splitting the terms into separate purchases is possible in XLSX and ODS only, so it is not proposed (**open, Q4**).

**Cell notes. Decided 2026-11-11:** XLSX and ODS cell notes become the purchase description. CSV has none.

**Estimates (Est. columns).** **Proposed:** the Monthly Est. total becomes the item's estimate with frequency Monthly. The weekly Est. cells are not used to guess a schedule or due day (**open, Q3**).

**Checks.** The preview adds each row's week Act. cells and compares the sum with its Monthly Act. cell. A difference shows as a warning on that row; it does not block the import.

## 6. Already-imported data

Importing the same sheet twice would double the amounts. **Decided:** before writing, the preview counts how many purchases already exist for the same item in the same date range and warns; the user can choose "Skip those items" (**closed, Q6**).

## 7. Annual sheet and the Misc. Breakdown table

The annual sheet repeats what the month sheets hold, so importing both would double every amount. **Decided 2026-11-11:** when a file has a month sheet and the annual sheet for the same month, the preview flags it and the user chooses which to use for that month.

**Decided 2026-11-11** (the rare case where an annual sheet is imported without a matching month sheet): each month cell becomes one purchase dated the first day of the month (undated mark, §5). If that month already has data in the app, the preview asks the user to either import the month from the annual sheet as described, or use the existing data. If they choose the existing data, it then asks whether to replace the imported annual data with the existing data.

The Misc. Breakdown table sits under the annual table (header "Misc. Breakdown"; each row is a name with a value per month and a total). When the annual sheet is the source for a month, the main table's "Misc" row is skipped and the breakdown rows are imported instead: each month cell becomes a purchase in Incidentals › Miscellaneous with the row name as description. Empty rows below the table (the sheet leaves many) are ignored. The app side of this table is specified in `0014`.

## 8. Content that is ignored

- The DIF column and any other column right of Monthly (the notes column, stray numbers such as `103.5` beside "RV Ins. 13th", a note such as "Lower to $150"). **Decided 2026-11-11:** the DIF column is dropped. The preview lists ignored columns by header so nothing disappears silently.
- Monthly Est. and Act. totals other than for the check in §5.
- Computed rows (Net Income, totals), blank rows, rows under the Misc. Breakdown that have no name.
- Sheets that are not month or annual sheets.

## 9. What the user sees (for step 14)

1. Choose a file. Errors in plain text: type not supported, too large, could not be read, no budget sheets found.
2. A preview table: sheets found (tick to include), the year, then one line per row with its proposed target (existing item, new item, Miscellaneous, skipped) and a dropdown to change it, the number and total of purchases, and warnings.
3. Confirm. Success message says how many purchases and new items were added (the `0009` "Saved" wording style).

The UI is designed and approved in step 14, not here.

## 10. Library (needs the human's approval before anything is installed)

| Option | Notes |
|---|---|
| `xlsx` (SheetJS) 0.18.5 from npm | Reads CSV, XLSX and ODS. The npm copy was last published 2022-03-24; the maintainers distribute newer builds from their own site. I'd check its advisories before using it | 
| `@e965/xlsx` 0.20.3 | A fork of SheetJS on npm, last published 2024-07-19. Same API |
| `fflate` 0.8.3 plus `fast-xml-parser` 5.12.0 and a small CSV reader | What the test sheets were checked with (the same approach, in Python). Reads values only, so no formula engine and a small attack surface. More code to write and test |

**Decided 2026-11-11:** the third. Only stored values are needed and it keeps the surface small; fall back to the second if ODS edge cases cost too much. Versions must be at least two weeks old when pinned. Nothing is installed until the human says so when the step starts.

## 11. Test plan

Each test sheet imports into an empty database and into the seeded one. Checks: the number of purchases and total per month match the sheet's Monthly Act. column; no `RV Spending` or `Mom Support` rows exist; Misc rows land in Incidentals › Miscellaneous with descriptions; every undated purchase shows its tooltip; the three formats give the same result; the annual-only import and the workbook import give the same totals; malformed, oversized and zip-bomb files fail safely; a formula cell never changes a value.

## 12. Questions and answers

| # | Question | Answer |
|---|---|---|
| Q1 | The month sheets have no year. Which year do the dates get? | **Decided 2026-11-11:** ask in the preview. Default: the most recent year where the first week's start date falls on the user's week start day, otherwise last year |
| Q2 | How does the importer tell a Misc row in Incidentals from a normal item? | **Decided 2026-11-11:** a row is Misc when its name is not an existing item (after the §4 name cleaning and aliases) and it has no estimate in the month. The preview shows each decision and lets the user change it with a dropdown. A dedicated "move to Incidentals" button is a v0.7 design question (`0014` M6) |
| Q3 | Estimates: Monthly Est. total only, or also a schedule? | **Decided 2026-11-11:** the Monthly total only |
| Q4 | A cell such as `=13.5+27+3`: one purchase or three? | **Decided 2026-11-11:** one. Individual purchases are tracked in the Day table. A popup listing an item's purchases and a search by name, date or amount are logged as unscoped ideas in the roadmap |
| Q5 | Cell notes ("Window replacement", "$172.50 New Glasses"): use as the purchase description? | **Decided 2026-11-11:** yes, in XLSX and ODS (CSV has none) |
| Q6 | Warn and skip when purchases for the same item and dates already exist? | **Decided 2026-11-11:** yes (§6) |
| Q7 | A file with a month sheet (say September) and the annual sheet: the annual sheet's September column holds the same amounts, so importing both counts September twice. Use the month sheet and skip the annual sheet's September? | **Decided 2026-11-11:** the importer flags it and the user chooses which to use. (The rules in §7 cover the other case, an annual sheet with no month sheet) |
| Q8 | Which library? | **Decided 2026-11-11:** `fflate` plus `fast-xml-parser` and a small CSV reader (§10) |
| Q9 | Savings Act. values that are leftovers (the RV Fund value is the planned amount minus other RV costs, so some weeks are negative): import them as they are? | **Decided 2026-11-11:** yes, as negative purchases, and note it in the preview |
| Q10 | Day sheet: keep the Time column so the Day table shows the same times and order? | **Decided 2026-11-11:** yes |
| Q11 | The first Day sheet draft had a Pet Stuff row followed by a Treats row. | **Closed 2026-11-11:** the human was roughing out the depth. The Day sheet now has one row per purchase, each with an amount and a time |
