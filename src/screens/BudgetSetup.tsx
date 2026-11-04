import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AmountField, Button, ErrorSummary, focusFirstError, type FieldError } from '../components/ui'
import { Expander } from '../components/ui/Expander'
import { BudgetTable } from '../components/BudgetTable'
import { useAnnounce } from '../components/ui/announcer'
import { fireReward } from '../rewards/rewards'
import { requestNotifications } from '../notifications'
import { saveSetup } from '../storage/repository'
import { cleanName, dateBounds, moneyError, NAME_MAX, parseAmount, slug } from '../budget/validate'
import type { BudgetItem, Category, DefaultRange, DueDay, Frequency, MonthBoundary } from '../storage/db'
import {
  buildTree, ancestors, dayChoices, domId, estimateTotal, flatten, formatAmount, frequenciesFor, isTotal, repeatedNames, scheduleClears,
  scheduleKind, spokenName, subtree, WEEKDAYS, type Calendar, type Cat, type CatNode,
} from '../budget/tree'
import * as edit from '../budget/setupEdits'

const RANGES: { value: DefaultRange; label: string }[] = [
  { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' },
]
const DAYS = WEEKDAYS
const BOUNDARIES: { value: MonthBoundary; label: string }[] = [
  { value: 'weeks', label: 'Whole weeks (each month starts and ends on a full week)' },
  { value: 'calendar', label: 'Calendar month (the 1st to the last day)' },
]
const MONTH = { label: '', from: '', to: '', days: 30.44 }

/** Budget setup overlay (0007 §5). Edits a working copy; Save stores it and closes, Cancel drops it. */
export function BudgetSetup({ cats, items, defaultRange, calendar, rewardsEnabled, notificationsEnabled, onClose, onSaved }: {
  cats: Category[]
  rewardsEnabled: boolean
  notificationsEnabled: boolean
  items: BudgetItem[]
  defaultRange: DefaultRange
  calendar: Calendar
  onClose: () => void
  onSaved: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  // The setup table ends 24px above the sticky footer: expose the footer's height to CSS.
  useEffect(() => {
    const f = footerRef.current, d = ref.current
    if (!f || !d) return
    const ro = new ResizeObserver(() => d.style.setProperty('--footer-h', `${f.offsetHeight}px`))
    ro.observe(f)
    return () => ro.disconnect()
  }, [])
  const bannerRef = useRef<HTMLDivElement>(null)
  const [original] = useState(() => cats.filter((c): c is Cat => typeof c.id === 'number'))
  const [work, setWork] = useState<Cat[]>(original)
  /** Estimate text as typed, by row id; rows not typed in show their stored estimate. */
  const [est, setEst] = useState<Record<number, string>>({})
  const [range, setRange] = useState(defaultRange)
  const [weekStart, setWeekStart] = useState(calendar.weekStart)
  const [boundary, setBoundary] = useState(calendar.monthBoundary)
  const [rewards, setRewards] = useState(rewardsEnabled)
  const [notify, setNotify] = useState(notificationsEnabled)
  const [notifyMsg, setNotifyMsg] = useState('')
  const [create, setCreate] = useState<Record<number, { name: string; parent: number }>>({})
  /** Expanded rows; categories start open, subcategories collapsed (0007 §10). */
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(original.filter(c => c.parentId == null).map(c => c.id)))
  const expand = (id: number) => setExpanded(x => new Set(x).add(id))
  const toggleRow = (id: number) => setExpanded(x => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  useAnnounce(status)
  useAnnounce(notifyMsg)
  useAnnounce(saveError)
  const [bounds] = useState(() => dateBounds(new Date()))
  /** Add tooltip dismissed with Escape until the pointer or focus leaves it (WCAG 1.4.13, v0.4 review). */
  const [tipOff, setTipOff] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const shown = [...document.querySelectorAll<HTMLElement>('.tip-wrap')].find(w => w.querySelector('.tooltip') && (w.matches(':hover') || w.matches(':focus-within')))
      if (!shown || shown.dataset.tip === tipOff) return
      // Only hide the tooltip: don't also close the dialog or leave the cell.
      e.preventDefault(); e.stopPropagation()
      setTipOff(shown.dataset.tip ?? null)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [tipOff])
  const focusAfter = useRef<string | null>(null)
  const setFocusId = (id: string) => { focusAfter.current = id }

  // Mounted only while open (see App): open modal, focus its heading, return focus to the opener on unmount.
  // The opener is read on first render: in StrictMode the effect runs twice,
  // and by the second run focus is already inside the dialog.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    headingRef.current?.focus()
    return () => opener?.focus()
  }, [opener])

  // Re-focus a control after its row moved in the table.
  useEffect(() => {
    if (!focusAfter.current) return
    document.getElementById(focusAfter.current)?.focus()
    focusAfter.current = null
  })

  const roots = useMemo(() => buildTree(work), [work])
  const repeated = useMemo(() => repeatedNames(roots), [roots])
  const say = (n: CatNode) => spokenName(n, repeated)
  const estText = (c: Cat) => est[c.id] ?? (c.estimate != null ? String(c.estimate) : '')

  /** Store a row's typed estimate in the working copy (before it can move, §2.1). */
  function flush(cs: Cat[], id: number): Cat[] {
    if (!(id in est)) return cs
    const r = parseAmount(est[id], { allowNegative: false })
    if (!r.ok && r.reason !== 'empty') return cs
    setEst(e => { const rest = { ...e }; delete rest[id]; return rest })
    return edit.patch(cs, id, { estimate: r.ok ? r.value : undefined })
  }

  const leaves = (n: CatNode) => subtree(n).filter(x => !x.children.length)
  const isChecked = (n: CatNode) => leaves(n).every(x => x.cat.selected)
  const isMixed = (n: CatNode) => !isChecked(n) && leaves(n).some(x => x.cat.selected)

  function addRow(root: CatNode) {
    const key = `create-${slug(root.cat.name)}`
    const c = create[root.cat.id] ?? { name: '', parent: root.cat.id }
    const name = cleanName(c.name)
    if (!name) return
    const parent = flatten([root]).find(n => n.cat.id === c.parent) ?? root
    if (edit.nameTaken(work, parent.cat.id, name)) {
      setErrors(e => ({ ...e, [key]: `Invalid: Create in ${root.cat.name} “${name}” already exists in ${parent.cat.name}` }))
      return
    }
    const r = edit.create(flush(work, parent.cat.id), name, parent.cat.id)
    setWork(r.cats)
    expand(parent.cat.id)
    setCreate(x => ({ ...x, [root.cat.id]: { name: '', parent: c.parent } }))
    setErrors(e => { const rest = { ...e }; delete rest[key]; return rest })
    setStatus(r.movedFrom
      ? `Added ${name}. Your ${r.movedFrom} estimate moved to ${r.movedFrom} › Miscellaneous. ${r.movedFrom} now totals its items.`
      : `Added ${name} to ${parent.cat.name}.`)
  }

  function moveRow(n: CatNode, delta: -1 | 1) {
    const sibs = n.parent?.children ?? roots
    const i = sibs.indexOf(n)
    if (i + delta < 0 || i + delta >= sibs.length) return
    setWork(edit.move(work, n.cat.id, delta))
    setStatus(`Moved ${say(n)} ${delta < 0 ? 'up' : 'down'}.`)
    setFocusId(domId(delta < 0 ? 'move_up' : 'move_down', n))
  }

  async function save() {
    setSaveError('')
    const errs: Record<string, string> = {}
    let final = work
    for (const n of flatten(roots)) {
      if (isTotal(n)) { final = edit.patch(final, n.cat.id, { estimate: undefined, frequency: undefined, autopay: undefined, dueDate: undefined, dueWeekday: undefined, dueDay: undefined, dueDay2: undefined }); continue }
      const due = n.cat.dueDate
      if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < bounds.min || due > bounds.max)) {
        errs[domId('due_date', n)] = `Invalid: ${dateLabel(n)} for ${say(n)} use a date from ${bounds.min} to ${bounds.max}`
      }
      const text = estText(n.cat).trim()
      if (text === '') { final = edit.patch(final, n.cat.id, { estimate: undefined }); continue }
      const r = parseAmount(text, { allowNegative: false })
      if (r.ok) final = edit.patch(final, n.cat.id, { estimate: r.value })
      else errs[domId('estimate', n)] = moneyError(`Estimated spending for ${say(n)}`, r, '40, 40+5.25 or 1,200.00')
    }
    setErrors(errs)
    const list: FieldError[] = Object.entries(errs).map(([fieldId, message]) => ({ fieldId, message }))
    if (list.length) { requestAnimationFrame(() => focusFirstError(list, bannerRef.current)); return }
    setSaving(true)
    try {
      await saveSetup(final, original, { defaultRange: range, weekStart, monthBoundary: boundary, rewardsEnabled: rewards, notificationsEnabled: notify })
    } catch {
      setSaving(false)
      setSaveError('Error: Your budget setup wasn’t saved, and nothing was changed. Check that your device has free storage space, then try again.')
      return
    }
    onSaved()
  }

  // Preview reflects typed estimates that are already valid.
  const previewRoots = useMemo(() => buildTree(work.map(c => {
    if (!(c.id in est)) return c
    const r = parseAmount(est[c.id], { allowNegative: false })
    return r.ok ? { ...c, estimate: r.value } : r.reason === 'empty' ? { ...c, estimate: undefined } : c
  })), [work, est])

  const rows: ReactNode[] = []
  const addRows = (n: CatNode) => {
    if (n.cat.name === 'Net Income') return
    rows.push(setupRow(n))
    if (!expanded.has(n.cat.id)) return
    n.children.forEach(addRows)
    // Every category gets a Create row, Taxes included (0007 §10).
    if (!n.parent) rows.push(createRow(n))
  }
  roots.forEach(addRows)

  function setupRow(n: CatNode) {
    const total = isTotal(n)
    const nameId = domId('name', n)
    const estId = domId('estimate', n)
    const sibs = n.parent?.children ?? roots
    const i = sibs.indexOf(n)
    const label = n.cat.name
    // Categories always expand (they hold a Create row), Taxes included (v0.4 step 10).
    const expandable = n.children.length > 0 || !n.parent
    return (
      <tr key={n.cat.id} className={`row depth-${n.depth}${expandable ? ' group' : ''}`}
        data-id={n.cat.id} aria-level={n.depth + 1} aria-expanded={expandable ? expanded.has(n.cat.id) : undefined}>
        <th scope="row" id={nameId} className={`name clr-${n.cat.color}`}>
          <span className="name-line">
            {(n.parent || !n.cat.computed) && (
              <label className="hit">
                <input type="checkbox" className="checkbox" id={domId('select', n)}
                  aria-label={n.children.length ? `Select all ${say(n)} items` : `Select ${say(n)}`}
                  checked={isChecked(n)} ref={el => { if (el) el.indeterminate = isMixed(n) }}
                  onChange={e => setWork(edit.setSelected(work, n.cat.id, e.target.checked))} />
              </label>
            )}
            {expandable
              ? <Expander open={expanded.has(n.cat.id)} onToggle={() => toggleRow(n.cat.id)} id={domId('expand', n)}>{label}</Expander>
              : <span>{label}</span>}
          </span>
        </th>
        <td>
          {total
            ? n.parent && <span>{formatAmount(estimateTotal(n, MONTH)) || '0.00'} <span className="help">per month</span></span>
            : <>
              <AmountField id={estId} className="amount" allowNegative={false} value={estText(n.cat)}
                aria-labelledby="setup-est-col" aria-describedby={errors[estId] ? `${nameId} ${estId}-error_msg` : nameId}
                aria-invalid={!!errors[estId] || undefined}
                onChange={e => setEst(x => ({ ...x, [n.cat.id]: e.target.value }))} />
              {errors[estId] && <p id={`${estId}-error_msg`} className="error">{errors[estId]}</p>}
            </>}
        </td>
        <td>
          {!total && (
            <span className="pre">
              <span aria-hidden="true">per</span>
              <select className="input" id={domId('recurrence', n)} aria-label={`Recurrence for ${say(n)}`}
                value={n.cat.frequency ?? 'month'}
                onChange={e => setWork(edit.patch(work, n.cat.id, { frequency: e.target.value as Frequency, ...scheduleClears(n.cat, e.target.value as Frequency) }))}>
                {frequenciesFor(n).map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </span>
          )}
        </td>
        <td>
          {!total && (
<label className="hit">
            <input type="checkbox" className="checkbox" id={domId('autopay', n)} aria-label={`Autopay for ${say(n)}`}
              checked={!!n.cat.autopay} onChange={e => setWork(edit.patch(work, n.cat.id, { autopay: e.target.checked }))} />
            </label>
          )}
        </td>
        <td>{!total && scheduleCell(n)}</td>
        <td>
          {n.parent && (
            <span className="reorder">
              <Button type="button" className="secondary small" id={domId('move_up', n)} aria-label={`Move ${say(n)} up`}
                aria-disabled={i === 0 || undefined} onClick={() => moveRow(n, -1)}><span aria-hidden="true">↑</span></Button>
              <Button type="button" className="secondary small" id={domId('move_down', n)} aria-label={`Move ${say(n)} down`}
                aria-disabled={i === sibs.length - 1 || undefined} onClick={() => moveRow(n, 1)}><span aria-hidden="true">↓</span></Button>
            </span>
          )}
        </td>
      </tr>
    )
  }

  /** "Next pay date" for Income, "Next due date" for Savings and Expenses (0008 §3.2). */
  function dateLabel(n: CatNode) { return `Next ${(ancestors(n)[0] ?? n).cat.name === 'Income' ? 'pay' : 'due'} date` }

  /** Schedule column: the control for the row's recurrence (0008 §3.2). */
  function scheduleCell(n: CatNode) {
    const kind = scheduleKind(n.cat.frequency ?? 'month')
    if (kind === 'none') return null
    const set = (p: Partial<Cat>) => setWork(edit.patch(work, n.cat.id, p))
    const word = (ancestors(n)[0] ?? n).cat.name === 'Income' ? 'Pay' : 'Due'
    const dayOpt = (d: DueDay) => <option key={d} value={String(d)}>{d === 'last' ? 'Last' : d}</option>
    const toDay = (v: string): DueDay | undefined => v === '' ? undefined : v === 'last' ? 'last' : Number(v)
    const field = (label: string, control: ReactNode) => (
      <span className="sched-field"><span className="sched-label" aria-hidden="true">{label}</span>{control}</span>
    )
    const daySelect = (key: 'dueDay' | 'dueDay2', label: string, choices: DueDay[]) => {
      const id = domId(key === 'dueDay' ? 'due_day' : 'due_day2', n)
      return field(label,
        <select className="input" id={id} aria-label={`${label} for ${say(n)}`} value={String(n.cat[key] ?? '')}
          onChange={e => set({ [key]: toDay(e.target.value) })}>
          <option value="">Not set</option>
          {choices.map(dayOpt)}
        </select>)
    }
    if (kind === 'weekday') {
      const id = domId('due_weekday', n)
      return field(`${word} day of week`,
        <select className="input" id={id} aria-label={`${word} day of week for ${say(n)}`} value={n.cat.dueWeekday ?? ''}
          onChange={e => set({ dueWeekday: e.target.value === '' ? undefined : Number(e.target.value) })}>
          <option value="">Not set</option>
          {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>)
    }
    if (kind === 'day') return daySelect('dueDay', `${word} day of month`, dayChoices(1, 27, true))
    if (kind === 'two-days') {
      return (
        <span className="sched-pair">
          {daySelect('dueDay', '1st payment', dayChoices(1, 15, false))}
          {daySelect('dueDay2', '2nd payment', dayChoices(16, 27, true))}
        </span>
      )
    }
    const dueId = domId('due_date', n)
    return field(dateLabel(n), <>
      <input type="date" className="input" id={dueId} min={bounds.min} max={bounds.max} value={n.cat.dueDate ?? ''}
        aria-label={`${dateLabel(n)} for ${say(n)}`} aria-invalid={!!errors[dueId] || undefined}
        aria-describedby={errors[dueId] ? `${dueId}-error_msg` : undefined}
        onChange={e => set({ dueDate: e.target.value || undefined })} />
      {errors[dueId] && <p id={`${dueId}-error_msg`} className="error">{errors[dueId]}</p>}
    </>)
  }

  function createRow(root: CatNode) {
    const base = `create-${slug(root.cat.name)}`
    const c = create[root.cat.id] ?? { name: '', parent: root.cat.id }
    const err = errors[base]
    const empty = !c.name.trim()
    const set = (p: Partial<typeof c>) => setCreate(x => ({ ...x, [root.cat.id]: { ...c, ...p } }))
    return (
      <tr key={`create-${root.cat.id}`} className={`row create depth-1 clr-${root.cat.color}`} aria-level={2}>
        <td colSpan={6}>
          <div className="create-row">
            <div className="create-field">
              <label className="label" htmlFor={base}>Create in {root.cat.name}</label>
              <input id={base} className="input" maxLength={NAME_MAX} value={c.name}
                aria-invalid={!!err || undefined} aria-describedby={err ? `${base}-error_msg` : undefined}
                onChange={e => set({ name: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRow(root) } }} />
            </div>
            <div className="create-field">
              <label className="label" htmlFor={`${base}-parent`}>Add to</label>
              <select id={`${base}-parent`} className="input" value={c.parent} onChange={e => set({ parent: Number(e.target.value) })}>
                {[root, ...root.children].map(t => <option key={t.cat.id} value={t.cat.id}>{t.cat.name}</option>)}
              </select>
            </div>
            {/* While disabled, Add shows and is described by a tooltip on hover or focus (v0.4 step 10). */}
            <span className={`tip-wrap${tipOff === base ? ' tip-off' : ''}`} data-tip={base}
              onMouseLeave={() => setTipOff(t => t === base ? null : t)} onBlur={() => setTipOff(t => t === base ? null : t)}>
              <Button type="button" className="secondary" id={`${base}-add`} aria-disabled={empty || undefined}
                aria-describedby={empty ? `${base}-tooltip` : base} onClick={() => addRow(root)}>Add</Button>
              {empty && <span id={`${base}-tooltip`} role="tooltip" className="tooltip">First enter a value in ‘Create in {root.cat.name}’</span>}
            </span>
            {err && <p id={`${base}-error_msg`} className="error">{err}</p>}
          </div>
        </td>
      </tr>
    )
  }

  const errorList = Object.entries(errors).filter(([k]) => k.startsWith('estimate-') || k.startsWith('due_date-')).map(([fieldId, message]) => ({ fieldId, message }))

  return (
    <dialog ref={ref} className="dialog setup" aria-labelledby="setup-heading" onClose={onClose}>
      <div className="dialog-body">
        <h2 id="setup-heading" ref={headingRef} tabIndex={-1} className="section-title">Budget setup</h2>
        <ErrorSummary ref={bannerRef} errors={errorList} />
        <p id="setup-help" className="help">If you’d like to skip ahead just select “Save” at the bottom of the screen. Income, Tax, Emergency fund, Charity, and a few other items have been preselected for you.</p>
        <p className="status">{status}</p>

        <div className="table-box setup-table-box">
          <table className="table setup-table" aria-labelledby="setup-heading" role="treegrid" aria-describedby="setup-help setup-key">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" id="setup-est-col">Estimated spending</th>
                <th scope="col">Recurrence</th>
                <th scope="col">Autopay</th>
                <th scope="col">Schedule</th>
                <th scope="col">Move</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
        {/* Help sits outside the scroll box so it doesn't scroll sideways (v0.4 review). */}
        <p id="setup-key" className="help">A subcategory with items shows the sum of its items’ monthly estimates.</p>

        {/* Settings sit side by side from 1280px, in DOM (reading and tab) order (0007 §10). */}
        <div className="form-grid setup-settings">
        <div className="field">
          <label className="label" htmlFor="week_start">Week starts on</label>
          <select id="week_start" className="input narrow" value={weekStart} onChange={e => setWeekStart(Number(e.target.value))}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>

        <fieldset className="fieldset" role="radiogroup" aria-labelledby="month_boundary-legend">
          <legend id="month_boundary-legend" className="legend">Month boundaries</legend>
          <ul className="plain-list choice-cards">
            {BOUNDARIES.map(b => (
              <li key={b.value}>
                <label className="choice-card">
                  <input type="radio" className="sr-only" name="month_boundary" id={`month_boundary-${b.value}`} value={b.value}
                    checked={boundary === b.value} onChange={() => setBoundary(b.value)} />
                  <span>{b.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="fieldset" role="radiogroup" aria-labelledby="default_range-legend">
          <legend id="default_range-legend" className="legend">Default display range</legend>
          <ul className="plain-list choice-buttons">
            {RANGES.map(r => (
              <li key={r.value}>
                <label className="choice-button">
                  <input type="radio" className="sr-only" name="default_range" id={`default_range-${r.value}`} value={r.value}
                    checked={range === r.value} onChange={() => setRange(r.value)} />
                  {r.label}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        </div>

        <fieldset className="fieldset prefs">
          <legend className="legend">Preferences</legend>
          <div className="field">
            <label className="check">
              <input type="checkbox" id="rewards" checked={rewards} onChange={e => setRewards(e.target.checked)} />
              Rewards when you save an amount
            </label>
            <Button type="button" className="secondary small" id="reward-preview" onClick={() => fireReward(true)}>Preview reward</Button>
          </div>
          <div className="field">
            <label className="check">
              <input type="checkbox" id="notifications" checked={notify} aria-describedby="notifications-help"
                onChange={async e => {
                  if (!e.target.checked) { setNotify(false); setNotifyMsg(''); return }
                  // Permission is asked here, from the click (0008 §6).
                  const r = await requestNotifications()
                  setNotify(r === 'granted')
                  setNotifyMsg(r === 'granted' ? '' : r === 'denied'
                    ? 'Notifications are blocked for this app. Allow them in your browser’s site settings, then turn this on again.'
                    : 'This browser can’t show notifications, so the daily reminder stays off.')
                }} />
              Daily reminder
            </label>
            <p id="notifications-help" className="help">Asks your browser for permission to show a reminder each evening. Reminders at a set time aren’t available yet; this saves your choice for when they are.</p>
            <p className="status">{notifyMsg}</p>
          </div>
        </fieldset>

        <section className="preview" aria-labelledby="preview-heading">
          <h3 id="preview-heading" className="section-title">Preview</h3>
          <BudgetTable roots={previewRoots} items={items} range={range} showEstimates idBase="preview" preview
            calendar={{ weekStart, monthBoundary: boundary }} />
        </section>

        {saveError && <p className="error">{saveError}</p>}
      </div>
      <div className="dialog-footer" ref={footerRef}>
        <Button type="button" className="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </dialog>
  )
}
