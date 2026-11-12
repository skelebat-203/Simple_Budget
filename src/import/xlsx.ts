// XLSX reader: stored cell values, sheet names and cell notes only. Formulas, macros,
// external links and embedded objects are never read or run (0013 §2).
import { XMLParser } from 'fast-xml-parser'
import { Zip } from './zip'
import { CellBudget, colName, IMPORT_MAX_COLS, IMPORT_MAX_ROWS, IMPORT_MAX_SHEETS, IMPORT_MAX_TEXT, ImportError, type Cell, type Sheet, type Workbook } from './grid'

type Node = Record<string, unknown>

/** Elements that can repeat, so the parser always gives arrays for them. */
const ARRAYS = new Set(['sheet', 'Relationship', 'row', 'c', 'si', 'r', 'comment', 'xf', 'numFmt'])
const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false,
  trimValues: false, htmlEntities: false, ignoreDeclaration: true, ignorePiTags: true,
  isArray: name => ARRAYS.has(name),
})

const DAMAGED = 'is damaged or isn’t a real spreadsheet, so it can’t be read.'

function xml(zip: Zip, path: string): Node | undefined {
  const s = zip.text(path)
  if (s == null) return undefined
  // No document types: they are the route to entity-expansion attacks.
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) throw new ImportError(DAMAGED)
  try { return parser.parse(s) as Node } catch { throw new ImportError(DAMAGED) }
}

const arr = <T = Node>(x: unknown): T[] => (Array.isArray(x) ? x : x == null ? [] : [x]) as T[]

/** Text of a node that may be a string, `{ '#text' }`, or rich text runs (`r` › `t`). */
function text(n: unknown): string {
  if (n == null) return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  const o = n as Node
  if (o['#text'] != null) return String(o['#text'])
  if (o.t != null) return text(o.t)
  if (o.r != null) return arr(o.r).map(r => text(r.t)).join('')
  return ''
}

