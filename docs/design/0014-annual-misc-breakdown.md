# 0014 — Annual table: Misc. Breakdown (v0.7)

**Status: draft for human review (2026-11-11).** Requested by the human on 2026-11-11 from the manual spreadsheet the app replaces. Roadmap: v0.7 item "Annual Misc. Breakdown". Related: `0004` (table design), `0013` §7 (importing it), `0009` §4 (purchase description).

## 1. Why

Through a year many things are bought only a few times. Listing each as its own row in the Annual table makes it hard to read. The spreadsheet keeps them under one "Misc" row in the main table and lists each one in a second table, "Misc. Breakdown", under it. The human reviews that table at the end of the year to decide what to add to the main table for next year.

## 2. Structure

- The Annual table gets a Misc row under Incidentals (the Incidentals › Miscellaneous item). It shows the total for the month, like any item.
- Under the Annual table is a second table, **Misc. Breakdown** (its placement is open, M5). One row per distinct purchase description among the Miscellaneous purchases of the year (case-insensitive, spaces at the ends ignored; a purchase with no description is grouped as "No description"). Columns match the Annual table: Jan to Dec and Total. Rows are in alphabetical order. The table has a visual heading and a programmatic name (`digital_accessibility.md`).
- The sum of the breakdown equals the Misc row of the Annual table.
- Read-only, like the other tables.

## 3. December review

**Intent (human):** in December, highlight anything listed more than 6 times over the year, so it can be reviewed for the main table.

- **Proposed:** the highlight shows when the table's year has reached December (viewing a past year, or the current year from 1 December). Before that nothing is highlighted.
- A highlighted row carries visible text, not colour alone: a Warning icon with alt text "Review" in the row and a style that follows the hover and highlight standards in `0012` + bold & italic styles. The label is announced by screen readers.
- A short line above the table explains it, for example "Items bought more than 6 times this year. Consider adding them to the table."

## 4. Open questions

| # | Question | Proposal | HUMAN COMMENT |
|---|---|---|---|
| M1 | "Listed more than 6 times": the number of purchases, or the number of months the item appears in? | Purchases. (In the spreadsheet each row has one cell per month, so it counts months; the app keeps each purchase, so purchases are more exact) | Mounths not purchases - things happen in life and may require multiple purchases to resolve/handle. By tracking months we are better able to see habits |
| M2 | Should a highlighted row have an action such as "Add as an item" that creates it in the main table? | Not in v0.7. Review is manual, as in the spreadsheet | Yes "Add as item" button in each row of the table (whether or not they are in review) | 
| M3 | Which Miscellaneous items count? The seed has Miscellaneous under Charity, Medical and Maintenance but not Incidentals. | Incidentals only, as in the spreadsheet; add Incidentals › Miscellaneous to the seed and the presets (this needs a database migration for existing users) | Agreed |
| M4 | The threshold of 6: fixed, or a setting? | Fixed | Make it a setting, with the default as 6 |
| M5 | Should the Misc. Breakdown be its own table under its own tab, so Annual has a toggle [Main data \| Misc. Incidentals] instead of two stacked tables? (Human, 2026-11-11.) | Not decided. Decide when v0.7 starts, before the Annual table work, because it changes §2 and the December review line | Agreed - this will need a mockup of both versions completed for human to review |
| M6 | Should the user be able to move an item from the Misc. table into Incidentals with a dedicated button, to make the shift quick and easy? It could also be an optional review step in the import. (Human, 2026-11-11.) | Not decided. Not needed for v0.6: the import preview already lets the user change a row's target. Decide with M5 in v0.7 | Agreed |


