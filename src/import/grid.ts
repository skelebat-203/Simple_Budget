// Shared shapes for the import readers (0013 §1–§3) and their limits (§2).

/** Limits checked while reading; over any of them the import stops and writes nothing (0013 §2). */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024
/** One sheet per month plus the annual sheet (decided 2026-11-11). */
export const IMPORT_MAX_SHEETS = 13
export const IMPORT_MAX_ROWS = 5000
export const IMPORT_MAX_COLS = 256
export const IMPORT_MAX_CELLS = 300_000
/** Unzipped size of every XLSX part read, together (zip bombs). */
export const IMPORT_MAX_UNZIPPED = 40 * 1024 * 1024
/** Entries in an XLSX zip directory. */
export const IMPORT_MAX_ZIP_ENTRIES = 2000
/** Longest text kept from one cell; longer text is cut (names and descriptions are shorter still). */
export const IMPORT_MAX_TEXT = 500

/** A cell's stored value (never a formula) and its note, if any. Dates from XLSX arrive as `MM/DD/YYYY` text. */
export interface Cell { v: string | number; note?: string }

/** One sheet as a sparse grid: `rows[r][c]`, both 0-based. */
export interface Sheet { name: string; rows: (Cell | undefined)[][] }

export interface Workbook { format: 'csv' | 'xlsx'; sheets: Sheet[] }

/** Why a file can't be imported; completes the sentence "Invalid: Import file …". */
export class ImportError extends Error {}

/** Counts cells across a workbook and stops at the limit. */
export class CellBudget {
  private n = 0
  take() { if (++this.n > IMPORT_MAX_CELLS) throw new ImportError('has too many cells. Import one year or fewer sheets at a time.') }
}

/** Column letter for a 0-based index (0 → A, 26 → AA). */
export function colName(c: number): string {
  let s = ''
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** Cell text, trimmed; numbers as plain text. */
export const cellText = (c: Cell | undefined): string => (c == null ? '' : typeof c.v === 'number' ? String(c.v) : c.v.trim())
