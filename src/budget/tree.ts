// Pure logic for the category tree, display periods and estimates.
// Structure and rules: docs/design/0004-table-design.md, docs/human_scratch_files/stuff.md.
import type { BudgetItem, Category, Frequency, MonthBoundary, Range } from '../storage/db'
import { slug } from './validate'

export type Cat = Category & { id: number }

export interface CatNode {
  cat: Cat
  depth: number
  parent: CatNode | null
  children: CatNode[]
}

/** Build the tree. Siblings follow their stored `order` (0007 §5.3), then id. */
export function buildTree(cats: Category[]): CatNode[] {
  const nodes = new Map<number, CatNode>()
  for (const c of cats) if (typeof c.id === 'number') nodes.set(c.id, { cat: c as Cat, depth: 0, parent: null, children: [] })
  const roots: CatNode[] = []
  const rank = (c: Cat) => c.order ?? Number.MAX_SAFE_INTEGER
  for (const n of [...nodes.values()].sort((a, b) => rank(a.cat) - rank(b.cat) || a.cat.id - b.cat.id)) {
    const p = n.cat.parentId == null ? undefined : nodes.get(n.cat.parentId)
    if (p) { n.parent = p; p.children.push(n) } else roots.push(n)
  }
  const finish = (n: CatNode, depth: number) => {
    n.depth = depth
    n.children.forEach(c => finish(c, depth + 1))
  }
  roots.forEach(r => finish(r, 0))
  return roots
}

/** Pre-order list of every node. */
export const flatten = (nodes: CatNode[]): CatNode[] => nodes.flatMap(n => [n, ...flatten(n.children)])

export const ancestors = (n: CatNode): CatNode[] => (n.parent ? [...ancestors(n.parent), n.parent] : [])

export const subtree = (n: CatNode): CatNode[] => [n, ...n.children.flatMap(subtree)]

/** Total row: a top-level computed row, or a subcategory that has items (0007 §2.1). */
export const isTotal = (n: CatNode) => !!n.cat.computed || n.children.length > 0

const BILL_GROUPS = new Set(['Debt', 'Utilities', 'Subscriptions'])
const rootOf = (n: CatNode): CatNode => (n.parent ? rootOf(n.parent) : n)
const inBillGroup = (n: CatNode) => ancestors(n).some(a => BILL_GROUPS.has(a.cat.name))

/** Recurrence and autopay belong to every row that holds a manual estimate: any non-total row (0007 §3). */
export const recurrenceApplies = (n: CatNode) => !isTotal(n)
export const autopayApplies = recurrenceApplies

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'biweek', label: 'Every 2 weeks' },
  { value: 'bimonthly', label: 'Bi-monthly (twice a month)' },
  { value: 'month', label: 'Monthly' },
]

/** Debt, Utilities and Subscriptions items also get Quarterly and Annual (0007 §3). */
export const frequenciesFor = (n: CatNode) => inBillGroup(n)
  ? [...FREQUENCIES, { value: 'quarter' as const, label: 'Quarterly' }, { value: 'annual' as const, label: 'Annual' }]
  : FREQUENCIES

/** Occurrences per month. Day-based scaling below stays until v0.4 (security-v0.2 3.4). */
export const PER_MONTH: Record<Frequency, number> = { day: 30.44, week: 52 / 12, biweek: 26 / 12, bimonthly: 2, month: 1, quarter: 1 / 3, annual: 1 / 12 }

/** Estimate for one node over `days` days. No recurrence = monthly. */
export function estimateFor(c: Category, days: number): number {
  if (!c.selected || !c.estimate) return 0
  return (c.estimate * PER_MONTH[c.frequency ?? 'month'] * days) / 30.44
}

// ---------- periods ----------

export interface Period { label: string; from: string; to: string; days: number }

/** Local-date YYYY-MM-DD (toISOString would shift to UTC). */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const span = (from: Date, to: Date): Period =>
  ({ label: `${short(from)} – ${short(to)}`, from: isoDate(from), to: isoDate(to), days: Math.round((to.getTime() - from.getTime()) / 864e5) + 1 })

/** Calendar settings (0007 §1): week start day (0 = Sunday) and month boundaries. */
export interface Calendar { weekStart: number; monthBoundary: MonthBoundary }
export const DEFAULT_CALENDAR: Calendar = { weekStart: 0, monthBoundary: 'weeks' }

/** First day of the week containing `d`. */
export const weekStartOf = (d: Date, weekStart: number) => addDays(d, -((d.getDay() - weekStart + 7) % 7))

/**
 * Columns for a range. Week = the week containing today. Month = one column
 * per week plus a total: whole weeks from the first week start on or after
 * the 1st, or (calendar) weeks clipped to the month.
 */
