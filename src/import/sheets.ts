// Finding the data in a sheet (0013 §3): its type, its date columns and its rows as a tree.
import { cellText, colName, type Sheet } from './grid'
import { fullDate, importName, monthDay, nameKey, parseAmount, timeOfDay, weekRange, type Amount, type MonthDay } from './cells'

export type SheetKind = 'month' | 'week' | 'day' | 'annual' | 'skipped'

/** One Est./Act. pair (month: a week; week: a day; annual: a month, Act. only). */
export interface DataColumn { est?: number; act: number; header: string; from: MonthDay; to: MonthDay }

export interface Layout {
  kind: SheetKind
  /** Columns that hold names: A up to this index, exclusive (at most A to D). */
  nameCols: number
  columns: DataColumn[]
  /** The Monthly / Weekly pair, or the annual Total column (Act. only). */
  total?: { est?: number; act: number }
  /** Day sheet: its date and the amount and Time columns. */
  day?: { date: string; amount: number; time: number }
  /** Last column the importer reads; columns to its right are ignored and listed (0013 §8). */
  lastCol: number
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const NAME_COLS_MAX = 4
const isWord = (s: string, w: string) => s.trim().toLowerCase().replace(/\.$/, '') === w

/** Sheet type from row 1 (0013 §3.1); anything else is skipped. */
export function detect(sheet: Sheet): Layout {
  const head = sheet.rows[0] ?? []
  const texts = Array.from(head, c => cellText(c))
  const find = (w: string) => texts.findIndex(t => isWord(t, w))
  const skipped: Layout = { kind: 'skipped', nameCols: 0, columns: [], lastCol: -1 }

  const weeks = texts.flatMap((t, c) => { const r = t ? weekRange(t) : undefined; return r ? [{ c, r, t }] : [] })
  const monthly = find('monthly')
  if (weeks.length >= 2 && monthly > weeks[weeks.length - 1].c) {
    return {
      kind: 'month', nameCols: Math.min(NAME_COLS_MAX, weeks[0].c),
      columns: weeks.map(w => ({ est: w.c, act: w.c + 1, header: w.t, from: w.r.from, to: w.r.to })),
      total: { est: monthly, act: monthly + 1 }, lastCol: monthly + 1,
    }
  }
  const days = texts.flatMap((t, c) => { const d = t ? monthDay(t) : undefined; return d ? [{ c, d, t }] : [] })
  const weekly = find('weekly')
  if (days.length >= 2 && weekly > days[days.length - 1].c) {
    return {
      kind: 'week', nameCols: Math.min(NAME_COLS_MAX, days[0].c),
      columns: days.map(d => ({ est: d.c, act: d.c + 1, header: d.t, from: d.d, to: d.d })),
      total: { est: weekly, act: weekly + 1 }, lastCol: weekly + 1,
    }
  }
  const dates = texts.flatMap((t, c) => { const d = t ? fullDate(t) : undefined; return d ? [{ c, d }] : [] })
  const time = find('time')
  if (dates.length === 1 && time >= 2) {
    return { kind: 'day', nameCols: Math.min(NAME_COLS_MAX, time - 1), columns: [], day: { date: dates[0].d, amount: time - 1, time }, lastCol: time }
  }
  const monthCols = MONTHS.map(m => texts.findIndex(t => t.toLowerCase().slice(0, 3) === m && /^[a-z]+\.?$/i.test(t)))
  if (monthCols.every((c, i) => c > 0 && (i === 0 || c > monthCols[i - 1]))) {
    const totalCol = texts.findIndex((t, c) => c > monthCols[11] && isWord(t, 'total'))
    return {
      kind: 'annual', nameCols: Math.min(NAME_COLS_MAX, monthCols[0]),
      columns: monthCols.map((c, i) => ({ act: c, header: texts[c], from: { month: i + 1, day: 1 }, to: { month: i + 1, day: 1 } })),
      total: totalCol > 0 ? { act: totalCol } : undefined, lastCol: totalCol > 0 ? totalCol : monthCols[11],
    }
  }
  return skipped
}

/** A named row of a sheet, placed in the sheet's own tree by its name column (0013 §3.3). */
export interface SourceRow {
  key: string
  /** 0-based row index. */
  r: number
  raw: string
  name: string
  nameKey: string
  level: number
  parent?: SourceRow
  children: SourceRow[]
  /** Note on one of the row's name cells. */
  note?: string
  /** Act. cell per data column, in `Layout.columns` order. */
  acts: { amount: Amount; note?: string; cell: string }[]
  est?: Amount
  totalAct?: Amount
  /** Day sheet: the amount and minutes after midnight, when the row has a Time. */
  dayAmount?: { amount: Amount; note?: string; cell: string }
  minutes?: number
}

/** Named rows under row 1, with parents by level; rows without a name are left out. */
export function sourceRows(sheet: Sheet, layout: Layout, sheetIndex: number): { rows: SourceRow[]; unnamed: number[] } {
  const rows: SourceRow[] = []
  const unnamed: number[] = []
  const stack: SourceRow[] = []
  for (let r = 1; r < sheet.rows.length; r++) {
    const cells = sheet.rows[r]
    if (!cells) continue
    let level = -1
    for (let c = 0; c < layout.nameCols; c++) if (cellText(cells[c]) !== '') { level = c; break }
    const cellOf = (c: number) => ({ amount: parseAmount(cells[c]), note: cells[c]?.note, cell: `${colName(c)}${r + 1}` })
    if (level < 0) {
      const dataCols = layout.kind === 'day' ? [layout.day!.amount] : layout.columns.map(d => d.act)
      if (dataCols.some(c => parseAmount(cells[c]).kind === 'value')) unnamed.push(r + 1)
      continue
    }
    const raw = cellText(cells[level])
    const name = importName(raw)
    let note: string | undefined
    for (let c = 0; c < layout.nameCols && !note; c++) note = cells[c]?.note
    const row: SourceRow = {
      key: `${sheetIndex}:${r + 1}`, r, raw, name, nameKey: nameKey(name), level, children: [], note,
      acts: layout.columns.map(d => cellOf(d.act)),
      est: layout.total?.est != null ? parseAmount(cells[layout.total.est]) : undefined,
      totalAct: layout.total ? parseAmount(cells[layout.total.act]) : undefined,
    }
    if (layout.day) {
      row.dayAmount = cellOf(layout.day.amount)
      const t = cellText(cells[layout.day.time])
      if (t) row.minutes = timeOfDay(t) ?? -1
    }
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) { row.parent = parent; parent.children.push(row) }
    stack.push(row)
    rows.push(row)
  }
  return { rows, unnamed }
}

/** Columns right of the read area that hold anything, labelled by their header (0013 §8). */
export function ignoredColumns(sheet: Sheet, layout: Layout): { column: string; header: string }[] {
  const out = new Map<number, string>()
  for (let r = 0; r < sheet.rows.length; r++) {
    const cells = sheet.rows[r] ?? []
    for (let c = layout.lastCol + 1; c < cells.length; c++) {
      const t = cellText(cells[c])
      if (!t || out.has(c) && out.get(c)) continue
      // Header: the first text in the column that isn't an amount.
      out.set(c, parseAmount(cells[c]).kind === 'bad' ? t : out.get(c) ?? '')
    }
  }
  return [...out].sort((a, b) => a[0] - b[0]).map(([c, header]) => ({ column: colName(c), header }))
}
