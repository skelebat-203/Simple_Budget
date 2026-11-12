// Import preview (0013 §4–§9): maps the rows of every budget sheet onto the category tree
// and lists the purchases, new rows and warnings. Pure: nothing is written here; the
// confirmed plan is written by `applyImport` in one transaction.
import type { Category } from '../storage/db'
import { cleanDescription, dateBounds } from '../budget/validate'
import { ImportError, type Workbook } from './grid'
import { detect, ignoredColumns, sourceRows, type Layout, type SheetKind, type SourceRow } from './sheets'
import { dueDayKey, isoOf, nameKey, type MonthDay } from './cells'

// ---------- inputs ----------

/** What the plan needs from the database. */
export interface Snapshot {
  categories: Category[]
  purchases: { categoryId: number; date: string }[]
  today: Date
}

/**
 * A row's target as chosen in the preview: the proposal, no import, Miscellaneous, or an existing row.
 * `parentId` is for a row that needs a place (R1): it is matched by name, or created, under that
 * existing row (a top-level row or a subcategory directly under one).
 */
export type TargetChoice = 'auto' | 'skip' | 'misc' | { categoryId: number } | { parentId: number }

/** Choices made in the preview (0013 §9). Every field is optional; the plan proposes defaults. */
export interface ImportOptions {
  year?: number
  /** Sheet indexes the user unticked. */
  excludedSheets?: number[]
  /** Row key → target. */
  targets?: Record<string, TargetChoice>
  /** Month (1–12) found in both a month sheet and the annual sheet → which to use (0013 §7). */
  monthSource?: Record<number, 'month' | 'annual'>
  /** Month (1–12) that only the annual sheet has but the app already has data for → which to use (0013 §7). */
  annualExisting?: Record<number, 'import' | 'existing'>
  /** Leave out rows whose item already has purchases in the same dates (0013 §6). */
  skipDuplicates?: boolean
}

// ---------- outputs ----------

export interface PlanSheet {
  index: number
  name: string
  kind: SheetKind
  included: boolean
  /** Month sheet: its month (1–12); week and day sheets: the month of their first date. */
  month?: number
  from?: string
  to?: string
}

export type TargetHow = 'match' | 'new' | 'misc' | 'description' | 'chosen'

export interface PlanRow {
  key: string
  sheetIndex: number
  sheet: string
  /** 1-based, as the spreadsheet numbers it. */
  row: number
  name: string
  level: number
  /** total: a row with rows under it (a subcategory); computed: Net Income; item: takes amounts. */
  role: 'total' | 'computed' | 'item'
  target?: { categoryId: number; path: string; how: TargetHow; isNew: boolean }
  /** Why nothing from this row is imported. */
  skipped?: string
  /** A top-level row the app doesn't know: the user chooses where it goes (R1). */
  needsPlace?: true
  purchases: number
  total: number
  estimate?: number
  duplicates?: number
  warnings: string[]
}

export interface NewCategory { id: number; name: string; parentId: number | null; color: string; computed?: true; order: number }

export interface PlannedPurchase {
  rowKey: string
  categoryId: number
  amount: number
  date: string
  description?: string
  /** The file had no date for it (0013 §5). */
  undated?: true
  /** Day sheet time, minutes after midnight (0013 §5, Q10). */
  minutes?: number
}