export function periodsFor(range: Range, today: Date, cal: Calendar = DEFAULT_CALENDAR): { columns: Period[]; total: Period | null; title: string } {
  if (range === 'day') {
    const d = isoDate(today)
    const label = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    return { columns: [{ label, from: d, to: d, days: 1 }], total: null, title: label }
  }
  if (range === 'week') {
    const s = weekStartOf(today, cal.weekStart)
    return { columns: [span(s, addDays(s, 6))], total: null, title: `Week of ${short(s)}` }
  }
  if (range === 'annual') {
    // Calendar months, so no day falls in two columns.
    const y = today.getFullYear()
    const columns = Array.from({ length: 12 }, (_, m) => {
      const p = span(new Date(y, m, 1), new Date(y, m + 1, 0))
      return { ...p, label: new Date(y, m, 1).toLocaleDateString(undefined, { month: 'short' }) }
    })
    return { columns, total: { ...span(new Date(y, 0, 1), new Date(y, 11, 31)), label: 'Total' }, title: String(y) }
  }
  let monthOf = new Date(today.getFullYear(), today.getMonth(), 1)
  // Whole weeks: days before this month's first week start belong to last month's period.
  if (cal.monthBoundary === 'weeks') {
    const s0 = weekStartOf(monthOf, cal.weekStart)
    const start = s0 < monthOf ? addDays(s0, 7) : s0
    if (today < start) monthOf = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  }
  const title = monthOf.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  let first = new Date(monthOf.getFullYear(), monthOf.getMonth(), 1)
  let last = new Date(monthOf.getFullYear(), monthOf.getMonth() + 1, 0)
  if (cal.monthBoundary === 'weeks') {
    // First week-start day on or after the 1st; ends the day before next month's start (0007 §1.2).
    const startOf = (y: number, m: number) => { const d = new Date(y, m, 1); const s = weekStartOf(d, cal.weekStart); return s < d ? addDays(s, 7) : s }
    first = startOf(monthOf.getFullYear(), monthOf.getMonth())
    last = addDays(startOf(monthOf.getFullYear(), monthOf.getMonth() + 1), -1)
  }
  const columns: Period[] = []
  for (let s = first; s <= last;) {
    let e = addDays(weekStartOf(s, cal.weekStart), 6)
    if (e > last) e = last
    columns.push(span(s, e))
    s = addDays(e, 1)
  }
  return { columns, total: { ...span(first, last), label: 'Total' }, title }
}

/** Day and Annual tables show actuals only (0007 §7.2, §7.4). */
export const rangeHasEstimates = (r: Range) => r === 'week' || r === 'month'

/** Sum of amounts in `n`'s subtree within the period. */
export function actualFor(n: CatNode, p: Period, items: BudgetItem[]): number {
  const ids = new Set(subtree(n).map(x => x.cat.id))
  return items.filter(i => ids.has(i.categoryId) && i.date >= p.from && i.date <= p.to).reduce((a, i) => a + i.amount, 0)
}

/** Estimate for the period: a total sums its children; any other row uses its own (0007 §2.1). */
export const estimateTotal = (n: CatNode, p: Period): number =>
  n.children.length ? n.children.reduce((a, c) => a + estimateTotal(c, p), 0) : estimateFor(n.cat, p.days)

export const formatAmount = (n: number) =>
  n === 0 ? '' : (n < 0 ? '−' : '') + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Label used where a name repeats (e.g. "Car (Insurance)"). */
export const displayName = (n: CatNode) => (n.depth >= 2 && n.parent ? `${n.cat.name} (${n.parent.cat.name})` : n.cat.name)

/** Child color by parent (0004 Colors; Income is blue at every level, 0007 §2). */
export function childColor(parent: CatNode): string {
  const root = rootOf(parent).cat.name
  if (root === 'Income') return 'blue'
  if (root === 'Taxes') return 'red'
  if (root === 'Savings') return 'lighter-green'
  return parent.parent ? 'even-lighter-orange' : 'lighter-orange'
}

/** Names that appear on more than one row (0007 §8). */
export const repeatedNames = (roots: CatNode[]) => {
  const count = new Map<string, number>()
  for (const n of flatten(roots)) count.set(n.cat.name, (count.get(n.cat.name) ?? 0) + 1)
  return new Set([...count].filter(([, c]) => c > 1).map(([name]) => name))
}

/** Accessible name: "Name, Parent" when the name repeats (0007 §8.3). */
export const spokenName = (n: CatNode, repeated: Set<string>) =>
  repeated.has(n.cat.name) && n.parent ? `${n.cat.name}, ${n.parent.cat.name}` : n.cat.name

/** DOM id per the CLAUDE.md convention: {field}-{parent}-{item}-{databaseId}. Unsaved rows (negative ids) use new{n}. */
export const domId = (field: string, n: CatNode) =>
  [field, n.parent && slug(n.parent.cat.name), slug(n.cat.name), n.cat.id < 0 ? `new${-n.cat.id}` : n.cat.id].filter(Boolean).join('-')
