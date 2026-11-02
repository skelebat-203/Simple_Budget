// Pure logic for the category tree, display periods and estimates.
// Structure and rules: docs/design/0004-table-design.md, docs/human_scratch_files/stuff.md.
import type { BudgetItem, Category, Frequency, Range } from '../storage/db'

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

/**
 * Node that receives an amount entered on `n`. Totals take none, except a
 * subcategory with a "Miscellaneous" item, which routes there (0004).
 */
export function entryTarget(n: CatNode): CatNode | null {
  if (!isTotal(n)) return n
  if (n.cat.computed) return null
  return n.children.find(c => c.cat.name === 'Miscellaneous' && !isTotal(c)) ?? null
}

const BILL_GROUPS = new Set(['Debt', 'Utilities', 'Subscriptions'])
const rootOf = (n: CatNode): CatNode => (n.parent ? rootOf(n.parent) : n)
const inBillGroup = (n: CatNode) => ancestors(n).some(a => BILL_GROUPS.has(a.cat.name))

/** Recurrence applies to income, debt, utilities and subscriptions. */
export const recurrenceApplies = (n: CatNode) => rootOf(n).cat.name === 'Income' || inBillGroup(n)

/** Autopay applies to debt, utilities and subscriptions. */
export const autopayApplies = inBillGroup

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'biweek', label: 'Every 2 weeks' },
  { value: 'bimonthly', label: 'Bi-monthly (twice a month)' },
  { value: 'month', label: 'Monthly' },
]

const PER_MONTH: Record<Frequency, number> = { day: 30.44, week: 52 / 12, biweek: 26 / 12, bimonthly: 2, month: 1 }

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
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const span = (from: Date, to: Date): Period =>
  ({ label: `${short(from)} – ${short(to)}`, from: isoDate(from), to: isoDate(to), days: Math.round((to.getTime() - from.getTime()) / 864e5) + 1 })

/** Columns for a range. Month = one column per (calendar-clipped) week plus a total. */
export function periodsFor(range: Range, today: Date): { columns: Period[]; total: Period | null } {
  if (range === 'day') {
    const d = isoDate(today)
    return { columns: [{ label: today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), from: d, to: d, days: 1 }], total: null }
  }
  if (range === 'week') {
    const m = mondayOf(today)
    return { columns: [span(m, addDays(m, 6))], total: null }
  }
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const columns: Period[] = []
  for (let s = first; s <= last;) {
    let e = addDays(mondayOf(s), 6)
    if (e > last) e = last
    columns.push(span(s, e))
    s = addDays(e, 1)
  }
  return { columns, total: { ...span(first, last), label: 'Total' } }
}

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
  if (root === 'Savings') return 'lighter-green'
  return parent.parent ? 'even-lighter-orange' : 'lighter-orange'
}
