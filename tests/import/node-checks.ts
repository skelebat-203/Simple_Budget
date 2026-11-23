// Import checks that need no database (0013 §11): reading, the preview and the safety limits.
// Run with `npm run test:import`.
import { strToU8 } from 'fflate'
import type { Category } from '../../src/storage/db'
import { readImportFile } from '../../src/import'
import { ImportError, type Workbook } from '../../src/import/grid'
import { buildPlan, type ImportOptions, type ImportPlan } from '../../src/import/plan'
import { detect, sourceRows } from '../../src/import/sheets'
import { LOST_VALUES_TITLE, lostValuesText } from '../../src/components/import/text'
import { dateBounds, expandName } from '../../src/budget/validate'
import { importName } from '../../src/import/cells'
import { estimateFor, FREQUENCIES, WEEK_MONTHS } from '../../src/budget/tree'
import { badFiles, formulaFiles, manyNotesXlsx, ods, odsDoc, odsRow, odsStr, odsTable, readTestFile, seededCategories, SHEET_YEAR, TEST_FILES, TODAY, UNKNOWN_TOP_CSV } from './fixtures'

/**
 * Sheet totals that differ from the import because the anonymized sheet itself doesn't add up
 * (its week cells and its Monthly cell disagree). Cents, imported minus the sheet's own row totals.
 */
const KNOWN_SHEET_DIFFS: Record<string, number> = { 'test_xlsx_import_data.xlsx|Feb': 750 }

/**
 * Cells missing from docs/test_sheets/test_ods_import_data.ods, per sheet: the file stores them as empty
 * covered cells (merge leftovers), so their values are gone from the file itself, not misread.
 * Set to {} once the file is replaced by a clean ODS copy of the XLSX workbook; then parity is exact.
 */
const ODS_LOST_CELLS: Record<string, number> = {
  Jan: 95, Feb: 98, Mar: 99, Apr: 95, May: 95, Jun: 96, Jul: 101, Aug: 97, Sep: 102, Oct: 102, Nov: 102, Annual: 29, Subscriptions: 4,
}
/** Empty covered cells the lost-values check finds in the amount area of the ODS test file (Oct finds 101 of its 102 lost cells). */
const ODS_LOST_IN_DATA = 1110
const ODS_LOST_SHEETS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Annual']
/** Many-notes regression file: the old reader took 28 s on this size; the fixed one takes well under a second. */
const MANY_NOTES = 40_000
const MANY_NOTES_ROWS = 5000
const MANY_NOTES_MAX_MS = 5000
const purchaseList = (p: ImportPlan) => p.purchases.map(x => `${x.date} ${x.amount} ${x.description ?? ''}`).join('|')

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

/** Cells of one row, holes as null, for comparing. */
const wbRow = (wb: Workbook, r: number, sheet = 0) => Array.from(wb.sheets[sheet]?.rows[r] ?? [], c => c ?? null)

