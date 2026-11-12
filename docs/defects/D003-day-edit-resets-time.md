# D003 — Editing a purchase resets its time and drops its import mark

- Found: 2026-11-11, while building import parsing (v0.6 step 13).
- Severity: Low (no data is lost; the purchase's shown time and order change).
- What happens: the Day table's Edit dialog saves through `budgetItemRepo.replace` (or `addNewItem` with `replaceId`), which deletes the purchase and adds a new one. The new record gets `createdAt` = now, so the Day table shows the edit time instead of the purchase time and moves the purchase to the end of the day. It also drops the `undated` mark that imported purchases carry (0013 §5), so the tooltip note disappears even when only the amount changed.
- Why it matters now: imported Day-sheet purchases keep the sheet's time in `createdAt` (0013 Q10). One edit loses it.
- Repro: add a purchase at 9:00, edit its amount at 15:00; the Day table shows 3:00 PM and lists it last.
- Expected behavior (human, 2026-11-11): updating a purchase's amount does not reset its time or remove its import mark.
- Fix: keep `createdAt` from the old record on replace. Keep `undated` unless the date was changed.
- Files: `src/storage/repository.ts` (`budgetItemRepo.replace`, `addNewItem`), `src/components/BudgetTable.tsx` (the edit save).
- Scheduled: v0.6, step 14 (import flow UI). Confirmed by the human 2026-11-11.
