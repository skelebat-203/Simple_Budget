// Spreadsheet import (0013): read a file, preview it against the database, then
// `applyImport` (storage/repository.ts) writes the confirmed preview.
import { budgetItemRepo, categoryRepo } from '../storage/repository'
import { readCsv } from './csv'
import { readXlsx } from './xlsx'
import { IMPORT_MAX_BYTES, ImportError, type Workbook } from './grid'
import { buildPlan, type ImportOptions, type ImportPlan, type Snapshot } from './plan'

export { ImportError } from './grid'
export type { ImportOptions, ImportPlan, PlanRow, PlanSheet, TargetChoice } from './plan'
export { monthName } from './plan'
export { applyImport } from '../storage/repository'

/** File types the picker offers (ODS comes with plan step 13a). */
export const IMPORT_ACCEPT = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]

/**
 * Read a CSV or XLSX file into sheets of stored values. Throws ImportError (message
 * completes "Invalid: Import file …") for an unsupported type, a file over a limit,
 * or one that can't be read; nothing is written.
 */
export async function readImportFile(file: File): Promise<Workbook> {
  if (file.size > IMPORT_MAX_BYTES) throw new ImportError('is larger than 5 MB. Save a copy with fewer sheets and try again.')
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase()
  if (ext === 'ods') throw new ImportError('is an ODS file, which can’t be imported yet. Save it as .xlsx or .csv and try again.')
  if (ext !== 'csv' && ext !== 'xlsx') throw new ImportError('unsupported file type. Choose a .csv or .xlsx file.')
  const data = new Uint8Array(await file.arrayBuffer())
  const zip = ZIP_MAGIC.every((b, i) => data[i] === b)
  if (ext === 'xlsx') {
    if (!zip) throw new ImportError('isn’t a real .xlsx file, so it can’t be read.')
    return readXlsx(data)
  }
  if (zip || data.includes(0)) throw new ImportError('isn’t a text CSV file, so it can’t be read.')
  const name = file.name.replace(/\.csv$/i, '')
  return { format: 'csv', sheets: [readCsv(new TextDecoder().decode(data), name)] }
}

/** Current data the preview compares against. */
export async function importSnapshot(today = new Date()): Promise<Snapshot> {
  const [categories, items] = await Promise.all([categoryRepo.list(), budgetItemRepo.list()])
  return { categories, purchases: items.map(i => ({ categoryId: i.categoryId, date: i.date })), today }
}

/** Preview of a read file with the user's choices so far; call again after each change. */
export function previewImport(wb: Workbook, snapshot: Snapshot, options: ImportOptions = {}): ImportPlan {
  return buildPlan(wb, snapshot, options)
}