export async function run(check: Check) {
  const seeded = seededCategories()

  // Every test file, into an empty and a seeded database.
  const totals = new Map<string, number>()
  for (const f of TEST_FILES) {
    const wb = await read(f, readTestFile(f))
    const runs: [string, Category[]][] = [['empty', []], ['seeded', seeded]]
    for (const [label, cats] of runs) {
      const p = plan(wb, cats)
      // A file that lost cells can't add up to its own total cells.
      if (label === 'seeded' && !(f.endsWith('.ods') && Object.keys(ODS_LOST_CELLS).length)) sheetTotals(f, wb, p, check)
      if (label === 'seeded') totals.set(f, cents(p.summary.total))
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

  // The ODS copy of the XLSX workbook gives the same result, sheet by sheet and as a whole.
  const wbO = await read('test_ods_import_data.ods', readTestFile('test_ods_import_data.ods'))
  check(wbO.format === 'ods' && wbO.sheets.length === wbX.sheets.length, `ODS has ${wbO.sheets.length} sheets, XLSX ${wbX.sheets.length}`)
  const byMonth = (p: ImportPlan) => {
    const m = new Map<string, [number, number]>()
    for (const x of p.purchases) { const k = x.date.slice(0, 7); const v = m.get(k) ?? [0, 0]; m.set(k, [v[0] + 1, v[1] + cents(x.amount)]) }
    return [...m].sort().map(([k, [n, t]]) => `${k}:${n}/${(t / 100).toFixed(2)}`).join(' ')
  }
  const lostTotal = Object.values(ODS_LOST_CELLS).reduce((t, n) => t + n, 0)
  wbX.sheets.forEach((sx, i) => {
    const so = wbO.sheets[i]
    if (!so) return
    // Cell by cell: every cell the ODS file holds equals the XLSX cell; any other difference is a cell the file lost.
    let lost = 0, other = 0
    for (let r = 0; r < Math.max(so.rows.length, sx.rows.length); r++) {
      const a = so.rows[r] ?? [], b = sx.rows[r] ?? []
      for (let c = 0; c < Math.max(a.length, b.length); c++) {
        if (JSON.stringify(a[c] ?? null) === JSON.stringify(b[c] ?? null)) continue
        if (!a[c]) lost++; else other++
      }
    }
    const one = (wb: Workbook) => plan(wb, seeded, { excludedSheets: wb.sheets.map((_, j) => j).filter(j => j !== i) })
    const [px, po] = [one(wbX), one(wbO)]
    const known = ODS_LOST_CELLS[so.name.trim()] ?? 0
    const same = so.name === sx.name && detect(so).kind === detect(sx).kind && other === 0 && lost === known
      && (known > 0 || purchaseList(po) === purchaseList(px))
    check(same, `ODS parity › "${so.name}" (${detect(so).kind}): ${po.summary.purchases} purchases ${po.summary.total.toFixed(2)}; XLSX ${px.summary.purchases} ${px.summary.total.toFixed(2)}${known ? `; ${lost} cells missing from the ODS file (known)` : ''}`)
  })
  for (const [label, cats] of [['empty', []], ['seeded', seeded]] as [string, Category[]][]) {
    const [px, po] = [plan(wbX, cats), plan(wbO, cats)]
    const names = (p: ImportPlan) => p.newCategories.map(c => c.name)
    // While the ODS file has lost cells, rows whose amounts were lost add no category, so only a subset is expected.
    const tree = lostTotal ? names(po).every(n => names(px).includes(n)) : JSON.stringify(names(po)) === JSON.stringify(names(px))
    check(tree && po.unplaced.length === px.unplaced.length && (lostTotal > 0 || byMonth(po) === byMonth(px)), `ODS parity (${label}): ${lostTotal ? 'new categories are a subset of the XLSX ones' : 'the same new categories, per-month counts and totals'} (ODS ${po.summary.purchases} purchases ${po.summary.total.toFixed(2)}, XLSX ${px.summary.purchases} ${px.summary.total.toFixed(2)})`)
    if (label === 'seeded') console.log(`  per month, ODS: ${byMonth(po)}
  per month, XLSX: ${byMonth(px)}`)
  }

  // ODS details: notes, hidden columns, merged headers, trailing blank repeats.
  const odsNotes = await read('notes.ods', ods(odsDoc(odsTable(' Subscriptions ', odsRow(
    '<table:table-cell office:value-type="float" office:value="2"><office:annotation><text:p>paid late</text:p></office:annotation><text:p>2</text:p></table:table-cell>'
    + '<table:table-cell><office:annotation><text:p>empty but noted</text:p></office:annotation></table:table-cell>'
    + '<table:table-cell office:value-type="date" office:date-value="2023-01-05"/><table:table-cell office:value-type="time" office:time-value="PT17H10M00S"/>'
    + '<table:table-cell office:value-type="boolean" office:boolean-value="true"/>' + odsStr('a<text:s text:c="2"/>b')) + odsRow(odsStr('x'))))))
  const r0 = wbRow(odsNotes, 0)
  check(odsNotes.sheets[0].name === ' Subscriptions ' && r0[0]?.v === 2 && r0[0]?.note === 'paid late' && r0[1]?.v === '' && r0[1]?.note === 'empty but noted'
    && r0[2]?.v === '01/05/2023' && r0[3]?.v === '17:10' && r0[4]?.v === 'TRUE' && r0[5]?.v === 'a  b', 'ODS notes, dates, times, booleans and spaces read like XLSX')
  const t0 = performance.now()
  const wide = await read('blank-repeats.ods', ods(odsDoc(odsTable('S', odsRow(odsStr('x') + '<table:table-cell table:number-columns-repeated="16383"/>')
    + '<table:table-row table:number-rows-repeated="1048575"><table:table-cell table:number-columns-repeated="16384"/></table:table-row>'))))
  check(wide.sheets[0].rows.length === 1, `trailing blank ODS repeats are skipped cheaply (${Math.round(performance.now() - t0)} ms)`)
  const xJan = wbX.sheets.findIndex(s => /^Jan/.test(s.name)), oJan = wbO.sheets.findIndex(s => /^Jan/.test(s.name))
  check(xJan >= 0 && JSON.stringify(wbRow(wbX, 0, xJan)) === JSON.stringify(wbRow(wbO, 0, oJan)), 'merged week headers read the same in ODS and XLSX')

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
  const fo = plan(await read('formulas.ods', ff['formulas.ods']), seeded)
  check(fo.purchases.length === 1 && fo.purchases[0].amount === 5 && fo.rows.some(r => r.warnings.some(w => w.includes('=1+2'))), 'ODS formula imports its stored value only; formula text is reported')

  // Lost values under merges (ODS): file-level warning in the review.
  const lostO = plan(wbO, seeded).lostValues
  check(lostO.cells === ODS_LOST_IN_DATA && lostO.sheets.join(',') === ODS_LOST_SHEETS.join(','), `ODS test file: ${lostO.cells} empty covered cells in the amount area, sheets ${lostO.sheets.join(', ')}`)
  for (const f of TEST_FILES.filter(f => !f.endsWith('.ods'))) check(plan(await read(f, readTestFile(f)), seeded).lostValues.cells === 0, `${f}: no lost-values warning`)
  const week = '<table:table-cell office:value-type="string" table:number-columns-spanned="2"><text:p>09/03 - 09/09</text:p></table:table-cell><table:covered-table-cell/>'
  const amount = (n: number) => `<table:table-cell office:value-type="float" office:value="${n}"/>`
  const head = odsRow(odsStr('September') + '<table:table-cell table:number-columns-repeated="3"/>' + week + week.replace('09/03 - 09/09', '09/10 - 09/16') + week.replace('09/03 - 09/09', 'Monthly'))
    + odsRow('<table:table-cell table:number-columns-repeated="4"/>' + odsStr('Est.') + odsStr('Act.') + odsStr('Est.') + odsStr('Act.') + odsStr('Est.') + odsStr('Act.'))
  // Clean: merges only in the header rows and the name columns.
  const clean = await read('clean.ods', ods(odsDoc(odsTable('Sep', head + odsRow(odsStr('Expenses') + '<table:table-cell/>') + odsRow('<table:table-cell/>'
    + '<table:table-cell office:value-type="string" table:number-columns-spanned="3"><text:p>Groceries</text:p></table:table-cell><table:covered-table-cell table:number-columns-repeated="2"/>'
    + '<table:table-cell/>' + amount(10) + '<table:table-cell/>' + amount(5) + '<table:table-cell/>' + amount(15))))))
  check(plan(clean, seeded).lostValues.cells === 0 && plan(clean, seeded).summary.total === 15, 'ODS with merges only in headers and names: no lost-values warning')
  const lossy = await read('lossy.ods', ods(odsDoc(odsTable('Sep', head + odsRow(odsStr('Expenses')) + odsRow('<table:table-cell/>' + odsStr('Groceries')
    + '<table:table-cell table:number-columns-repeated="2"/><table:covered-table-cell table:number-columns-repeated="2"/>' + '<table:table-cell/>' + amount(5) + '<table:table-cell/>' + amount(15))))))
  const lossyLost = plan(lossy, seeded).lostValues
  check(lossyLost.cells === 2 && lossyLost.sheets.join() === 'Sep', 'ODS with empty covered cells in the amount area: warns about 2 cells in Sep')
  check(lostValuesText(lostO.cells, lostO.sheets) === `This .ods file has ${ODS_LOST_IN_DATA} cells that look empty because of merged cells. Sheets: Jan, Feb, Mar and 9 more. LibreOffice can drop values under merges when it saves. Totals may be too low. Check the totals below, or save the file as .xlsx and import that.`
    && lostValuesText(1, ['Sep']).startsWith('This .ods file has 1 cell that looks empty because of merged cells. Sheet: Sep. ') && LOST_VALUES_TITLE === 'Some values may be missing', 'lost-values warning text')
  const fc = plan(await read('formula.csv', ff['formula.csv']), seeded)
  check(fc.purchases.every(x => typeof x.amount === 'number') && fc.rows.some(r => r.warnings.some(w => w.includes('+5'))), 'CSV formula text is skipped with a warning')

  // Typed-name abbreviations (v0.7 step 10): whole words, any case, rest of the name kept; a rename that shortens a full name keeps the edit.
  const names: [string, string | undefined, string][] = [
    ['Misc', undefined, 'Miscellaneous'], ['misc. stuff', undefined, 'Miscellaneous stuff'], ['Car Ins.', undefined, 'Car Insurance'],
    ['Home Mtg', undefined, 'Home Mortgage'], ['Util.', undefined, 'Utilities'], ['utils', undefined, 'Utilities'], ['Subs', undefined, 'Subscriptions'],
    ['Sub', undefined, 'Subscriptions'], ['Groc.', undefined, 'Groceries'], ['Med. bills', undefined, 'Medical bills'], ['Ent.', undefined, 'Entertainment'],
    ['Car Pmt', undefined, 'Car Payment'], ['Acct fee', undefined, 'Account fee'], ['Dept store', undefined, 'Department store'], ['Govt fees', undefined, 'Government fees'],
    ['Miscible', undefined, 'Miscible'], ['Subway', undefined, 'Subway'], ['Insurance', undefined, 'Insurance'], ['Ins', undefined, 'Ins'],
    ['Car Ins.', 'Car Insurance', 'Car Ins.'], ['Car Ins.', 'Car', 'Car Insurance'], ['Misc', 'Misc', 'Miscellaneous'], ['Misc Pmt', 'Miscellaneous Payment', 'Misc Pmt'],
    ['Misc Pmt', 'Miscellaneous', 'Misc Payment'],
  ]
  for (const [typed, prev, want] of names) {
    const got = expandName(typed, prev)
    check(got === want, `expandName("${typed}"${prev ? `, was "${prev}"` : ''}) = "${got}" (want "${want}")`)
  }
  check(importName("Car Pmt") === "Car Pmt", 'import names are not expanded ("Car Pmt" stays)')
  // Quarterly and Annual in every category (v0.7 step 11b): the list is the same everywhere and the estimate scales by frequency only.
  check(['quarter', 'annual'].every(f => FREQUENCIES.some(x => x.value === f)), 'every Recurrence list offers Quarterly and Annual')
  for (const [frequency, estimate] of [['quarter', 300], ['annual', 1200]] as const) {
    const groceries: Category = { id: 1, name: 'Groceries', color: '', parentId: 2, selected: true, estimate, frequency }
    const month = estimateFor(groceries, { from: '', to: '' })
    const week = estimateFor(groceries, { from: '', to: '', months: WEEK_MONTHS })
    const year = estimateFor(groceries, { from: '', to: '', months: 12 })
    check(Math.abs(month - 100) < 1e-9 && Math.abs(week - 1200 / 52) < 1e-9 && Math.abs(year - 1200) < 1e-9,
      `${frequency} ${estimate} on Groceries: ${month.toFixed(2)} a month, ${week.toFixed(2)} a week, ${year.toFixed(2)} a year`)
  }
  // Hostile and malformed files fail with a plain message.
  for (const [name, bytes] of Object.entries(badFiles())) {
    const t0 = performance.now()
    let msg = 'NO ERROR'
    try { plan(await read(name, bytes), seeded) } catch (e) { msg = e instanceof ImportError ? `Invalid: ${e.message}` : `OTHER ${String(e)}` }
    check(msg.startsWith('Invalid: '), `${name}: ${msg} (${Math.round(performance.now() - t0)} ms)`)
  }
  // Many cell notes on a tall sheet read in time proportional to their number (was rows × notes: 28 s for 40,000 notes).
  const notesAt = performance.now()
  const notesBook = await read('manynotes.xlsx', manyNotesXlsx(MANY_NOTES_ROWS, MANY_NOTES))
  const notesMs = Math.round(performance.now() - notesAt)
  check(notesBook.sheets[0].rows.length === MANY_NOTES_ROWS && notesMs < MANY_NOTES_MAX_MS, `${MANY_NOTES} notes on ${MANY_NOTES_ROWS} rows read in ${notesMs} ms (limit ${MANY_NOTES_MAX_MS} ms)`)
  return { totals: Object.fromEntries(totals) }
}
