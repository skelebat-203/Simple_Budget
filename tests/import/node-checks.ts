// Import checks that need no database (0013 §11): reading, the preview and the safety limits.
// Run with `npm run test:import`.
import { strToU8 } from 'fflate'
import type { Category } from '../../src/storage/db'
import { readImportFile } from '../../src/import'
import { ImportError, type Workbook } from '../../src/import/grid'
import { buildPlan, type ImportOptions, type ImportPlan } from '../../src/import/plan'
import { detect, sourceRows } from '../../src/import/sheets'
import { dateBounds } from '../../src/budget/validate'
import { badFiles, formulaFiles, readTestFile, seededCategories, SHEET_YEAR, TEST_FILES, TODAY, UNKNOWN_TOP_CSV } from './fixtures'

/**
 * Sheet totals that differ from the import because the anonymized sheet itself doesn't add up
 * (its week cells and its Monthly cell disagree). Cents, imported minus the sheet's own row totals.
 */
const KNOWN_SHEET_DIFFS: Record<string, number> = { 'test_xlsx_import_data.xlsx|Feb': 750 }

type Check = (ok: boolean, msg: string) => void

const read = (name: string, bytes: Uint8Array) => readImportFile(new File([bytes as BlobPart], name))
const plan = (wb: Workbook, cats: Category[] = [], opts: ImportOptions = {}): ImportPlan =>
  buildPlan(wb, { categories: cats, purchases: [], today: TODAY }, { year: SHEET_YEAR, ...opts })
const cents = (n: number) => Math.round(n * 100)

/** Each included sheet's own row totals (Monthly Act., day amounts, annual months) against what the preview imports. */
function sheetTotals(file: string, wb: Workbook, p: ImportPlan, check: Check) {
  wb.sheets.forEach((s, i) => {
    const l = detect(s)
    if (l.kind === 'skipped' || !p.sheets[i].included) return
    // Annual months that a month sheet supplies instead (Q7).
    const fromMonthSheet = new Set(p.conflicts.filter(c => c.source === 'month').map(c => c.month))
    let own = 0
    for (const r of sourceRows(s, l, i).rows) {
      if (r.children.length || r.nameKey === 'net-income' || (l.kind === 'annual' && r.nameKey === 'misc')) continue
      if (l.kind === 'day') own += r.dayAmount?.amount.kind === 'value' ? cents(r.dayAmount.amount.value) : 0
      else if (l.kind === 'annual') own += r.acts.reduce((t, a, ci) => t + (a.amount.kind === 'value' && !fromMonthSheet.has(l.columns[ci].from.month) ? cents(a.amount.value) : 0), 0)
      else own += r.totalAct?.kind === 'value' ? cents(r.totalAct.value) : 0
    }
    const got = p.purchases.filter(x => x.rowKey.startsWith(`${i}:`)).reduce((t, x) => t + cents(x.amount), 0)
    const known = KNOWN_SHEET_DIFFS[`${file}|${s.name.trim()}`] ?? 0
    check(got - own === known, `${file} › ${s.name.trim()} (${l.kind}): imported ${(got / 100).toFixed(2)}, sheet rows ${(own / 100).toFixed(2)}${known ? ' (known sheet difference)' : ''}`)
  })
}