/** Resolve a relationship target against the folder of the part that names it. */
function resolve(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = base.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

function rels(zip: Zip, part: string): Map<string, { type: string; target: string }> {
  const slash = part.lastIndexOf('/')
  const relPath = `${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`
  const doc = xml(zip, relPath)
  const out = new Map<string, { type: string; target: string }>()
  for (const r of arr((doc?.Relationships as Node | undefined)?.Relationship)) {
    // External links are never followed.
    if (r.TargetMode === 'External') continue
    out.set(String(r.Id), { type: String(r.Type ?? ''), target: resolve(part, String(r.Target ?? '')) })
  }
  return out
}

/** "AB12" → { r: 11, c: 27 } (0-based). */
function ref(s: string): { r: number; c: number } | undefined {
  const m = /^([A-Z]{1,3})(\d{1,7})$/.exec(s)
  if (!m) return undefined
  let c = 0
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64
  return { r: Number(m[2]) - 1, c: c - 1 }
}

/** Built-in number formats that show a date or time. */
const BUILTIN_DATES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58])
const isDateCode = (code: string) => {
  const s = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')
  return /[dmyhs]/i.test(s) && !/[0#?]/.test(s)
}

/** Style index → 'date' | 'time' | undefined, from styles.xml. */
function dateStyles(zip: Zip): Map<number, 'date' | 'time'> {
  const doc = xml(zip, 'xl/styles.xml')?.styleSheet as Node | undefined
  const custom = new Map<number, string>()
  for (const f of arr((doc?.numFmts as Node | undefined)?.numFmt)) custom.set(Number(f.numFmtId), String(f.formatCode ?? ''))
  const out = new Map<number, 'date' | 'time'>()
  arr((doc?.cellXfs as Node | undefined)?.xf).forEach((xf, i) => {
    const id = Number(xf.numFmtId)
    const code = custom.get(id)
    const date = code != null ? isDateCode(code) : BUILTIN_DATES.has(id)
    if (!date) return
    const timeOnly = code != null ? !/[dy]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')) : [18, 19, 20, 21, 45, 46, 47].includes(id)
    out.set(i, timeOnly ? 'time' : 'date')
  })
  return out
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Spreadsheet serial day → `MM/DD/YYYY` or `H:MM` (24 h) text, like a typed date or time. */
function serialText(serial: number, kind: 'date' | 'time', base1904: boolean): string {
  if (kind === 'time') {
    const mins = Math.round((serial - Math.floor(serial)) * 1440) % 1440
    return `${Math.floor(mins / 60)}:${pad(mins % 60)}`
  }
  const d = new Date(Date.UTC(base1904 ? 1904 : 1899, base1904 ? 0 : 11, base1904 ? 1 : 30) + Math.floor(serial) * 864e5)
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()}`
}

function notes(zip: Zip, sheetRels: Map<string, { type: string; target: string }>): Map<string, string> {
  const out = new Map<string, string>()
  for (const r of sheetRels.values()) {
    if (!r.type.endsWith('/comments')) continue
    const doc = xml(zip, r.target)?.comments as Node | undefined
    for (const c of arr((doc?.commentList as Node | undefined)?.comment)) {
      const t = text(c.text).trim().slice(0, IMPORT_MAX_TEXT)
      if (t) out.set(String(c.ref), t)
    }
  }
  return out
}

export function readXlsx(data: Uint8Array): Workbook {
  const zip = new Zip(data)
  const wbPath = 'xl/workbook.xml'
  const wb = xml(zip, wbPath)?.workbook as Node | undefined
  if (!wb) throw new ImportError(DAMAGED)
  const base1904 = ['1', 'true'].includes(String((wb.workbookPr as Node | undefined)?.date1904 ?? ''))
  const sheetsMeta = arr((wb.sheets as Node | undefined)?.sheet)
  if (sheetsMeta.length > IMPORT_MAX_SHEETS) throw new ImportError(`has ${sheetsMeta.length} sheets. Import at most ${IMPORT_MAX_SHEETS} (one per month and the annual sheet).`)
  const wbRels = rels(zip, wbPath)
  const strings = arr(((xml(zip, 'xl/sharedStrings.xml')?.sst as Node | undefined)?.si)).map(si => text(si).slice(0, IMPORT_MAX_TEXT))
  const styles = dateStyles(zip)
  const budget = new CellBudget()

  const sheets: Sheet[] = sheetsMeta.map(meta => {
    const name = String(meta.name ?? '').slice(0, IMPORT_MAX_TEXT)
    const rel = wbRels.get(String(meta.id ?? ''))
    const rows: (Cell | undefined)[][] = []
    // Chart sheets and missing parts read as empty sheets, which the importer skips.
    if (!rel || !rel.type.endsWith('/worksheet')) return { name, rows }
    const ws = xml(zip, rel.target)?.worksheet as Node | undefined
    const sheetNotes = notes(zip, rels(zip, rel.target))
    let r = -1
    for (const row of arr((ws?.sheetData as Node | undefined)?.row)) {
      r = row.r != null ? Number(row.r) - 1 : r + 1
      if (!Number.isInteger(r) || r < 0) throw new ImportError(DAMAGED)
      if (r >= IMPORT_MAX_ROWS) throw new ImportError(`has more than ${IMPORT_MAX_ROWS} rows in sheet “${name}”.`)
      const cells: (Cell | undefined)[] = []
      let c = -1
      for (const cell of arr(row.c)) {
        const at = cell.r != null ? ref(String(cell.r)) : undefined
        c = at ? at.c : c + 1
        if (c >= IMPORT_MAX_COLS) throw new ImportError(`has more than ${IMPORT_MAX_COLS} columns in sheet “${name}”.`)
        const t = String(cell.t ?? 'n')
        const raw = cell.t === 'inlineStr' ? text(cell.is) : text(cell.v)
        let v: string | number | undefined
        if (t === 's') v = strings[Number(raw)]
        else if (t === 'str' || t === 'inlineStr') v = raw.slice(0, IMPORT_MAX_TEXT)
        else if (t === 'b') v = raw === '1' ? 'TRUE' : 'FALSE'
        else if (t === 'n' && raw.trim() !== '') {
          const n = Number(raw)
          const kind = styles.get(Number(cell.s ?? 0))
          v = !Number.isFinite(n) ? undefined : kind ? serialText(n, kind, base1904) : n
        } else if (t === 'd') v = raw.slice(0, IMPORT_MAX_TEXT)
        // 'e' (error values) and empty cells hold nothing.
        const note = sheetNotes.get(`${colName(c)}${r + 1}`)
        if (v === undefined || v === '') { if (note) { budget.take(); cells[c] = { v: '', note } } continue }
        budget.take()
        cells[c] = note ? { v, note } : { v }
      }
      // Notes on cells that hold no value element at all.
      for (const [k, note] of sheetNotes) {
        const at = ref(k)
        if (at && at.r === r && !cells[at.c]) { budget.take(); cells[at.c] = { v: '', note } }
      }
      rows[r] = cells
    }
    // Notes on rows with no cells.
    for (const [k, note] of sheetNotes) {
      const at = ref(k)
      if (at && at.r < IMPORT_MAX_ROWS && at.c < IMPORT_MAX_COLS && !rows[at.r]) { budget.take(); rows[at.r] = []; rows[at.r][at.c] = { v: '', note } }
    }
    return { name, rows }
  })
  return { format: 'xlsx', sheets }
}
