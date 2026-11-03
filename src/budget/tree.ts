// Pure logic for the category tree, display periods and estimates.
// Structure and rules: docs/design/0004-table-design.md, docs/human_scratch_files/stuff.md.
import type { BudgetItem, Category, DueDay, Frequency, MonthBoundary, Range } from '../storage/db'
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

/** Occurrences per month (security-v0.2 3.4: a month is one month, never days ÷ 30.44). */
export const PER_MONTH: Record<Frequency, number> = { day: 365 / 12, week: 52 / 12, biweek: 26 / 12, bimonthly: 2, month: 1, quarter: 1 / 3, annual: 1 / 12 }

/** Months in one week: a week is 1/52 of a year, so $120 quarterly ≈ $9.23 a week (0007 §3). */
export const WEEK_MONTHS = 12 / 52

/** Everything the estimate of a period needs: its dates, and its share of a month when spread. */
export interface EstimatePeriod { from: string; to: string; months?: number; days?: number }

/** Local-date YYYY-MM-DD (toISOString would shift to UTC). */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Local Date from YYYY-MM-DD. */
export const parseIso = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }

// ---------- schedule (0008 §3) ----------

/** The control of the Schedule column for a recurrence (0008 §3.2). */
export type ScheduleKind = 'none' | 'weekday' | 'date' | 'day' | 'two-days'
export const scheduleKind = (f: Frequency): ScheduleKind =>
  f === 'day' ? 'none' : f === 'week' ? 'weekday' : f === 'bimonthly' ? 'two-days' : f === 'month' ? 'day' : 'date'

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** Day-of-month choices: from..to, plus Last (the month's last day) when `last`. */
export const dayChoices = (from: number, to: number, last: boolean): DueDay[] =>
  [...Array.from({ length: to - from + 1 }, (_, i) => from + i), ...(last ? ['last' as const] : [])]

const dayFits = (d: DueDay | undefined, from: number, to: number, last: boolean) =>
  d === undefined || (d === 'last' ? last : d >= from && d <= to)

/** Schedule fields to clear when a row's recurrence changes to `f`: those that no longer fit (0008 §3.2). */
export function scheduleClears(c: Category, f: Frequency): Partial<Category> {
  const k = scheduleKind(f)
  const clear: Partial<Category> = {}
  if (k !== 'date') clear.dueDate = undefined
  if (k !== 'weekday') clear.dueWeekday = undefined
  if (k === 'day' ? !dayFits(c.dueDay, 1, 27, true) : k === 'two-days' ? !dayFits(c.dueDay, 1, 15, false) : true) clear.dueDay = undefined
  if (k !== 'two-days' || !dayFits(c.dueDay2, 16, 27, true)) clear.dueDay2 = undefined
  return clear
}

const ordinal = (d: DueDay) => {
  if (d === 'last') return 'last day'
  const t = d % 100, o = t >= 11 && t <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[d % 10] ?? 'th'
  return `${d}${o}`
}

/** Schedule in words for the table's row note, e.g. "Due Fridays", "Due the 1st and 20th" (spelled out, no abbreviations). */
export function scheduleText(c: Category, word: 'Pay' | 'Due'): string | null {
  const f = c.frequency ?? 'month'
  switch (scheduleKind(f)) {
    case 'weekday': return c.dueWeekday === undefined ? null : `${word} ${WEEKDAYS[c.dueWeekday]}s`
    case 'day': return c.dueDay === undefined ? null : `${word} the ${ordinal(c.dueDay)}`
    case 'two-days': return c.dueDay === undefined || c.dueDay2 === undefined ? null : `${word} the ${ordinal(c.dueDay)} and ${ordinal(c.dueDay2)}`
    case 'date': return c.dueDate ? `Next ${word.toLowerCase()} ${parseIso(c.dueDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}` : null
    default: return null
  }
}

const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
const dayOf = (d: DueDay, y: number, m: number) => d === 'last' ? daysIn(y, m) : Math.min(d, daysIn(y, m))
const dayDiff = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 864e5)

/**
 * Dates a row's payments fall on in [from, to], or null when it has no schedule
 * (then its estimate is spread over the range). The estimate is the amount per
 * payment (0008 §3.1). Bi-monthly needs both payment days.
 */
export function paymentDates(c: Category, from: string, to: string): string[] | null {
  const f = c.frequency ?? 'month'
  const k = scheduleKind(f)
  const [a, z] = [parseIso(from), parseIso(to)]
  const out: string[] = []
  if (k === 'weekday') {
    if (c.dueWeekday === undefined) return null
    for (let d = new Date(a); d <= z; d.setDate(d.getDate() + 1)) if (d.getDay() === c.dueWeekday) out.push(isoDate(d))
    return out
  }
  if (k === 'date') {
    if (!c.dueDate) return null
    const anchor = parseIso(c.dueDate)
    if (f === 'biweek') {
      const first = dayDiff(a, anchor)
      const start = Math.ceil(first / 14) * 14
      for (let n = start; dayDiff(z, anchor) >= n; n += 14) { const d = new Date(anchor); d.setDate(d.getDate() + n); out.push(isoDate(d)) }
      return out
    }
    const every = f === 'quarter' ? 3 : 12
    for (let y = a.getFullYear(), m = a.getMonth(); y < z.getFullYear() || (y === z.getFullYear() && m <= z.getMonth()); m++, y += m > 11 ? 1 : 0, m %= 12) {
      const gap = (y - anchor.getFullYear()) * 12 + m - anchor.getMonth()
      if (((gap % every) + every) % every !== 0) continue
      const iso = isoDate(new Date(y, m, dayOf(anchor.getDate(), y, m)))
      if (iso >= from && iso <= to) out.push(iso)
    }
    return out
  }
  if (k === 'day' || k === 'two-days') {
    const days = k === 'day' ? [c.dueDay] : [c.dueDay, c.dueDay2]
    if (days.some(d => d === undefined)) return null
    for (let y = a.getFullYear(), m = a.getMonth(); y < z.getFullYear() || (y === z.getFullYear() && m <= z.getMonth()); m++, y += m > 11 ? 1 : 0, m %= 12) {
      for (const d of days) {
        const iso = isoDate(new Date(y, m, dayOf(d!, y, m)))
        if (iso >= from && iso <= to) out.push(iso)
      }
    }
    return out
  }
  return null
}

