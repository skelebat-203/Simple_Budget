# Table design

Companion to `0003-roadmap.md`. Source of truth for the budget table structure,
category hierarchy, colors, and computed rows.

## Structure

```
{Category}
    |_{item}
    |_{subcategory}
        |_{item}
```

Categories sit at indent 0, their subcategories at indent 1, and subcategory
items at indent 2. Category and subcategory rows are expand/collapseable when
they contain at least one item; the last state is persisted across range
changes and app restarts.

### Day

- Row 1 — Cell 2: Estimate (Est.); Cell 3: Actual (Act.)
- Row {nn} — only items added that day

### Week

- Row 1 — Cell 1 blank; Cells 2 & 3: date spanning 2 columns
- Row 2 — Cell 2: Estimate (Est.); Cell 3: Actual (Act.)
- Row {nn} — Cell 1: category / item; Cell 2: estimated value; Cell 3: actual value

### Month

- Same as week, but display Est./Act. columns for each week
- Last 2 columns: Est. cells added together, Act. cells added together

### Annual

- Same as month, but display Est./Act. columns for each month

## Style

- Only add a category if an item inside it has an amount
- Only add an item if it has an amount

### No indent

- Pay
- Incidental Income
- Taxes
- Net Income
- Savings
- Expenses

### 1 indent

- All savings items
- Subexpense categories

### 2 indents

- Expense subcategories

## Colors

| Color | Applies to |
|-------|-----------|
| Blue | Pay, Incidental Income |
| Red | Taxes |
| Highlight blue | Net Income |
| Green | Savings |
| Lighter green | All savings items |
| Orange | Expenses |
| Lighter orange | Subexpense categories |
| Even lighter orange | Expense category items |

## Category hierarchy (seed data)

Top-level categories, with computed rows marked `*` (calculated, not user-addable).

- Pay
- Incidental Income
- Taxes
- Net Income `*` (Pay + Incidental Income − Taxes)
- Savings `*` (sum of savings items)
  - Deferred exploration: whether Savings should be computed as (income −
    spending) rather than summed from savings items. Difficult because the user
    can add custom items and categories. Revisit once basic functionality is
    built.
- Expenses `*` (sum of expense subcategories)

### Savings items

- General Maintenance
- Emergency
- Roth 401k
- Traditional 401k
- Roth IRA
- IRA
- 403b
- HSA
- FSA

### Expenses

#### Subcategories (used to calculate "Expenses")

Groceries, Gas and Gifts have no items; amounts are entered on the subcategory
itself. The same applies to Pay, Incidental Income and Taxes.

- Groceries
- Gas
- Gifts
- Charity  `*` (sum of Charity items)
  - purchases: see `0009` §6 (Charity itself until it has an item, then Miscellaneous)
- Incidentals `*` (sum of incidentals items)
- Medical  `*` (sum of Medical items)
  - user amounts route to the Medical subcategory "Miscellaneous"
- Insurance  `*` (sum of Insurance items)
- Maintenance  `*` (sum of Maintenance items)
- Debt  `*` (sum of Debt items)
- Utilities  `*` (sum of Utilities items)
- Subscriptions  `*` (sum of Subscriptions items)

#### Charity items

- Miscellaneous
- United Way
- Wikipedia
- Library

#### Incidentals items

- Coffee Shops
- Treats
- Snacks
- Pet Stuff
- Eat Food Out
- Dates
- Family Time
- Clothing
- Shoes
- General Self Care
- Books
- Alcohol
- Hair Cuts
- Decorations
- Crafting
- Miscellaneous

#### Medical items

- Miscellaneous

#### Insurance items

- Car
- Life
- Medical
- Dental
- Vision

#### Maintenance items

- Car
- House
- Lawn Mowing
- Miscellaneous

#### Debt items

- Mortgage
- Credit Card

#### Utilities items

- Power
- Water
- Internet
- Phone
- Trash

#### Subscriptions items

- Netflix
- YouTube Premium
- Prime
- Dropout
- Duolingo
- LastPass
- 1Password
- Proton Suite
- Nebula
- Gym
- Audible
- Librio.fm

## Other

Design decisions for flows built elsewhere (versions in `0003-roadmap.md`):

- Toggle estimates on/off (default on).
- When adding a new item or category, ask for an estimated spend plus a
  recurrence dropdown: day / week / month / bimonthly / every 2 weeks.
- Onboarding questionnaire (first-time setup):
  - How often do you get paid? (day / week / month / bimonthly / every 2 weeks)
  - Add spending and savings categories? Yes / No
    - Yes → multi-select dropdown of all pre-loaded categories plus "add your
      own"; populate the weekly, monthly, and annual tables with selections;
      include autocomplete.