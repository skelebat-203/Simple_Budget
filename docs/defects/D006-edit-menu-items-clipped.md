# D006 — Edit menu items clipped on the left

- Found: 2026-11-26, in phone testing.
- Severity: Low (the menu still works; some text is cut off).
- What happens: when the user chooses Edit on a highlighted row (highlight dialog), the left ~15px of the menu items is sometimes cut off. "Sometimes": not yet tied to a row, width or scroll position.
- Expected behavior: the whole menu is always visible.
- Suspects (not yet checked): the `floating` ActionsMenu from v0.7.42 positioned beyond the left edge of the dialog or table box; the table's sideways scroll offset.
- Files: `src/components/ui/` (ActionsMenu), `src/components/BudgetTable.tsx`, `src/App.css`.
- Scheduled: v0.7 step 15c, before the reviews.
- Cause: the highlight dialog's Edit menu opened leftward from a button near the left edge, past the table box, which clips its overflow.
- Fixed (v0.7.48): every row menu is placed against the window and kept inside it (`ActionsMenu`), as Move to already was. Verified fixed by the human on 2026-11-26.
