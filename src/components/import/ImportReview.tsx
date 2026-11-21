import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { applyImport, ImportError, money, monthName, previewImport, type ImportOptions, type PlanRow, type Snapshot, type Workbook } from '../../import'
import { dateBounds } from '../../budget/validate'
import { Banner, Button, Dialog, Toggle } from '../ui'
import { PlaceField } from './PlaceField'
import { announce } from '../ui/announcer'
import { amountRows, choiceValue, placeGroups, toChoice } from './choices'
import { ImportRows } from './ImportRows'
import { LOST_VALUES_TITLE, lostValuesText, plural } from './text'

/** What the review returns when the import was written. */
export interface ImportDone { purchases: number; categories: number; undated: number }

const KIND: Record<string, string> = { month: 'Month sheet', week: 'Week sheet', day: 'Day sheet', annual: 'Annual sheet (Jan to Dec)', skipped: 'Not a budget sheet, so it is skipped' }
const MAX_WARNINGS = 10
const DUPLICATE_NOTE = /already has \d+ purchases? in these dates\.$/

type Targets = NonNullable<ImportOptions['targets']>
type Source = 'month' | 'annual'
type Kept = 'import' | 'existing'

/** Review dialog (0013 §9, plan step 14): sheets, year, month choices, rows that need a place, then every row's target. Nothing is written until Import. */
export function ImportReview({ fileName, workbook, snapshot, onCancel, onDone, onFail }: {
  fileName: string
  workbook: Workbook
  snapshot: Snapshot
  onCancel: () => void
  onDone: (done: ImportDone) => void
  /** The write failed; nothing was saved. */
  onFail: (message: string) => void
}) {
  const [options, setOptions] = useState<ImportOptions>({})
  const [yearText, setYearText] = useState<string | null>(null)
  const [yearError, setYearError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [moreChecks, setMoreChecks] = useState(false)
  const [openSheets, setOpenSheets] = useState<Set<number> | null>(null) // null: only the first sheet is open
  const [placeErrors, setPlaceErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const pending = useRef('')
  const lostSaid = useRef(false)
  const [tick, setTick] = useState(0)
  const placeRefs = useRef(new Map<string, HTMLElement>())

  const plan = useMemo(() => previewImport(workbook, snapshot, options), [workbook, snapshot, options])
  const existing = useMemo(() => amountRows(snapshot.categories), [snapshot.categories])
  const placeOptions = useMemo(() => placeGroups(snapshot.categories), [snapshot.categories])
  const targets: Targets = options.targets ?? {}
  const excluded = new Set(options.excludedSheets ?? [])
  const placeRows = plan.rows.filter(r => r.needsPlace)
  const { purchases, total, newCategories, undated } = plan.summary
  const unplaced = plan.unplaced.length
  // File-level (ODS): the same for every choice in the review.
  const lostText = plan.lostValues.cells ? lostValuesText(plan.lostValues.cells, plan.lostValues.sheets) : ''
  const blocked = unplaced > 0 || !!yearError || purchases === 0

  // ----- summary and its polite announcement -----
  const summaryTitle = unplaced ? `${plural(unplaced, 'row')} ${unplaced === 1 ? 'needs' : 'need'} a place` : purchases === 0 ? 'Nothing to import' : 'Ready to import'
  const summaryLine = unplaced
    ? `${summaryTitle}.`
    : purchases === 0 ? `${summaryTitle}.` : `${summaryTitle}. ${plural(purchases, 'purchase')}, ${money(total)}, ${plural(newCategories, 'new row')}.`
  useEffect(() => {
    // The lost-values warning goes out once, with the first summary, so neither replaces the other in the one live region.
    const lost = lostText && !lostSaid.current ? `${LOST_VALUES_TITLE}. ${lostText}` : ''
    lostSaid.current = true
    announce(`${lost} ${pending.current} ${summaryLine}`.trim())
    pending.current = ''
  }, [summaryLine, tick, lostText])

  const change = (patch: Partial<ImportOptions>, said = '') => {
    pending.current = said
    setOptions(o => ({ ...o, ...patch }))
    setTick(t => t + 1)
  }

  // ----- sheets and year -----
  function toggleSheet(index: number, on: boolean) {
    change({ excludedSheets: on ? (options.excludedSheets ?? []).filter(i => i !== index) : [...(options.excludedSheets ?? []), index] })
  }
  const bounds = dateBounds(snapshot.today)
  function typeYear(text: string) {
    setYearText(text)
    const n = Number(text)
    const min = Number(bounds.min.slice(0, 4)), max = Number(bounds.max.slice(0, 4))
    if (/^\d{4}$/.test(text.trim()) && n >= min && n <= max) { setYearError(''); change({ year: n }) }
    else { const e = `Invalid: Year use a four-digit year from ${min} to ${max}`; setYearError(e); announce(e) }
  }

  // ----- month choices (toggles) -----
  const source = (m: number): Source => plan.conflicts.find(c => c.month === m)?.source ?? 'month'
  const kept = (m: number): Kept => plan.annualExisting.find(c => c.month === m)?.choice ?? 'existing'
  const allSame = <T,>(vals: T[]): T | null => (vals.length && vals.every(v => v === vals[0]) ? vals[0] : null)
  const setSources = (months: number[], v: Source, said?: string) =>
    change({ monthSource: { ...options.monthSource, ...Object.fromEntries(months.map(m => [m, v])) } }, said)
  const setKept = (months: number[], v: Kept, said?: string) =>
    change({ annualExisting: { ...options.annualExisting, ...Object.fromEntries(months.map(m => [m, v])) } }, said)
  const conflictMonths = plan.conflicts.map(c => c.month)
  const existingMonths = plan.annualExisting.map(c => c.month)
  const sourceLabel = { month: 'Month', annual: 'Annual' } as const
  const keptLabel = { import: 'Annual', existing: 'Existing' } as const

  /** Existing purchases in a month of the chosen year, for the hint. */
  function existingHint(m: number) {
    const from = `${plan.year}-${String(m).padStart(2, '0')}-01`, to = `${plan.year}-${String(m).padStart(2, '0')}-31`
    const mine = snapshot.purchases.filter(p => p.date >= from && p.date <= to)
    return `The app already has ${plural(mine.length, 'purchase')} (${money(mine.reduce((t, p) => t + Math.round((p.amount ?? 0) * 100), 0) / 100)}).`
  }

  // ----- rows -----
  const setTarget = (key: string, value: string | null) => {
    const next = { ...targets }
    const c = toChoice(value)
    if (c && c !== 'auto') next[key] = c; else delete next[key]
    if (JSON.stringify(next) !== JSON.stringify(targets)) change({ targets: next }) // typing in the picker must not re-announce the summary
  }
  const duplicateRows = plan.rows.filter(r => r.duplicates)
  const sheetRows = (i: number) => plan.rows.filter(r => r.sheetIndex === i)
  const checks = [
    ...plan.warnings,
    ...plan.rows.filter(r => r.target || r.skipped).flatMap((r: PlanRow) => r.warnings.filter(w => !DUPLICATE_NOTE.test(w)).map(w => `${r.sheet}, ${r.name}: ${w}`)),
  ]

  async function doImport() {
    if (busy) return
    if (blocked) {
      if (unplaced) {
        setPlaceErrors(true)
        placeRefs.current.get(plan.unplaced[0])?.focus()
      } else if (yearError) document.getElementById('import-year')?.focus()
      announce(unplaced ? summaryLine : yearError || summaryLine)
      return
    }
    setBusy(true)
    try {
      const r = await applyImport(plan)
      onDone({ purchases: r.purchases, categories: r.categories, undated })
    } catch (e) {
      onFail(e instanceof ImportError ? `Error: ${e.message}` : 'Error: The import couldn’t be saved. Your existing data was not changed.')
    }
  }

  const firstOpen = plan.sheets.find(s => s.included && s.kind !== 'skipped')?.index
  const openNow = openSheets ?? new Set(firstOpen == null ? [] : [firstOpen])
  const setSheetOpen = (i: number, on: boolean) => setOpenSheets(() => { const next = new Set(openNow); if (on) next.add(i); else next.delete(i); return next })

  return createPortal(
    <Dialog id="import-review" title="Review import" onClose={onCancel} className="review" describedBy="review-file" footerClassName="review-footer"
      buttons={<>
        <Button type="button" className="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="button" aria-disabled={blocked || undefined} aria-describedby="review-summary" onClick={doImport}>Import</Button>
      </>}>
      <p id="review-file" className="review-file">{fileName} ({workbook.format.toUpperCase()}, {plural(workbook.sheets.length, 'sheet')}). Nothing is saved until you choose Import.</p>
      {lostText && <Banner kind="warn" title={LOST_VALUES_TITLE}><p>{lostText}</p></Banner>}
      <Banner id="review-summary" kind={unplaced || purchases === 0 ? 'warn' : 'info'} title={summaryTitle}>
        {unplaced
          ? <p>Choose where {unplaced === 1 ? `“${plan.rows.find(r => r.key === plan.unplaced[0])?.name}”` : 'each of them'} goes, or skip {unplaced === 1 ? 'it' : 'them'}. You can’t import until every row has an answer.</p>
          : purchases === 0
            ? <p>The sheets and choices so far have no purchases to add.</p>
            : <p>This will add <strong>{plural(purchases, 'purchase')}</strong> totalling <strong>{money(total)}</strong> and <strong>{plural(newCategories, 'new row')}</strong>.{undated > 0 && ` ${undated === purchases ? `All ${undated} have` : `${undated} have`} no date in the file, so they are placed on the first day of their week or month and marked in the Day table.`}</p>}
      </Banner>
      {checks.length > 0 && (
        <Banner kind="warn" title={`${plural(checks.length, 'thing')} to check`}>
          <ul>{checks.slice(0, MAX_WARNINGS).map(w => <li key={w}>{w}</li>)}</ul>
          {checks.length > MAX_WARNINGS && (
            <>
              <ul id="warnings-more" hidden={!moreChecks}>{checks.slice(MAX_WARNINGS).map(w => <li key={w}>{w}</li>)}</ul>
              {/* The label changes with the state, so there is no aria-expanded. */}
              <div className="actions">
                <Button type="button" className="secondary small" aria-controls="warnings-more" aria-label={`${moreChecks ? 'Hide' : 'Show'} warnings ${MAX_WARNINGS + 1} - ${checks.length}`}
                  onClick={() => setMoreChecks(m => !m)}>{moreChecks ? 'Hide' : 'Show'} warnings {MAX_WARNINGS + 1} - {checks.length}</Button>
              </div>
            </>
          )}
        </Banner>
      )}

      <section className="field" aria-labelledby="sheets-h">
        <h3 id="sheets-h" className="label">Sheets to import</h3>
        <p className="help">Untick a sheet to leave it out.</p>
        <ul className="sheet-list">
          {plan.sheets.map(s => (
            <li key={s.index} className={s.kind === 'skipped' ? 'skipped' : undefined}>
              <label className="check">
                <input type="checkbox" checked={s.kind !== 'skipped' && !excluded.has(s.index)} disabled={s.kind === 'skipped'} onChange={e => toggleSheet(s.index, e.target.checked)} />
                <span>{s.name.trim() || 'Sheet'}<span className="sheet-kind">{KIND[s.kind]}</span></span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {plan.needsYear && (
        <section className="field narrow-field">
          <div className="field">
            <label htmlFor="import-year" className="label">Year<span aria-hidden="true"> *</span></label>
            <p id="year-help" className="help">The month and annual sheets have no year.</p>
            <input id="import-year" className="input" inputMode="numeric" value={yearText ?? String(plan.year)} aria-required="true"
              aria-invalid={yearError ? true : undefined} aria-describedby={yearError ? 'year-help year-error' : 'year-help'} onChange={e => typeYear(e.target.value)} />
            {yearError && <p id="year-error" className="error">{yearError}</p>}
          </div>
        </section>
      )}

      {conflictMonths.length > 0 && (
        <section className="field" aria-labelledby="months-h">
          <h3 id="months-h" className="label">Months in both a month sheet and the Annual sheet ({conflictMonths.length})</h3>
          <p className="help">Both sheets hold the same amounts, so using both would count the month twice. Choose the sheet to use for each month{conflictMonths.length > 1 ? ', or all of them at once' : ''}.</p>
          {conflictMonths.length > 1 && (
            <div className="bulk"><Toggle name={`All ${conflictMonths.length} months should use`} suffix="data" options={[{ value: 'month', label: 'Month' }, { value: 'annual', label: 'Annual' }]}
              value={allSame(conflictMonths.map(source))} onChange={v => setSources(conflictMonths, v, `All ${conflictMonths.length} months use ${sourceLabel[v]} data.`)} /></div>
          )}
          <div className="toggle-list">
            {conflictMonths.map(m => <Toggle key={m} card name={monthName(m)} options={[{ value: 'month', label: 'Month' }, { value: 'annual', label: 'Annual' }]} value={source(m)} onChange={v => setSources([m], v)} />)}
          </div>
        </section>
      )}

      {existingMonths.length > 0 && (
        <section className="field" aria-labelledby="existing-h">
          <h3 id="existing-h" className="label">Months that already have data ({existingMonths.length})</h3>
          <p className="help">This file has no month sheets, so each month comes from the Annual sheet as one purchase per row, dated the 1st of the month. These months already have data in the app. Choose the data to use for each month{existingMonths.length > 1 ? ', or all of them at once' : ''}. “Existing” means the data already in the app.</p>
          {existingMonths.length > 1 && (
            <div className="bulk"><Toggle name={`All ${existingMonths.length} months should use`} suffix="data" options={[{ value: 'import', label: 'Annual' }, { value: 'existing', label: 'Existing' }]}
              value={allSame(existingMonths.map(kept))} onChange={v => setKept(existingMonths, v, `All ${existingMonths.length} months use ${keptLabel[v]} data.`)} /></div>
          )}
          <div className="toggle-list">
            {existingMonths.map(m => <Toggle key={m} card name={monthName(m)} hint={existingHint(m)} options={[{ value: 'import', label: 'Annual' }, { value: 'existing', label: 'Existing' }]} value={kept(m)} onChange={v => setKept([m], v)} />)}
          </div>
        </section>
      )}

      {placeRows.length > 0 && (
        <section className="field" aria-labelledby="place-h">
          <h3 id="place-h" className="label">Rows that need a place ({placeRows.length}{unplaced === 0 ? ', answered' : ''})</h3>
          <p className="help">The app has no row with {placeRows.length === 1 ? 'this name' : 'these names'}. Choose where the amounts go.</p>
          {placeRows.map(r => {
            const id = `place-${r.key.replace(/[^\w-]/g, '_')}`
            const missing = placeErrors && plan.unplaced.includes(r.key)
            return (
              <fieldset key={r.key} className="place-card">
                <legend>{r.name}</legend>
                <p className="help">{r.sheet.trim()} sheet, row {r.row}.{r.purchases > 0 && ` ${plural(r.purchases, 'purchase')} totalling ${money(r.total)}.`}</p>
                <div className="field">
                  <label htmlFor={id} className="label">Where should {r.name} go?<span aria-hidden="true"> *</span></label>
                  <p id={`${id}-help`} className="help">Type to search the rows, or press the Down arrow to see all the choices.</p>
                  <div ref={el => { if (el) { const input = el.querySelector('input'); if (input) placeRefs.current.set(r.key, input) } }}>
                    <PlaceField id={id} label={`Where should ${r.name} go?`} groups={placeOptions} value={choiceValue(targets[r.key]) === 'auto' ? null : choiceValue(targets[r.key])}
                      onChange={v => setTarget(r.key, v)} invalid={missing} describedBy={missing ? `${id}-help ${id}-error` : `${id}-help`} />
                  </div>
                  {missing && <p id={`${id}-error`} className="error">Error: Where {r.name} goes cannot be empty. Choose a place, or choose Do not import it.</p>}
                </div>
              </fieldset>
            )
          })}
        </section>
      )}

      {duplicateRows.length > 0 && (
        <section className="field" aria-labelledby="dup-h">
          <h3 id="dup-h" className="label">Already in the app</h3>
          <p id="dup-help" className="help">{plural(duplicateRows.length, 'row')} already {duplicateRows.length === 1 ? 'has' : 'have'} purchases in the same dates as this file. Importing {duplicateRows.length === 1 ? 'it' : 'them'} again would count {duplicateRows.length === 1 ? 'it' : 'them'} twice.</p>
          <label className="check"><input type="checkbox" checked={!!options.skipDuplicates} aria-describedby="dup-help" onChange={e => change({ skipDuplicates: e.target.checked })} />
            <span>Skip those items ({plural(duplicateRows.length, 'row')})</span></label>
        </section>
      )}

      <section className="field" aria-labelledby="rows-h">
        <h3 id="rows-h" className="label">Rows and where they go</h3>
        <p className="help">Each row shows where its amounts will go. Change “Goes to” to send a row somewhere else, to Miscellaneous, or to skip it.</p>
        <div>
          {plan.sheets.filter(s => s.kind !== 'skipped' && !excluded.has(s.index)).map(s => {
            const rows = sheetRows(s.index)
            const count = rows.reduce((n, r) => n + r.purchases, 0)
            const sum = rows.reduce((t, r) => t + Math.round(r.total * 100), 0) / 100
            const used = s.included
            const isOpen = used && openNow.has(s.index)
            return (
              <details key={s.index} className="sheet-block" open={isOpen} onToggle={e => { if (used && e.currentTarget.open !== isOpen) setSheetOpen(s.index, e.currentTarget.open) }}>
                <summary><span>{s.name.trim() || 'Sheet'}</span>{' '}<span className="sheet-count">{used ? `${plural(count, 'purchase')} · ${money(sum)}` : 'Not used: every month comes from its month sheet'}</span></summary>
                {isOpen && <ImportRows sheetName={s.name.trim()} rows={rows} targets={targets} existing={existing} showAll={showAll} onTarget={(k, v) => setTarget(k, v)} />}
                {isOpen && <p className="help table-foot">Rows with nothing to import are {showAll ? 'shown' : 'hidden'}. Totals such as Savings, Charity and Net Income are not imported. <button type="button" className="link-button" onClick={() => setShowAll(a => !a)}>{showAll ? 'Hide them' : 'Show them'}</button></p>}
              </details>
            )
          })}
        </div>
      </section>

      {plan.ignoredColumns.length > 0 && (
        <section className="field" aria-labelledby="ignored-h">
          <h3 id="ignored-h" className="label">Columns that are not imported</h3>
          <ul className="import-help">
            {plan.ignoredColumns.map(c => <li key={`${c.sheet}-${c.column}`}>{c.header || `Column ${c.column}`} ({c.sheet.trim()}, column {c.column})</li>)}
          </ul>
        </section>
      )}
    </Dialog>,
    document.body,
  )
}