export interface ImportPlan {
  format: Workbook['format']
  sheets: PlanSheet[]
  year: number
  defaultYear: number
  /** A sheet without a year (month, week or annual) is included, so the preview asks for one (Q1). */
  needsYear: boolean
  rows: PlanRow[]
  /** Rows to create, parents first; negative ids, which purchases and other new rows refer to. */
  newCategories: NewCategory[]
  purchases: PlannedPurchase[]
  /** Monthly (or weekly) estimate for rows that have none yet (Q3). */
  estimates: { categoryId: number; estimate: number; frequency: 'month' | 'week' }[]
  /** Existing rows that become selected because they get amounts or an estimate. */
  select: number[]
  /** Existing rows that gain their first child: their purchases and estimate move to the new Miscellaneous child (0007 §2.1). */
  moves: { from: number; to: number; path: string }[]
  conflicts: { month: number; source: 'month' | 'annual' }[]
  annualExisting: { month: number; existing: number; choice: 'import' | 'existing' }[]
  ignoredColumns: { sheet: string; column: string; header: string }[]
  /** Keys of rows that need a place and have none yet (R1); `applyImport` refuses until it is empty. */
  unplaced: string[]
  /** File-level notes, such as unnamed rows with amounts. */
  warnings: string[]
  summary: { purchases: number; total: number; newCategories: number; undated: number }
}

// ---------- the planned tree ----------

interface PNode {
  id: number
  name: string
  parentId: number | null
  color: string
  computed: boolean
  children: number[]
  existing: boolean
  /** Existing row that holds purchases or an estimate of its own. */
  holds: boolean
  hasEstimate: boolean
  rollup: boolean
  selected: boolean
}

/** Top-level rows with their seed colors (0004, 0007 §2). */
const ROOTS: { name: string; color: string; computed?: true }[] = [
  { name: 'Income', color: 'blue', computed: true },
  { name: 'Taxes', color: 'red' },
  { name: 'Net Income', color: 'highlight-blue', computed: true },
  { name: 'Savings', color: 'green', computed: true },
  { name: 'Expenses', color: 'orange', computed: true },
]
const MISC = 'Miscellaneous'

class Tree {
  nodes = new Map<number, PNode>()
  roots: number[] = []
  created: NewCategory[] = []
  private next = -1

  constructor(cats: Category[], purchases: Snapshot['purchases']) {
    const held = new Set(purchases.map(p => p.categoryId))
    const sorted = [...cats].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.id! - b.id!)
    for (const c of sorted) {
      this.nodes.set(c.id!, {
        id: c.id!, name: c.name, parentId: c.parentId, color: c.color, computed: !!c.computed, children: [], existing: true,
        holds: held.has(c.id!) || c.estimate != null, hasEstimate: c.estimate != null, rollup: !!c.rollup, selected: !!c.selected,
      })
    }
    for (const n of this.nodes.values()) {
      const p = n.parentId == null ? undefined : this.nodes.get(n.parentId)
      if (p) p.children.push(n.id)
      else this.roots.push(n.id)
    }
    if (!cats.length) for (const r of ROOTS) this.add(r.name, null, r.color, r.computed)
  }

  get(id: number) { return this.nodes.get(id)! }
  kids(parentId: number | null) { return (parentId == null ? this.roots : this.get(parentId).children).map(id => this.get(id)) }
  depth(id: number) { let d = 0; for (let n = this.get(id); n.parentId != null; n = this.get(n.parentId)) d++; return d }
  root(id: number) { let n = this.get(id); while (n.parentId != null) n = this.get(n.parentId); return n }
  path(id: number): string { const n = this.get(id); return n.parentId == null ? n.name : `${this.path(n.parentId)} › ${n.name}` }

  /** Child by name: exact key first, then without a due-day note (R3). */
  find(parentId: number | null, name: string): PNode | undefined {
    const kids = this.kids(parentId)
    const k = nameKey(name)
    return kids.find(c => nameKey(c.name) === k) ?? kids.find(c => dueDayKey(c.name) === dueDayKey(name) && dueDayKey(name) !== '')
  }

  add(name: string, parentId: number | null, color?: string, computed?: true): PNode {
    const siblings = this.kids(parentId)
    const n: PNode = {
      id: this.next--, name, parentId, color: color ?? siblings[0]?.color ?? this.childColor(parentId), computed: !!computed,
      children: [], existing: false, holds: false, hasEstimate: false, rollup: false, selected: true,
    }
    this.nodes.set(n.id, n)
    if (parentId == null) this.roots.push(n.id)
    else this.get(parentId).children.push(n.id)
    this.created.push({ id: n.id, name, parentId, color: n.color, ...(computed ? { computed } : {}), order: siblings.length })
    return n
  }

  findOrAdd(parentId: number | null, name: string): PNode { return this.find(parentId, name) ?? this.add(name, parentId) }

  /** A known top-level row, created with its seed color when missing. */
  rootNamed(name: string): PNode {
    const found = this.find(null, name)
    if (found) return found
    const seed = ROOTS.find(r => r.name === name)
    return this.add(name, null, seed?.color, seed?.computed)
  }

  /** Child color by its top-level row (tree.ts childColor). */
  private childColor(parentId: number | null): string {
    if (parentId == null) return 'orange'
    const root = this.root(parentId).name
    if (root === 'Income') return 'blue'
    if (root === 'Taxes') return 'red'
    if (root === 'Savings') return 'lighter-green'
    return this.get(parentId).parentId == null ? 'lighter-orange' : 'even-lighter-orange'
  }

  isCharity(n: PNode) { return nameKey(n.name) === 'charity' && n.parentId != null && nameKey(this.get(n.parentId).name) === 'expenses' }

  /** Whether purchases can be stored on the row itself (a total can't; Charity while solo, 0009 §6). */
  takes(n: PNode): boolean {
    if (n.computed) return false
    if (!n.children.length) return true
    return this.isCharity(n) && !n.rollup && this.kids(n.id).every(c => c.name === MISC || !c.selected)
  }
}

