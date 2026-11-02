/**
 * Items preselected in Budget setup (stuff.md: "Income, Tax, Emergency fund,
 * Charity, and a few other items"). Each entry is [name, parent name or null].
 */
export const PRESELECTED: [string, string | null][] = [
  ['Pay', 'Income'],
  ['Taxes', null],
  ['Emergency', 'Savings'],
  ['Charity', 'Expenses'],
  ['Miscellaneous', 'Charity'],
  ['Groceries', 'Expenses'],
  ['Mortgage', 'Debt'],
  ['Power', 'Utilities'],
  ['Internet', 'Utilities'],
  ['Phone', 'Utilities'],
]

export const isPreselected = (name: string, parent: string | null) =>
  PRESELECTED.some(([n, p]) => n === name && p === parent)
