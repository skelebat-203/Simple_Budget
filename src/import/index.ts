// Spreadsheet import (0013): read a file, preview it against the database, then
// `applyImport` (storage/repository.ts) writes the confirmed preview.
import { budgetItemRepo, categoryRepo } from '../storage/repository'
import { readCsv } from './csv'
import { NOT_ODS, readOds } from './ods'
import { readXlsx } from './xlsx'
import { IMPORT_MAX_BYTES, ImportError, type Workbook } from './grid'
import { buildPlan, type ImportOptions, type ImportPlan, type Snapshot } from './plan'

export { ImportError, type Workbook } from './grid'
export type { ImportOptions, ImportPlan, PlanRow, PlanSheet, Snapshot, TargetChoice } from './plan'
export { money, monthName } from './plan'
export { applyImport } from '../storage/repository'

/** File types the picker offers. */
export const IMPORT_ACCEPT = '.csv,.xlsx,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet'

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]

/**
 * Read a CSV, XLSX or ODS file into sheets of stored values. Throws ImportError (a full sentence;
 * the UI shows it after "Invalid: ") for an unsupported type, a file over a limit,
 * or one that can't be read; nothing is written.
 */
export async function readImportFile(file: File): Promise<Workbook> {
  if (file.size > IMPORT_MAX_BYTES) throw new ImportError('File is larger than 5 MB. Save a copy with fewer sheets and try again.')
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase()
  if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'ods') throw new ImportError('Unsupported file type. Choose a .csv, .xlsx or .ods file.')
  const data = new Uint8Array(await file.arrayBuffer())
  const zip = ZIP_MAGIC.every((b, i) => data[i] === b)
  if (ext === 'xlsx') {
    if (!zip) throw new ImportError('File isn’t a real .xlsx file, so it can’t be read.')
    return readXlsx(data)
  }
  if (ext === 'ods') {
    if (!zip) throw new ImportError(NOT_ODS)
    return readOds(data)
  }
  if (zip || data.includes(0)) throw new ImportError('File isn’t a text CSV file, so it can’t be read.')
  const name = file.name.replace(/\.csv$/i, '')
  return { format: 'csv', sheets: [readCsv(new TextDecoder().decode(data), name)] }
}

/** Current data the preview compares against. */
export async function importSnapshot(today = new Date()): Promise<Snapshot> {
  const [categories, items] = await Promise.all([categoryRepo.list(), budgetItemRepo.list()])
  return { categories, purchases: items.map(i => ({ categoryId: i.categoryId, date: i.date, amount: i.amount })), today }
}

/** Preview of a read file with the user's choices so far; call again after each change. */
export function previewImport(wb: Workbook, snapshot: Snapshot, options: ImportOptions = {}): ImportPlan {
  return buildPlan(wb, snapshot, options)
}