export async function run(check: Check) {
  const seeded = seededCategories()

  // Every test file, into an empty and a seeded database.
  const totals = new Map<string, number>()
  for (const f of TEST_FILES) {
    const wb = await read(f, readTestFile(f))
    const runs: [string, Category[]][] = [['empty', []], ['seeded', seeded]]
    for (const [label, cats] of runs) {
      const p = plan(wb, cats)
      if (label === 'seeded') { sheetTotals(f, wb, p, check); totals.set(f, cents(p.summary.total)) }
      const paths = [...p.newCategories.map(c => c.name), ...cats.map(c => c.name)]
      check(!paths.some(n => /RV Spending|Mom Support/i.test(n)), `${f} (${label}): no RV Spending or Mom Support rows`)
      const misc = p.purchases.filter(x => p.rows.find(r => r.key === x.rowKey)?.target?.path === 'Expenses › Incidentals › Miscellaneous')
      check(misc.every(x => x.description), `${f} (${label}): ${misc.length} Incidentals › Miscellaneous purchases, all described`)
      check(p.unplaced.length === 0, `${f} (${label}): every row has a place`)
    }
  }

  // CSV and XLSX copies of the same sheets give the same result.
  const wbX = await read('test_xlsx_import_data.xlsx', readTestFile('test_xlsx_import_data.xlsx'))
  const wbWD = await read('test_xlsx_week_day.xlsx', readTestFile('test_xlsx_week_day.xlsx'))
  const sheetTotal = (wb: Workbook, name: RegExp) => {
    const i = wb.sheets.findIndex(s => name.test(s.name.trim()))
    const p = plan(wb, seeded, { excludedSheets: wb.sheets.map((_, j) => j).filter(j => j !== i) })
    return `${p.summary.purchases} ${p.summary.total.toFixed(2)}`
  }
  for (const [csv, wb, name] of [['test_csv_4_wk_mn.csv', wbX, /^Sep/i], ['test_csv_5_wk_mn.csv', wbX, /^Oct/i], ['test_csv_week.csv', wbWD, /week/i], ['test_csv_day.csv', wbWD, /day/i]] as const) {
    const fromCsv = plan(await read(csv, readTestFile(csv)), seeded)
    check(`${fromCsv.summary.purchases} ${fromCsv.summary.total.toFixed(2)}` === sheetTotal(wb, name), `${csv} matches its XLSX sheet (${sheetTotal(wb, name)})`)
  }

  // Default year: the current year (Q1, R11); a day sheet keeps the year in its date.
  const sep = await read('test_csv_4_wk_mn.csv', readTestFile('test_csv_4_wk_mn.csv'))
  const noYear = buildPlan(sep, { categories: seeded, purchases: [], today: TODAY })
  check(noYear.defaultYear === TODAY.getFullYear() && noYear.year === TODAY.getFullYear(), `default year is the current year (${noYear.year})`)
  const day = buildPlan(await read('test_csv_day.csv', readTestFile('test_csv_day.csv')), { categories: seeded, purchases: [], today: TODAY })
  check(day.purchases.every(x => x.date.startsWith(`${SHEET_YEAR}-`)), 'a day sheet keeps the year in its date')

  // Date limits: back to 1970-01-01 (R16).
  check(dateBounds(TODAY).min === '1970-01-01', 'lowest allowed date is 1970-01-01')
  check(plan(sep, seeded, { year: 1970 }).year === 1970 && plan(sep, seeded, { year: 1969 }).year === TODAY.getFullYear(), 'year 1970 is accepted; 1969 falls back to the default')

  // A top-level row the app doesn't know needs a place (R1).
  const unknown = await read('unknown.csv', strToU8(UNKNOWN_TOP_CSV))
  const asked = plan(unknown, seeded)
  const hobbies = asked.rows.find(r => r.name === 'Hobbies')!, garden = asked.rows.find(r => r.name === 'Garden')!
  check(!!hobbies.needsPlace && !!garden.needsPlace && asked.unplaced.length === 2 && asked.purchases.length === 1, 'unknown top-level rows wait for a place; only Groceries is planned')
  const expenses = seeded.find(c => c.name === 'Expenses')!.id!, gifts = seeded.find(c => c.name === 'Gifts')!.id!
  const placed = plan(unknown, seeded, { targets: { [hobbies.key]: { parentId: expenses }, [garden.key]: { categoryId: gifts } } })
  check(placed.unplaced.length === 0 && placed.rows.find(r => r.name === 'Paint')?.target?.path === 'Expenses › Hobbies › Paint'
    && placed.rows.find(r => r.name === 'Garden')?.target?.path === 'Expenses › Gifts' && placed.summary.total === 23, 'a chosen place: Hobbies under Expenses, Garden on Gifts')
  const skipped = plan(unknown, seeded, { targets: { [hobbies.key]: 'skip', [garden.key]: 'skip' } })
  check(skipped.unplaced.length === 0 && skipped.summary.total === 10, '"skip" answers the question and imports nothing from those rows')

  // Formulas and script-like text are data only.
  const ff = formulaFiles()
  const fx = plan(await read('formulas.xlsx', ff['formulas.xlsx']), seeded)
  check(fx.purchases.length === 1 && fx.purchases[0].amount === 5, 'a formula imports its stored value, never its result; formula text is skipped')
  check(fx.rows.some(r => r.warnings.some(w => w.includes('=1+2'))), 'formula text in an amount cell is reported')
  const fc = plan(await read('formula.csv', ff['formula.csv']), seeded)
  check(fc.purchases.every(x => typeof x.amount === 'number') && fc.rows.some(r => r.warnings.some(w => w.includes('+5'))), 'CSV formula text is skipped with a warning')

  // Hostile and malformed files fail with a plain message.
  for (const [name, bytes] of Object.entries(badFiles())) {
    const t0 = performance.now()
    let msg = 'NO ERROR'
    try { plan(await read(name, bytes), seeded) } catch (e) { msg = e instanceof ImportError ? `Invalid: Import file ${e.message}` : `OTHER ${String(e)}` }
    check(msg.startsWith('Invalid: Import file'), `${name}: ${msg} (${Math.round(performance.now() - t0)} ms)`)
  }
  return { totals: Object.fromEntries(totals) }
}
