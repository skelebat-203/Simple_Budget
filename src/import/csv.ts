// CSV reader (RFC 4180): quoted fields, doubled quotes, CRLF/LF/CR line ends, UTF-8 BOM.
// Cell text is data only; nothing is evaluated (0013 §2).
import { CellBudget, IMPORT_MAX_COLS, IMPORT_MAX_ROWS, IMPORT_MAX_TEXT, ImportError, type Cell, type Sheet } from './grid'

export function readCsv(text: string, name: string, budget = new CellBudget()): Sheet {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: (Cell | undefined)[][] = []
  let row: (Cell | undefined)[] = []
  let field = ''
  let quoted = false
  let i = 0
  const endField = () => {
    if (row.length >= IMPORT_MAX_COLS) {
      if (field.trim() !== '') throw new ImportError(`has more than ${IMPORT_MAX_COLS} columns.`)
    } else if (field !== '') {
      budget.take()
      row[row.length] = { v: field.slice(0, IMPORT_MAX_TEXT) }
    } else row.length++
    field = ''
  }
  const endRow = () => {
    endField()
    if (rows.length >= IMPORT_MAX_ROWS) throw new ImportError(`has more than ${IMPORT_MAX_ROWS} rows.`)
    rows.push(row.some(c => c) ? row : [])
    row = []
  }
  while (i < src.length) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue }
        quoted = false
      } else field += ch
      i++
      continue
    }
    if (ch === '"' && field === '') quoted = true
    else if (ch === ',') endField()
    else if (ch === '\r' || ch === '\n') {
      endRow()
      if (ch === '\r' && src[i + 1] === '\n') i++
    } else field += ch
    i++
  }
  if (quoted) throw new ImportError('has a quote that is never closed, so it can’t be read.')
  if (field !== '' || row.length) endRow()
  while (rows.length && !rows[rows.length - 1].length) rows.pop()
  return { name, rows }
}
