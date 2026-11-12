// Import checks against the database: what `applyImport` writes (0013 §11). IndexedDB is
// fake-indexeddb, installed by run.mjs before Dexie loads.
import { strToU8 } from 'fflate'
import { db } from '../../src/storage/db'
import { budgetItemRepo, categoryRepo, checkBackup, exportBackup, skipped } from '../../src/storage/repository'
import { seedCategories } from '../../src/storage/seed'
import { applyImport, ImportError, importSnapshot, previewImport, readImportFile, type ImportOptions } from '../../src/import'
import { badFiles, readTestFile, SHEET_YEAR, TEST_FILES, TODAY, UNKNOWN_TOP_CSV } from './fixtures'

type Check = (ok: boolean, msg: string) => void

async function reset(seeded: boolean) {
  await db.transaction('rw', db.categories, db.budgetItems, async () => { await db.categories.clear(); await db.budgetItems.clear() })
  if (seeded) await seedCategories()
}
async function preview(name: string, bytes: Uint8Array, opts: ImportOptions = {}) {
  const wb = await readImportFile(new File([bytes as BlobPart], name))
  return previewImport(wb, await importSnapshot(TODAY), { year: SHEET_YEAR, ...opts })
}
async function state() {
  const cats = await categoryRepo.list(), items = await budgetItemRepo.list()
  return { cats: cats.length, items: items.length, skipped: { ...skipped }, total: items.reduce((t, i) => t + Math.round(i.amount * 100), 0) }
}
/** Runs `write`; returns its error message (or 'NO ERROR') and whether the data is unchanged. */
async function refused(write: () => Promise<unknown>) {
  const before = JSON.stringify(await state())
  let msg = 'NO ERROR'
  try { await write() } catch (e) { msg = e instanceof ImportError ? `Invalid: Import file ${e.message}` : `OTHER ${String(e)}` }
  return { msg, same: before === JSON.stringify(await state()) }
}

export async function run(check: Check) {
  // Every test file into an empty and a seeded database.
  for (const seeded of [false, true]) {
    for (const f of TEST_FILES) {
      await reset(seeded)
      const before = await state()
      const plan = await preview(f, readTestFile(f))
      const res = await applyImport(plan)
      const after = await state()
      const items = await budgetItemRepo.list(), cats = await categoryRepo.list()
      const byId = new Map(cats.map(c => [c.id!, c]))
      const backup = checkBackup(JSON.parse(JSON.stringify(await exportBackup())))
      const onTotal = items.filter(i => cats.some(c => c.parentId === i.categoryId) && !(byId.get(i.categoryId)!.name === 'Charity' && !byId.get(i.categoryId)!.rollup))
      const undated = items.filter(i => i.undated).length
      const tag = `${seeded ? 'seeded' : 'empty'} ${f}:`
      check(after.items - before.items === plan.summary.purchases && res.purchases === plan.summary.purchases, `${tag} ${plan.summary.purchases} purchases written`)
      check(after.total - before.total === Math.round(plan.summary.total * 100), `${tag} stored total equals the preview total`)
      check(after.skipped.items === 0 && after.skipped.categories === 0, `${tag} every stored row passes the shape and tree checks`)
      check(undated === plan.summary.undated, `${tag} ${undated} undated purchases marked`)
      check(backup.budgetItems.length === after.items && backup.budgetItems.filter(i => i.undated).length === undated, `${tag} backup check keeps every purchase and mark`)
      check(onTotal.length === 0, `${tag} no purchase stored on a total row`)
      check(cats.every(c => c.estimate == null || c.selected), `${tag} every row with an estimate is selected`)
    }
  }

  // Day sheet times are kept and order the Day table (Q10).
  await reset(true)
  await applyImport(await preview('day.csv', readTestFile('test_csv_day.csv')))
  const times = (await budgetItemRepo.list()).sort((a, b) => a.createdAt - b.createdAt).map(i => new Date(i.createdAt).toTimeString().slice(0, 5))
  check(times.length > 0 && times.every((t, i) => i === 0 || t >= times[i - 1]) && times.some(t => t !== '00:00'), `day sheet times kept: ${times.join(' ')}`)

  // Already imported (§6) and annual-only months that already have data (§7).
  const sep = readTestFile('test_csv_4_wk_mn.csv'), ann = readTestFile('test_csv_annual.csv')
  await reset(true)
  await applyImport(await preview('sep.csv', sep))
  const again = await preview('sep.csv', sep), kept = await preview('sep.csv', sep, { skipDuplicates: true })
  const dupRows = again.rows.filter(r => r.duplicates).length
  check(dupRows > 0 && kept.summary.purchases < again.summary.purchases, `second import warns on ${dupRows} rows; Skip those items keeps ${kept.summary.purchases} of ${again.summary.purchases}`)
  const annual = await preview('annual.csv', ann), annualImport = await preview('annual.csv', ann, { annualExisting: { 9: 'import' } })
  const inSep = (p: typeof annual) => p.purchases.filter(x => x.date.slice(5, 7) === '09').length
  check(annual.annualExisting.length === 1 && annual.annualExisting[0].month === 9 && inSep(annual) === 0 && inSep(annualImport) > 0, 'annual-only month with data: asks; default keeps the existing data')

  // Month sheets and the annual sheet in one workbook (Q7).
  const wb = readTestFile('test_xlsx_import_data.xlsx')
  await reset(true)
  const def = await preview('wb.xlsx', wb)
  const annualIdx = def.sheets.find(s => s.kind === 'annual')!.index, sepIdx = def.sheets.find(s => s.kind === 'month' && s.month === 9)!.index
  const swapped = await preview('wb.xlsx', wb, { monthSource: { 9: 'annual' }, excludedSheets: [0] })
  const from = (p: typeof def, i: number) => p.purchases.filter(x => x.rowKey.startsWith(`${i}:`))
  check(def.conflicts.length > 0 && from(def, annualIdx).length === 0 && from(swapped, annualIdx).some(x => x.date.slice(5, 7) === '09')
    && from(swapped, sepIdx).length === 0 && from(swapped, 0).length === 0,
  `month vs annual: ${def.conflicts.length} months flagged; choosing annual for Sep swaps the source; an unticked sheet imports nothing`)

  // A row that still needs a place (R1) blocks the write.
  await reset(true)
  const unplaced = await refused(async () => applyImport(await preview('unknown.csv', strToU8(UNKNOWN_TOP_CSV))))
  check(unplaced.msg !== 'NO ERROR' && unplaced.same, `rows without a place: ${unplaced.msg}; nothing written`)

  // Bad files: a plain message and no change.
  for (const [name, bytes] of Object.entries(badFiles())) {
    await reset(true)
    const r = await refused(async () => applyImport(await preview(name, bytes)))
    check(r.msg.startsWith('Invalid: Import file') && r.same, `${name}: ${r.msg}; data unchanged`)
  }

  // A preview made stale by another tab (row deleted) writes nothing.
  await reset(true)
  const stalePlan = await preview('sep.csv', sep)
  await db.categories.delete(stalePlan.purchases.find(p => p.categoryId > 0)!.categoryId)
  const stale = await refused(() => applyImport(stalePlan))
  check(stale.msg !== 'NO ERROR' && stale.same, `stale preview: ${stale.msg}; nothing written`)
}
