// ODS reader: stored cell values, sheet names and cell notes from content.xml only.
// Formulas (`table:formula`), macros, charts, embedded objects and links are never read or run (0013 §2).
import { XMLParser } from 'fast-xml-parser'
import { Zip } from './zip'
import { CellBudget, DAMAGED_FILE, IMPORT_MAX_COLS, IMPORT_MAX_ROWS, IMPORT_MAX_SHEETS, IMPORT_MAX_TEXT, ImportError, tooManyCols, tooManyRows, tooManySheets, type Cell, type Sheet, type Workbook } from './grid'

const ODS_MIMETYPE = 'application/vnd.oasis.opendocument.spreadsheet'
export const NOT_ODS = 'File isn’t a real .ods spreadsheet, so it can’t be read.'
/** Largest repeat count read; real files repeat blank cells and rows up to the sheet's end (about 1,048,576 rows). */
const MAX_REPEAT = 1 << 24
/** Element groups that only wrap rows. */
const ROW_GROUPS = new Set(['table:table-header-rows', 'table:table-rows', 'table:table-row-group'])

/** In document order: `[{ tag: children, ':@': attributes }, { '#text': … }]`. Namespace prefixes are kept. */
type Node = Record<string, unknown>
const parser = new XMLParser({
  preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, parseAttributeValue: false,
  trimValues: false, htmlEntities: false, ignoreDeclaration: true, ignorePiTags: true,
})

const tagOf = (n: Node) => Object.keys(n).find(k => k !== ':@') ?? ''
const kids = (n: Node) => (n[tagOf(n)] as Node[] | undefined) ?? []
const attr = (n: Node, name: string): string | undefined => {
  const v = (n[':@'] as Record<string, unknown> | undefined)?.[name]
  return v == null ? undefined : String(v)
}
const child = (n: Node, tag: string) => kids(n).find(k => tagOf(k) === tag)

/** `table:number-…-repeated`, 1 when absent; a bad count means a damaged file. */
function repeat(n: Node, name: string): number {
  const s = attr(n, name)
  if (s == null) return 1
  const k = Number(s)
  if (!Number.isInteger(k) || k < 1 || k > MAX_REPEAT) throw new ImportError(DAMAGED_FILE)
  return k
}

/** Text inside a paragraph: spans and links, `text:s` spaces, tabs and line breaks. Notes are left out. */
function inline(nodes: Node[]): string {
  let s = ''
  for (const n of nodes) {
    const t = tagOf(n)
    if (t === '#text') s += String(n['#text'])
    else if (t === 'text:s') s += ' '.repeat(Math.min(repeat(n, 'text:c'), IMPORT_MAX_TEXT))
    else if (t === 'text:tab') s += '\t'
    else if (t === 'text:line-break') s += '\n'
    else if (t !== 'office:annotation') s += inline(kids(n))
    if (s.length > IMPORT_MAX_TEXT) return s
  }
  return s
}

/** Paragraphs (`text:p`, `text:h`) of an element, one per line. */
const paragraphs = (n: Node) => kids(n).filter(k => ['text:p', 'text:h'].includes(tagOf(k))).map(p => inline(kids(p))).join('\n').slice(0, IMPORT_MAX_TEXT)