// ---------- year ----------

/** Year for a month and day in a sheet whose own month is `sheetMonth` (a January sheet may start in December). */
function yearFor(md: MonthDay, sheetMonth: number, year: number) {
  if (sheetMonth === 1 && md.month === 12) return year - 1
  if (sheetMonth === 12 && md.month === 1) return year + 1
  return year
}

/** Most common month among the data columns' first dates. */
function sheetMonthOf(layout: Layout): number {
  const count = new Map<number, number>()
  for (const c of layout.columns) count.set(c.from.month, (count.get(c.from.month) ?? 0) + 1)
  return [...count].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 1
}

/** Year bounds for the year choice: the app's date limits. */
function yearBounds(today: Date) {
  const b = dateBounds(today)
  return { min: Number(b.min.slice(0, 4)), max: Number(b.max.slice(0, 4)) }
}

// ---------- plan ----------

const SEP = ' — '
const describe = (...parts: (string | undefined)[]) => cleanDescription(parts.filter(Boolean).join(SEP)) || undefined
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const cents = (n: number) => Math.round(n * 100)
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthEnd = (y: number, m: number) => isoOf(y, m, new Date(y, m, 0).getDate())!

export function buildPlan(wb: Workbook, snap: Snapshot, opts: ImportOptions = {}): ImportPlan {
  const layouts = wb.sheets.map(detect)
  if (!layouts.some(l => l.kind !== 'skipped')) throw new ImportError('has no budget sheets. A budget sheet has week dates, days, a full date or the months Jan to Dec in row 1.')
  const excluded = new Set(opts.excludedSheets ?? [])
  const bounds = dateBounds(snap.today)
  const warnings: string[] = []

  // Sheets and their months.
  const sheets: PlanSheet[] = wb.sheets.map((s, index) => {
    const l = layouts[index]
    const month = l.kind === 'day' ? Number(l.day!.date.slice(5, 7)) : l.kind === 'month' || l.kind === 'week' ? sheetMonthOf(l) : undefined
    return { index, name: s.name, kind: l.kind, included: l.kind !== 'skipped' && !excluded.has(index), month }
  })
  // Default year: the current year (Q1, changed 2026-11-11). Day sheets keep the year in their date.
  const defYear = snap.today.getFullYear()
  const yb = yearBounds(snap.today)
  const year = opts.year && Number.isInteger(opts.year) && opts.year >= yb.min && opts.year <= yb.max ? opts.year : defYear

  // Period of each dated sheet, for duplicate checks.
  for (const s of sheets) {
    const l = layouts[s.index]
    if (l.kind === 'month' || l.kind === 'week') {
      const iso = (md: MonthDay) => isoOf(yearFor(md, s.month!, year), md.month, md.day)
      s.from = iso(l.columns[0].from)
      s.to = iso(l.columns[l.columns.length - 1].to)
    } else if (l.kind === 'day') s.from = s.to = l.day!.date
  }

  // A month in both a month sheet and the annual sheet: the user picks one (0013 §7).
  const annual = sheets.find(s => s.included && s.kind === 'annual')
  const monthSheets = new Map<number, PlanSheet[]>()
  for (const s of sheets) if (s.included && s.kind === 'month') monthSheets.set(s.month!, [...(monthSheets.get(s.month!) ?? []), s])
  const conflicts: ImportPlan['conflicts'] = []
  if (annual) for (const m of [...monthSheets.keys()].sort((a, b) => a - b)) conflicts.push({ month: m, source: opts.monthSource?.[m] ?? 'month' })
  for (const c of conflicts) if (c.source === 'annual') for (const s of monthSheets.get(c.month)!) s.included = false
  const annualMonths = new Set<number>()
  const annualExisting: ImportPlan['annualExisting'] = []
  if (annual) {
    for (let m = 1; m <= 12; m++) {
      if (conflicts.some(c => c.month === m && c.source === 'month')) continue
      const from = isoOf(year, m, 1)!, to = monthEnd(year, m)
      const existing = snap.purchases.filter(p => p.date >= from && p.date <= to).length
      if (existing) {
        const choice = opts.annualExisting?.[m] ?? 'existing'
        annualExisting.push({ month: m, existing, choice })
        if (choice === 'existing') continue
      }
      annualMonths.add(m)
    }
  }

  const tree = new Tree(snap.categories, snap.purchases)
  const rows: PlanRow[] = []
  const purchases: PlannedPurchase[] = []
  const estimates = new Map<number, { estimate: number; frequency: 'month' | 'week'; rank: number }>()
  const ignored: ImportPlan['ignoredColumns'] = []
  const unplaced: string[] = []

  // Incidentals rows that are items, not one-off purchases (Q2): existing items, and rows with an estimate in any sheet.
  const incidentalItems = new Set<string>()
  const parsed = sheets.map(s => (s.kind === 'skipped' ? undefined : sourceRows(wb.sheets[s.index], layouts[s.index], s.index)))
  for (const s of sheets) {
    if (!s.included || (s.kind !== 'month' && s.kind !== 'week')) continue
    for (const r of parsed[s.index]!.rows) {
      if (r.parent?.nameKey === 'incidentals' && !r.children.length && r.est?.kind === 'value') incidentalItems.add(r.nameKey)
    }
  }

  for (const s of sheets) {
    if (!s.included) continue
    const layout = layouts[s.index]
    const { rows: src, unnamed } = parsed[s.index]!
    for (const c of ignoredColumns(wb.sheets[s.index], layout)) ignored.push({ sheet: s.name, ...c })
    if (unnamed.length) warnings.push(`${s.name}: row${unnamed.length > 1 ? 's' : ''} ${unnamed.join(', ')} ${unnamed.length > 1 ? 'have' : 'has'} amounts but no name, so ${unnamed.length > 1 ? 'they were' : 'it was'} skipped.`)
    const nodeOf = new Map<SourceRow, PNode>()
    let inBreakdown = false

    src.forEach((r, i) => {
      const row: PlanRow = { key: r.key, sheetIndex: s.index, sheet: s.name, row: r.r + 1, name: r.raw, level: r.level, role: r.children.length ? 'total' : 'item', purchases: 0, total: 0, warnings: [] }
      rows.push(row)
      if (r.level === 0) inBreakdown = layout.kind === 'annual' && /^misc-breakdown$/.test(r.nameKey)

      // ----- where the row goes -----
      let node: PNode | undefined
      let how: TargetHow = 'match'
      let label: string | undefined
      const parentNode = r.parent ? nodeOf.get(r.parent) : undefined

      if (inBreakdown) {
        if (r.level === 0) { row.role = 'total'; row.skipped = 'Heading of the Misc. Breakdown table'; return }
        node = tree.findOrAdd(tree.findOrAdd(tree.rootNamed('Expenses').id, 'Incidentals').id, MISC)
        how = 'misc'; label = r.name
      } else if (r.level === 0) {
        const next = src.slice(i + 1).find(x => x.level === 0)
        if (r.nameKey === 'net-income') { row.role = 'computed'; row.skipped = 'Net Income is worked out by the app'; return }
        if (r.nameKey === 'pay' || r.nameKey === 'incidental-income') node = tree.findOrAdd(tree.rootNamed('Income').id, r.nameKey === 'pay' ? 'Pay' : 'Incidental Income')
        else if (!r.children.length && next?.nameKey === 'incidental-income') {
          node = tree.findOrAdd(tree.rootNamed('Income').id, 'Pay'); label = r.name
        } else {
          node = tree.find(null, r.name)
          if (!node) {
            // Not a top-level row the app knows: the user chooses where it goes (R1).
            row.needsPlace = true
            const choice = opts.targets?.[r.key]
            if (choice === 'skip') { row.skipped = 'Not imported (your choice)'; return }
            const chosen = typeof choice === 'object' ? tree.nodes.get('categoryId' in choice ? choice.categoryId : choice.parentId) : undefined
            if (chosen?.existing && typeof choice === 'object' && 'categoryId' in choice) { node = chosen; how = 'chosen' }
            else if (chosen?.existing && tree.depth(chosen.id) < 2) {
              node = tree.findOrAdd(chosen.id, r.name); how = node.existing ? 'match' : 'new'
            } else { row.skipped = 'Needs a place: choose where it goes'; unplaced.push(r.key); return }
          }
        }
      } else if (!parentNode) {
        row.skipped = 'The row above it isn’t imported'; return
      } else if (tree.depth(parentNode.id) >= 2) {
        // Deeper than the app's three levels: an amount on the row above, named by this row (R2).
        node = parentNode; how = 'description'; label = r.name
      } else if (r.minutes != null) {
        // Day sheet purchase row (0013 §5).
        const match = tree.find(parentNode.id, r.name)
        if (match) node = match
        else if (parentNode.computed) { node = tree.add(r.name, parentNode.id); how = 'new' }
        else { node = parentNode; how = 'description'; label = r.name }
        if (r.minutes < 0) row.warnings.push('Its time couldn’t be read, so it has none.')
      } else if (!r.children.length && nameKey(parentNode.name) === 'incidentals' && !tree.find(parentNode.id, r.name)?.existing && !incidentalItems.has(r.nameKey)
        && !(layout.kind === 'annual' && r.nameKey === 'misc')) {
        // A one-off purchase in Incidentals (Q2).
        node = tree.findOrAdd(parentNode.id, MISC); how = 'misc'; label = r.name
      } else {
        const found = tree.find(parentNode.id, r.name)
        node = found ?? tree.add(r.name, parentNode.id)
        if (!found) how = 'new'
      }
      if (r.children.length) {
        nodeOf.set(r, node)
        row.target = { categoryId: node.id, path: tree.path(node.id), how, isNew: !node.existing }
        row.skipped = 'Has rows under it, so its amounts are totals'
        // The sheet's own total against the rows under it.
        const own = layout.kind === 'day' ? r.dayAmount?.amount : r.totalAct
        const sum = r.children.reduce((t, c) => {
          const a = layout.kind === 'day' ? c.dayAmount?.amount : c.totalAct
          return t + (a?.kind === 'value' ? cents(a.value) : 0)
        }, 0)
        if (own?.kind !== 'bad' && sum !== (own?.kind === 'value' ? cents(own.value) : 0)) {
          row.warnings.push(`The rows under it add up to ${money(sum / 100)}, but it says ${money(own?.kind === 'value' ? own.value : 0)}.`)
        }
        return
      }
      if (layout.kind === 'annual' && r.nameKey === 'misc' && nameKey(parentNode?.name ?? '') === 'incidentals') {
        row.skipped = 'The Misc. Breakdown rows are imported instead'
        // Its month amounts against the Misc. Breakdown table.
        const start = src.findIndex(x => x.level === 0 && x.nameKey === 'misc-breakdown')
        const breakdown = start < 0 ? [] : src.slice(start + 1).filter(x => x.level > 0)
        const off = layout.columns.flatMap((col, ci) => {
          if (!annualMonths.has(col.from.month)) return []
          const a = r.acts[ci].amount
          const stated = a.kind === 'value' ? cents(a.value) : 0
          const sum = breakdown.reduce((t, b) => t + (b.acts[ci].amount.kind === 'value' ? cents((b.acts[ci].amount as { value: number }).value) : 0), 0)
          return sum === stated ? [] : [`${monthName(col.from.month)} ${money(sum / 100)} (Misc says ${money(stated / 100)})`]
        })
        if (off.length) row.warnings.push(`The Misc. Breakdown rows differ from this row: ${off.join('; ')}.`)
        return
      }

      // ----- the user's choice (0013 §9) -----
      const choice = opts.targets?.[r.key] ?? 'auto'
      if (choice === 'skip') { row.skipped = 'Not imported (your choice)'; return }
      if (choice === 'misc' && node) {
        const base = node.name === MISC && node.parentId != null ? tree.get(node.parentId) : how === 'description' ? node : node.parentId != null ? tree.get(node.parentId) : node
        node = tree.findOrAdd(base.id, MISC); how = 'misc'; label = r.name
      } else if (typeof choice === 'object' && 'categoryId' in choice && tree.nodes.get(choice.categoryId)?.existing) {
        node = tree.get(choice.categoryId); how = 'chosen'; label = undefined
      }
      if (!node) return
      row.target = { categoryId: node.id, path: tree.path(node.id), how, isNew: !node.existing }

      // ----- amounts -----
      const dated: { amount: number; date: string | undefined; note?: string; undated?: true; minutes?: number; cell: string }[] = []
      const bad = (cell: string, text: string) => row.warnings.push(`Cell ${cell} “${text}” isn’t an amount, so it was skipped.`)
      if (layout.kind === 'day') {
        const a = r.dayAmount!
        if (a.amount.kind === 'value') dated.push({ amount: a.amount.value, date: layout.day!.date, note: a.note, minutes: r.minutes != null && r.minutes >= 0 ? r.minutes : undefined, cell: a.cell })
        else if (a.amount.kind === 'bad') bad(a.cell, a.amount.text)
      } else {
        layout.columns.forEach((col, ci) => {
          const a = r.acts[ci]
          if (a.amount.kind === 'bad') { bad(a.cell, a.amount.text); return }
          if (a.amount.kind !== 'value') return
          if (layout.kind === 'annual') {
            if (!annualMonths.has(col.from.month)) return
            dated.push({ amount: a.amount.value, date: isoOf(year, col.from.month, 1), note: a.note, undated: true, cell: a.cell })
          } else {
            const md = col.from
            dated.push({ amount: a.amount.value, date: isoOf(yearFor(md, s.month!, year), md.month, md.day), note: a.note, undated: layout.kind === 'month' ? true : undefined, cell: a.cell })
          }
        })
      }

      // Week totals against the Monthly / Weekly / Total column (0013 §5 Checks).
      if (layout.kind !== 'day' && r.totalAct?.kind !== 'bad') {
        const sum = r.acts.reduce((t, a) => t + (a.amount.kind === 'value' ? cents(a.amount.value) : 0), 0)
        const stated = r.totalAct?.kind === 'value' ? cents(r.totalAct.value) : 0
        if (layout.total && sum !== stated) {
          const what = layout.kind === 'month' ? 'week' : layout.kind === 'week' ? 'day' : 'month'
          row.warnings.push(`Its ${what} amounts add up to ${money(sum / 100)}, but its ${layout.kind === 'month' ? 'Monthly' : layout.kind === 'week' ? 'Weekly' : 'Total'} column says ${money(stated / 100)}.`)
        }
      }
      if (nameKey(tree.root(node.id).name) === 'savings' && dated.some(d => d.amount < 0)) row.warnings.push('Has negative amounts. They are imported as credits (Q9).')

      // A row note that starts with one of the row's amounts ("$172.50 New Glasses") belongs to that purchase only (R4).
      const lead = /^\$?\s*(-?[\d,]+\.\d{2})\b/.exec(r.note ?? '')
      const owner = lead ? dated.filter(d => cents(d.amount) === cents(Number(lead[1].replace(/,/g, '')))) : []
      const rowNoteFor = (d: (typeof dated)[number]) => (owner.length === 1 ? (owner[0] === d ? r.note : undefined) : r.note)
      for (const d of dated) {
        if (!d.date || d.date < bounds.min || d.date > bounds.max) {
          row.warnings.push(`Cell ${d.cell} has a date outside ${bounds.min.slice(0, 4)} to next year, so it was skipped.`)
          continue
        }
        purchases.push({
          rowKey: r.key, categoryId: node.id, amount: d.amount, date: d.date,
          description: describe(label, d.note ?? rowNoteFor(d)),
          ...(d.undated ? { undated: true as const } : {}), ...(d.minutes != null ? { minutes: d.minutes } : {}),
        })
      }

      // Estimate: the Monthly Est. total (Q3); a week sheet's Weekly Est. only when no month sheet gives one (R5).
      if ((how === 'match' || how === 'new' || how === 'chosen') && r.est?.kind === 'value' && r.est.value > 0 && (layout.kind === 'month' || layout.kind === 'week')) {
        row.estimate = r.est.value
        const rank = (layout.kind === 'month' ? 1e6 : 0) + Number((s.from ?? '').replace(/-/g, ''))
        const prev = estimates.get(node.id)
        if (!prev || rank > prev.rank) estimates.set(node.id, { estimate: r.est.value, frequency: layout.kind === 'month' ? 'month' : 'week', rank })
      }
    })
  }

  // ----- amounts that landed on a row that is now a total go to its Miscellaneous (0007 §2.1) -----
  const moves: ImportPlan['moves'] = []
  for (const n of [...tree.nodes.values()]) {
    if (!n.children.length || tree.takes(n)) continue
    const own = purchases.filter(p => p.categoryId === n.id)
    const est = estimates.get(n.id)
    const movesExisting = n.existing && n.holds && !n.computed && !tree.isCharity(n)
    if (!own.length && !est && !movesExisting) continue
    const misc = tree.findOrAdd(n.id, MISC)
    for (const p of own) p.categoryId = misc.id
    if (est) { estimates.delete(n.id); if (!estimates.has(misc.id)) estimates.set(misc.id, est) }
    for (const row of rows) if (row.target?.categoryId === n.id && row.role === 'item') {
      row.target = { ...row.target, categoryId: misc.id, path: tree.path(misc.id), isNew: !misc.existing }
      row.warnings.push(`${n.name} has items, so its amounts go to ${n.name} › ${MISC}.`)
    }
    // An existing row that gains its first child keeps nothing of its own (Charity has its own rule, 0009 §6).
    if (movesExisting && !n.children.some(id => tree.get(id).existing)) moves.push({ from: n.id, to: misc.id, path: tree.path(misc.id) })
  }
  for (const row of rows) if (row.target) row.target.path = tree.path(row.target.categoryId)

  // ----- already imported (0013 §6) -----
  const sheetOf = new Map(sheets.map(s => [s.index, s]))
  const keep = new Set<string>()
  for (const row of rows) {
    if (row.role !== 'item' || !row.target || row.target.categoryId < 0) continue
    const s = sheetOf.get(row.sheetIndex)!
    const mine = purchases.filter(p => p.rowKey === row.key)
    if (!mine.length) continue
    const ranges = s.kind === 'annual'
      ? [...new Set(mine.map(p => p.date.slice(0, 7)))].map(ym => ({ from: `${ym}-01`, to: monthEnd(Number(ym.slice(0, 4)), Number(ym.slice(5, 7))) }))
      : [{ from: s.from!, to: s.to! }]
    const id = row.target.categoryId
    const n = snap.purchases.filter(p => p.categoryId === id && ranges.some(g => p.date >= g.from && p.date <= g.to)).length
    if (!n) continue
    row.duplicates = n
    row.warnings.push(`${row.target.path} already has ${n} purchase${n > 1 ? 's' : ''} in these dates.`)
    if (opts.skipDuplicates) { keep.add(row.key); row.skipped = 'Already in the app (Skip those items)' }
  }
  const finalPurchases = purchases.filter(p => !keep.has(p.rowKey))
  for (const row of rows) {
    const mine = finalPurchases.filter(p => p.rowKey === row.key)
    row.purchases = mine.length
    row.total = mine.reduce((t, p) => t + cents(p.amount), 0) / 100
  }

  // ----- what gets created and selected -----
  const used = new Set<number>([...finalPurchases.map(p => p.categoryId), ...estimates.keys(), ...moves.map(m => m.to)])
  const needed = new Set<number>()
  for (const id of used) for (let n: PNode | undefined = tree.get(id); n; n = n.parentId == null ? undefined : tree.get(n.parentId)) needed.add(n.id)
  // Rows that only total others are created too, so the tree keeps the sheet's shape; an empty database also gets the five top-level rows.
  const keepEmpty = !snap.categories.length
  const newCategories = tree.created.filter(c => needed.has(c.id) || (keepEmpty && c.parentId == null))
  // Sibling order among the rows actually created.
  const orderOf = new Map<number | null, number>()
  for (const c of newCategories) {
    const base = c.parentId == null ? tree.roots.filter(id => id > 0).length : c.parentId > 0 ? tree.get(c.parentId).children.filter(id => id > 0).length : 0
    const o = orderOf.get(c.parentId) ?? base
    c.order = o
    orderOf.set(c.parentId, o + 1)
  }
  const select = [...used].filter(id => id > 0 && !tree.get(id).selected)
  const estimateList = [...estimates].filter(([id]) => id < 0 || !tree.get(id).hasEstimate).map(([categoryId, e]) => ({ categoryId, estimate: e.estimate, frequency: e.frequency }))
  for (const [id, e] of estimates) {
    if (id > 0 && tree.get(id).hasEstimate) {
      for (const row of rows) if (row.target?.categoryId === id && row.estimate != null) row.warnings.push(`${tree.get(id).name} keeps its estimate; the sheet’s ${money(e.estimate)} isn’t used.`)
    }
  }

  const total = finalPurchases.reduce((t, p) => t + cents(p.amount), 0) / 100
  return {
    format: wb.format, sheets, year, defaultYear: defYear,
    needsYear: sheets.some(s => s.included && s.kind !== 'day'),
    rows, newCategories, purchases: finalPurchases, estimates: estimateList, select, moves,
    conflicts, annualExisting, ignoredColumns: ignored, unplaced, warnings,
    summary: { purchases: finalPurchases.length, total, newCategories: newCategories.length, undated: finalPurchases.filter(p => p.undated).length },
  }
}

/** "September" for 9; for preview labels. */
export const monthName = (m: number) => MONTH_NAMES[m - 1]