/**
 * Estimate for one node in a period. With a schedule, the full estimate lands on each
 * payment date in the period (0008 §3.1); without, it is spread by the period's share
 * of a month (no recurrence = monthly).
 */
export function estimateFor(c: Category, p: EstimatePeriod): number {
  if (!c.selected || !c.estimate) return 0
  const pays = p.from ? paymentDates(c, p.from, p.to) : null
  if (pays) return c.estimate * pays.length
  return c.estimate * PER_MONTH[c.frequency ?? 'month'] * (p.months ?? 1)
}

// ---------- periods ----------

/**
 * A table column. `months` is the share of a month its estimate covers:
 * a Month total is 1, its week columns split that 1 by days so they sum to
 * the total, a Week is WEEK_MONTHS, an Annual month is 1. Missing = 1 month.
 */
/** `fullLabel`: unabbreviated accessible name for the column header when `label` is abbreviated. */
export interface Period { label: string; fullLabel?: string; from: string; to: string; days: number; months?: number }

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
/** Adds the year to a title date when it isn't the current year (v0.4 review). */
const yearIfOther = (d: Date): Intl.DateTimeFormatOptions => d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }
const long = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
const span = (from: Date, to: Date): Period =>
  ({ label: `${short(from)} – ${short(to)}`, fullLabel: `${long(from)} to ${long(to)}`, from: isoDate(from), to: isoDate(to), days: Math.round((to.getTime() - from.getTime()) / 864e5) + 1 })

/** Calendar settings (0007 §1): week start day (0 = Sunday) and month boundaries. */
export interface Calendar { weekStart: number; monthBoundary: MonthBoundary }
export const DEFAULT_CALENDAR: Calendar = { weekStart: 0, monthBoundary: 'weeks' }

/** First day of the week containing `d`. */
export const weekStartOf = (d: Date, weekStart: number) => addDays(d, -((d.getDay() - weekStart + 7) % 7))

/**
 * Columns for a range. Week = one column per day of the week containing
 * today, plus a total. Month = one column
 * per week plus a total: whole weeks from the first week start on or after
 * the 1st, or (calendar) weeks clipped to the month.
 */
export function periodsFor(range: Range, today: Date, cal: Calendar = DEFAULT_CALENDAR): { columns: Period[]; total: Period | null; title: string } {
  if (range === 'day') {
    const d = isoDate(today)
    const label = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    const title = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...yearIfOther(today) })
    return { columns: [{ label, from: d, to: d, days: 1, months: WEEK_MONTHS / 7 }], total: null, title }
  }
  if (range === 'week') {
    const s = weekStartOf(today, cal.weekStart)
    // One column per day from the week start, plus the week total.
    const columns = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(s, i)
      return { ...span(d, d), months: WEEK_MONTHS / 7, label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), fullLabel: d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }
    })
    return { columns, total: { ...span(s, addDays(s, 6)), months: WEEK_MONTHS, label: 'Total', fullLabel: undefined }, title: `Week of ${s.toLocaleDateString(undefined, { month: 'long', day: 'numeric', ...yearIfOther(s) })}` }
  }
  if (range === 'annual') {
    // Calendar months, so no day falls in two columns.
    const y = today.getFullYear()
    const columns = Array.from({ length: 12 }, (_, m) => {
      const p = span(new Date(y, m, 1), new Date(y, m + 1, 0))
      return { ...p, months: 1, label: new Date(y, m, 1).toLocaleDateString(undefined, { month: 'short' }), fullLabel: new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long' }) }
    })
    return { columns, total: { ...span(new Date(y, 0, 1), new Date(y, 11, 31)), months: 12, label: 'Total', fullLabel: undefined }, title: String(y) }
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
  const all = span(first, last)
  // The month's estimate is the typed monthly amount; week columns share it by days.
  for (const c of columns) c.months = c.days / all.days
  return { columns, total: { ...all, months: 1, label: 'Total', fullLabel: undefined }, title }
}

/** A date in the range before (-1) or after (1) the one containing `anchor` (0007 §9.5). */
export function shiftRange(range: Range, anchor: Date, cal: Calendar, dir: -1 | 1): Date {
  const { columns, total } = periodsFor(range, anchor, cal)
  const all = total ?? columns[0]
  return addDays(parseIso(dir < 0 ? all.from : all.to), dir)
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
  n.children.length ? n.children.reduce((a, c) => a + estimateTotal(c, p), 0) : estimateFor(n.cat, p)

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