/** A cell note without the "Author:" line that notes from Excel start with (the XLSX reader never sees that line). */
function noteText(annotation: Node): string {
  const s = paragraphs(annotation).trim()
  const creator = child(annotation, 'dc:creator')
  const by = creator ? `${inline(kids(creator)).trim()}:` : ''
  return by !== ':' && s.startsWith(by) ? s.slice(by.length).trim() : s
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Stored value, shown the way the XLSX reader shows it: dates `MM/DD/YYYY`, times `H:MM`, booleans `TRUE`/`FALSE`. */
function value(cell: Node): string | number | undefined {
  const type = attr(cell, 'office:value-type')
  if (type === 'float' || type === 'currency' || type === 'percentage') {
    const n = Number(attr(cell, 'office:value'))
    return Number.isFinite(n) ? n : undefined
  }
  if (type === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(attr(cell, 'office:date-value') ?? '')
    return m ? `${m[2]}/${m[3]}/${m[1]}` : undefined
  }
  if (type === 'time') {
    const m = /^-?PT(\d+)H(\d+)M/.exec(attr(cell, 'office:time-value') ?? '')
    return m ? `${Number(m[1]) % 24}:${pad(Number(m[2]))}` : undefined
  }
  if (type === 'boolean') return attr(cell, 'office:boolean-value') === 'true' ? 'TRUE' : 'FALSE'
  // 'string', or no type: the paragraph text.
  return (attr(cell, 'office:string-value') ?? paragraphs(cell)).slice(0, IMPORT_MAX_TEXT)
}

function readSheet(table: Node, budget: CellBudget): Sheet {
  const name = (attr(table, 'table:name') ?? '').slice(0, IMPORT_MAX_TEXT)
  const rows: (Cell | undefined)[][] = []
  let r = 0
  const readRow = (row: Node) => {
    const count = repeat(row, 'table:number-rows-repeated')
    const cells: (Cell | undefined)[] = []
    let c = 0
    let filled = false
    for (const cell of kids(row)) {
      const tag = tagOf(cell)
      if (tag !== 'table:table-cell' && tag !== 'table:covered-table-cell') continue
      const span = repeat(cell, 'table:number-columns-repeated')
      // A covered cell sits under a merged cell. Like XLSX, any value it still stores is read; a merge's text stays in its first cell.
      const v = value(cell)
      const noteNode = child(cell, 'office:annotation')
      const note = noteNode ? noteText(noteNode) : ''
      if ((v === undefined || v === '') && !note) { c += span; continue }
      // Stored values only; `table:formula` is never read.
      const out: Cell = { v: v ?? '', ...(note ? { note } : {}) }
      for (let k = 0; k < span; k++, c++) {
        if (c >= IMPORT_MAX_COLS) throw tooManyCols(name)
        budget.take()
        cells[c] = out
      }
      filled = true
    }
    if (!filled) { r += count; return }
    for (let k = 0; k < count; k++, r++) {
      if (r >= IMPORT_MAX_ROWS) throw tooManyRows(name)
      if (k) cells.forEach(() => budget.take())
      rows[r] = k ? [...cells] : cells
    }
  }
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      const tag = tagOf(n)
      if (tag === 'table:table-row') readRow(n)
      else if (ROW_GROUPS.has(tag)) walk(kids(n))
    }
  }
  walk(kids(table))
  return { name, rows }
}

export function readOds(data: Uint8Array): Workbook {
  const zip = new Zip(data)
  if (zip.text('mimetype')?.trim() !== ODS_MIMETYPE) throw new ImportError(NOT_ODS)
  const s = zip.text('content.xml')
  if (s == null) throw new ImportError(DAMAGED_FILE)
  // No document types: they are the route to entity-expansion attacks.
  if (/<!DOCTYPE|<!ENTITY/i.test(s)) throw new ImportError(DAMAGED_FILE)
  let doc: Node[]
  try { doc = parser.parse(s) as Node[] } catch { throw new ImportError(DAMAGED_FILE) }
  const root = doc.find(n => tagOf(n) === 'office:document-content')
  const book = root && child(root, 'office:body')
  const sheet = book && child(book, 'office:spreadsheet')
  if (!sheet) throw new ImportError(DAMAGED_FILE)
  const tables = kids(sheet).filter(n => tagOf(n) === 'table:table')
  if (tables.length > IMPORT_MAX_SHEETS) throw tooManySheets(tables.length)
  const budget = new CellBudget()
  return { format: 'ods', sheets: tables.map(t => readSheet(t, budget)) }
}
