# Questions and best guesses — tester feedback, 2026-11-26

Logged while the human was away. Each question has the guess I acted on. Roadmap: `docs/design/0003-roadmap.md` (v0.8 "Tester feedback", Post v1.0 "Manual sort"). Nothing is committed.

## Placement

| # | Question | Guess acted on |
|---|---|---|
| 1 | Should any tester-feedback update move into v0.7 instead of v0.8? (asked, no answer) | All stay in v0.8. v0.7 only gets the two defects (step 15c), because sync and the Edit menu are v0.7 work and the reviews come next. |
| 2 | Where does "work out a great manual sort solution" go? | Post v1.0. It needs design first, and v0.8 just moved to alphabetical order; bringing manual order back before v1.0 would mean two changes to the same tables. |
| 3 | Where should this questions log live? | `docs/review-questions/`, one file per session. |
| 4 | Should I start building while you were away? | No. Docs only. Next step per RESUME-HERE is still group D (import regression). |

## Update 5 — Actions and Update

| # | Question | Guess acted on |
|---|---|---|
| 5 | The new menu has only New purchase and Update. Where does Delete go (today in the Edit menu for Day and Week; update 3 asks for delete on the Add purchase Day table)? | A Delete button inside the Update dialog, in every table that allows delete today plus the Add purchase Day table. |
| 6 | Annual has no Edit menu today, only a pencil Rename button. Does it get Actions too? | Yes, same menu as Week and Month ("all tables except Day"); the pencil goes. **Corrected (human, 2026-11-26):** no. Annual keeps only the pencil Rename, a convenient bulk name change; no other bulk change across 12 months. Reason recorded in `0009` §4. |
| 7 | In Week/Month, what are "name" and "amount" in the Update dialog? A row there is an item total, not a purchase. | Name renames the item (all instances, as Rename does today). Amount is the Add/Subtract adjustment. |
| 8 | For a Day purchase, what is "name"? A purchase has an item and an optional description, not its own name. | Name is the description; the item is changed through "Move to". |
| 9 | "Move to" lists only categories and subcategories. Where does a Day purchase go when moved to a subcategory that has items, or to a category? | Same as update 2: a subcategory with items sends it to its Miscellaneous item (created if missing). A category follows the Charity rule (`0009` §6). |
| 10 | Does Budget setup keep its own Move column (reorder)? | No. Alphabetical sort applies everywhere, so Budget setup reordering goes too. |

## Sort order

| # | Question | Guess acted on |
|---|---|---|
| 11 | Is Miscellaneous sorted alphabetically like any other row, or always last? | Alphabetical, as you wrote. Many budgets put it last; worth a look. |
| 12 | "Income, Savings, Expenses": the top level today is Pay, Incidental Income, Taxes, Net Income, Savings, Expenses (`0004`). | The top level and its computed rows keep their fixed order. Alphabetical sorting starts one level down. |

## Other updates

| # | Question | Guess acted on |
|---|---|---|
| 13 | Update 8: what counts as "mobile"? | Below 640px. Previous and Next keep their size; the title button grows to fill the rest. This also matches the global rule that form controls fill their container (`components.md`). |
| 14 | Update 9: do the height query (480px) and `prefers-reduced-motion` count toward the 3–4 media queries? | Reduced motion does not count, since it is an accessibility setting and not a layout breakpoint. The height query does count. |
| 15 | Update 4: once the Day view is gone, which view does the Budget screen open on? | Week. |
| 16 | Update 1: may the new subcategory be created under every category, including the Income group and Taxes? | Yes, under every category that is not a computed row. |

## Draft global rule change (for the human to apply)

File: `~/.claude/rules/dev-workflow.md`, section `## Iteration`, as a new bullet right after "New requirements go into the relevant design doc **and** the roadmap (if they are scope)."

```markdown
- **Placing new items.** When the user adds an item without a version, or calls it a "future feature", place it on the roadmap yourself; do not ask. Pick the most sensible spot after the current version (never the version being built):
  - a later version, when the item fits that version's theme and its dependencies land first;
  - "Post v1.0", when it needs design work first or is not needed for v1.0;
  - "Unscoped ideas", only when it is too vague to place.
  Add "(future feature, logged {date})" or "(decided {date})", and say in one line where it went and why. If the user names a version, use it.
```

Once this is in place, the project memory `new-item-placement` repeats it and can be deleted (otherwise the rule loads twice).
