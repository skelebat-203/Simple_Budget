import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, ErrorSummary, focusFirstError, type FieldError } from '../components/ui'
import { BudgetTable } from '../components/BudgetTable'
import { saveSetup } from '../storage/repository'
import { cleanName, dateBounds, moneyError, NAME_MAX, parseMoney, slug } from '../budget/validate'
import type { BudgetItem, Category, DefaultRange, Frequency, MonthBoundary } from '../storage/db'
import {
  buildTree, domId, estimateTotal, flatten, formatAmount, frequenciesFor, isTotal, repeatedNames, spokenName,
  subtree, type Calendar, type Cat, type CatNode,
} from '../budget/tree'
import * as edit from '../budget/setupEdits'

const RANGES: { value: DefaultRange; label: string }[] = [
  { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' },
]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const BOUNDARIES: { value: MonthBoundary; label: string }[] = [
  { value: 'weeks', label: 'Whole weeks (each month starts and ends on a full week)' },
  { value: 'calendar', label: 'Calendar month (the 1st to the last day)' },
]
const MONTH = { label: '', from: '', to: '', days: 30.44 }

/** Budget setup overlay (0007 §5). Edits a working copy; Save stores it and closes, Cancel drops it. */
export function BudgetSetup({ cats, items, defaultRange, calendar, onClose, onSaved }: {
  cats: Category[]
  items: BudgetItem[]
  defaultRange: DefaultRange
  calendar: Calendar
  onClose: () => void
  onSaved: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const [original] = useState(() => cats.filter((c): c is Cat => typeof c.id === 'number'))
  const [work, setWork] = useState<Cat[]>(original)
  /** Estimate text as typed, by row id; rows not typed in show their stored estimate. */
  const [est, setEst] = useState<Record<number, string>>({})
  const [range, setRange] = useState(defaultRange)
  const [weekStart, setWeekStart] = useState(calendar.weekStart)
  const [boundary, setBoundary] = useState(calendar.monthBoundary)
  const [create, setCreate] = useState<Record<number, { name: string; parent: number }>>({})
  /** Expanded rows; categories start open, subcategories collapsed (0007 §10). */
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(original.filter(c => c.parentId == null).map(c => c.id)))
  const expand = (id: number) => setExpanded(x => new Set(x).add(id))
  const toggleRow = (id: number) => setExpanded(x => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const [moveTarget, setMoveTarget] = useState<Record<number, number>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [bounds] = useState(() => dateBounds(new Date()))
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
    const r = parseMoney(est[id], { allowNegative: false })
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

  function moveUnder(n: CatNode) {
    const to = moveTarget[n.cat.id]
    const target = edit.moveTargets(n).find(t => t.cat.id === to)
    if (!target || target.cat.id === n.cat.parentId) return
    if (edit.nameTaken(work, target.cat.id, n.cat.name, n.cat.id)) {
      setStatus(`${target.cat.name} already has ${n.cat.name}. Rename one first.`)
      return
    }
    const r = edit.moveTo(flush(work, target.cat.id), n.cat.id, target.cat.id)
    setWork(r.cats)
    expand(target.cat.id)
    setStatus(`Moved ${say(n)} to ${target.cat.name}.` + (r.movedFrom ? ` Your ${r.movedFrom} estimate moved to ${r.movedFrom} › Miscellaneous.` : ''))
    const moved = flatten(buildTree(r.cats)).find(x => x.cat.id === n.cat.id)
    if (moved) setFocusId(domId('move_to', moved))
  }

  async function save() {
    setSaveError('')
    const errs: Record<string, string> = {}
    let final = work
    for (const n of flatten(roots)) {
      if (isTotal(n)) { final = edit.patch(final, n.cat.id, { estimate: undefined, frequency: undefined, autopay: undefined, dueDate: undefined }); continue }
      const due = n.cat.dueDate
      if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < bounds.min || due > bounds.max)) {
        errs[domId('due_date', n)] = `Invalid: Due date for ${say(n)} use a date from ${bounds.min} to ${bounds.max}`
      }
      const text = estText(n.cat).trim()
      if (text === '') { final = edit.patch(final, n.cat.id, { estimate: undefined }); continue }
      const r = parseMoney(text, { allowNegative: false })
      if (r.ok) final = edit.patch(final, n.cat.id, { estimate: r.value })
      else errs[domId('estimate', n)] = moneyError(`Estimated spending for ${say(n)}`, r, '40 or 1,200.00')
    }
    setErrors(errs)
    const list: FieldError[] = Object.entries(errs).map(([fieldId, message]) => ({ fieldId, message }))
    if (list.length) { requestAnimationFrame(() => focusFirstError(list, bannerRef.current)); return }
    setSaving(true)
    try {
      await saveSetup(final, original, { defaultRange: range, weekStart, monthBoundary: boundary })
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
    const r = parseMoney(est[c.id], { allowNegative: false })
    return r.ok ? { ...c, estimate: r.value } : r.reason === 'empty' ? { ...c, estimate: undefined } : c
  })), [work, est])

  // ---------- treegrid keyboard (0007 §10) ----------
  const gridRef = useRef<HTMLTableElement>(null)
  const lastCell = useRef<HTMLElement | null>(null)
  const widgetsOf = (cell: Element) => [...cell.querySelectorAll<HTMLElement>('input, select, button')]

  // One tab stop: the last focused cell (or the first). Controls inside cells are reached with Enter.
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const cells = [...grid.querySelectorAll<HTMLElement>('tbody td, tbody th')]
    const current = lastCell.current && grid.contains(lastCell.current) ? lastCell.current : cells[0]
    for (const c of cells) {
      c.tabIndex = c === current ? 0 : -1
      for (const w of widgetsOf(c)) w.tabIndex = -1
    }
  })

  function onGridKey(e: React.KeyboardEvent<HTMLTableElement>) {
    const t = e.target as HTMLElement
    const cell = t.closest('td, th') as HTMLElement | null
    if (!cell || !cell.closest('tbody')) return
    const inText = t !== cell && (t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !['checkbox', 'radio'].includes((t as HTMLInputElement).type)))
    if (e.key === 'Escape' && t !== cell) { e.preventDefault(); e.stopPropagation(); cell.focus(); return }
    if (inText) return
    if (t === cell && (e.key === 'Enter' || e.key === 'F2')) {
      const w = widgetsOf(cell)[0]
      if (w) { e.preventDefault(); w.focus() }
      return
    }
    if (t === cell && e.key === ' ') {
      const box = cell.querySelector<HTMLInputElement>('input[type=checkbox]')
      if (box) { e.preventDefault(); box.click() }
      return
    }
    const row = cell.parentElement as HTMLTableRowElement
    const rows = [...(row.parentElement as HTMLTableSectionElement).rows]
    const r = rows.indexOf(row)
    const col = [...row.cells].indexOf(cell as HTMLTableCellElement)
    const go = (ri: number, ci: number) => {
      const target = rows[Math.max(0, Math.min(rows.length - 1, ri))]
      const c = target.cells[Math.max(0, Math.min(target.cells.length - 1, ci))]
      lastCell.current = c
      c.focus()
    }
    const id = Number(row.dataset.id)
    const isOpen = row.getAttribute('aria-expanded')
    switch (e.key) {
      case 'ArrowDown': go(r + 1, col); break
      case 'ArrowUp': go(r - 1, col); break
      case 'ArrowRight':
        if (col === 0 && isOpen === 'false') toggleRow(id)
        else go(r, col + 1)
        break
      case 'ArrowLeft':
        if (col === 0 && isOpen === 'true') toggleRow(id)
        else if (col === 0) {
          // Move to the parent row.
          const level = Number(row.getAttribute('aria-level'))
          const p = rows.slice(0, r).reverse().find(x => Number(x.getAttribute('aria-level')) < level)
          if (p) go(rows.indexOf(p), 0)
        } else go(r, col - 1)
        break
      case 'Home': go(e.ctrlKey ? 0 : r, 0); break
      case 'End': go(e.ctrlKey ? rows.length - 1 : r, 99); break
      default: return
    }
    e.preventDefault()
  }

  const rows: ReactNode[] = []
  const addRows = (n: CatNode) => {
    if (n.cat.name === 'Net Income') return
    rows.push(setupRow(n))
    if (!expanded.has(n.cat.id)) return
    n.children.forEach(addRows)
    if (!n.parent && n.cat.computed) rows.push(createRow(n))
  }
  roots.forEach(addRows)

  function setupRow(n: CatNode) {
    const total = isTotal(n)
    const nameId = domId('name', n)
    const estId = domId('estimate', n)
    const sibs = n.parent?.children ?? roots
    const i = sibs.indexOf(n)
    const label = n.cat.name
    const targets = edit.canMoveTo(n) ? edit.moveTargets(n) : []
    return (
      <tr key={n.cat.id} className={`row depth-${n.depth}${n.children.length ? ' group' : ''}`}
        data-id={n.cat.id} aria-level={n.depth + 1} aria-expanded={n.children.length ? expanded.has(n.cat.id) : undefined}>
        <th scope="row" id={nameId} className={`name clr-${n.cat.color}`}>
          <span className="name-line">
            {n.children.length > 0 && (
              // Mouse affordance; keyboard users expand with Right/Left (treegrid).
              <span className="twisty" aria-hidden="true" onClick={() => toggleRow(n.cat.id)}>{expanded.has(n.cat.id) ? '▾' : '▸'}</span>
            )}
            {(n.parent || !n.cat.computed) && (
              <label className="hit">
                <input type="checkbox" className="checkbox" id={domId('select', n)}
                  aria-label={n.children.length ? `Select all ${say(n)} items` : `Select ${say(n)}`}
                  checked={isChecked(n)} ref={el => { if (el) el.indeterminate = isMixed(n) }}
                  onChange={e => setWork(edit.setSelected(work, n.cat.id, e.target.checked))} />
              </label>
            )}
            <span>{label}</span>
          </span>
        </th>
        <td>
          {total
            ? n.parent && <span>{formatAmount(estimateTotal(n, MONTH)) || '0.00'} <span className="help">per month</span></span>
            : <>
              <input id={estId} className="input amount" inputMode="decimal" value={estText(n.cat)}
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
                onChange={e => setWork(edit.patch(work, n.cat.id, { frequency: e.target.value as Frequency }))}>
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
        <td>
          {!total && (() => {
            const dueId = domId('due_date', n)
            return <>
              <input type="date" className="input" id={dueId} min={bounds.min} max={bounds.max} value={n.cat.dueDate ?? ''}
                aria-label={`Due date for ${say(n)}`} aria-invalid={!!errors[dueId] || undefined}
                aria-describedby={errors[dueId] ? `${dueId}-error_msg` : undefined}
                onChange={e => setWork(edit.patch(work, n.cat.id, { dueDate: e.target.value || undefined }))} />
              {errors[dueId] && <p id={`${dueId}-error_msg`} className="error">{errors[dueId]}</p>}
            </>
          })()}
        </td>
        <td>
          {n.parent && (
            <span className="reorder">
              <Button type="button" className="secondary small" id={domId('move_up', n)} aria-label={`Move ${say(n)} up`}
                aria-disabled={i === 0 || undefined} onClick={() => moveRow(n, -1)}><span aria-hidden="true">↑</span></Button>
              <Button type="button" className="secondary small" id={domId('move_down', n)} aria-label={`Move ${say(n)} down`}
                aria-disabled={i === sibs.length - 1 || undefined} onClick={() => moveRow(n, 1)}><span aria-hidden="true">↓</span></Button>
              {targets.length > 1 && <>
                <select className="input" id={domId('move_to', n)} aria-label={`Move ${say(n)} to`}
                  value={moveTarget[n.cat.id] ?? n.cat.parentId ?? ''}
                  onChange={e => setMoveTarget(m => ({ ...m, [n.cat.id]: Number(e.target.value) }))}>
                  {targets.map(t => <option key={t.cat.id} value={t.cat.id}>{t.cat.name}</option>)}
                </select>
                <Button type="button" className="secondary small" aria-label={`Move ${say(n)}`}
                  aria-describedby={domId('move_to', n)} onClick={() => moveUnder(n)}>Move</Button>
              </>}
            </span>
          )}
        </td>
      </tr>
    )
  }

  function createRow(root: CatNode) {
    const base = `create-${slug(root.cat.name)}`
    const c = create[root.cat.id] ?? { name: '', parent: root.cat.id }
    const err = errors[base]
    const set = (p: Partial<typeof c>) => setCreate(x => ({ ...x, [root.cat.id]: { ...c, ...p } }))
    return (
      <tr key={`create-${root.cat.id}`} className={`row create depth-1 clr-${root.cat.color}`} aria-level={2}>
        <td colSpan={6}>
          <div className="create-row">
            <label className="label" htmlFor={base}>Create in {root.cat.name}</label>
            <input id={base} className="input" maxLength={NAME_MAX} value={c.name}
              aria-invalid={!!err || undefined} aria-describedby={err ? `${base}-error_msg` : undefined}
              onChange={e => set({ name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRow(root) } }} />
            <label className="label" htmlFor={`${base}-parent`}>Add to</label>
            <select id={`${base}-parent`} className="input" value={c.parent} onChange={e => set({ parent: Number(e.target.value) })}>
              {[root, ...root.children].map(t => <option key={t.cat.id} value={t.cat.id}>{t.cat.name}</option>)}
            </select>
            <Button type="button" className="secondary" aria-disabled={!c.name.trim() || undefined} aria-describedby={base}
              onClick={() => addRow(root)}>Add</Button>
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
        <p className="status" role="status">{status}</p>

        <div className="table-box">
          <table className="table setup-table" role="treegrid" aria-labelledby="setup-heading" aria-describedby="setup-help setup-key setup-keys"
            ref={gridRef} onKeyDown={onGridKey} onFocus={e => { const c = (e.target as HTMLElement).closest('td, th'); if (c && c.closest('tbody')) lastCell.current = c as HTMLElement }}>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" id="setup-est-col">Estimated spending</th>
                <th scope="col">Recurrence</th>
                <th scope="col">Autopay</th>
                <th scope="col">Due date</th>
                <th scope="col">Order</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
          <p id="setup-key" className="help">A subcategory with items shows the sum of its items’ monthly estimates.</p>
          <p id="setup-keys" className="help">Keyboard: arrow keys move between cells; Right and Left open and close a row; Enter edits a cell; Escape returns to the cell.</p>
        </div>

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
                  <input type="radio" name="month_boundary" id={`month_boundary-${b.value}`} value={b.value}
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

        <section className="preview" aria-labelledby="preview-heading">
          <h3 id="preview-heading" className="section-title">Preview</h3>
          <BudgetTable roots={previewRoots} items={items} range={range} showEstimates idBase="preview" preview
            calendar={{ weekStart, monthBoundary: boundary }} />
        </section>

        {saveError && <p className="error" role="alert">{saveError}</p>}
      </div>
      <div className="dialog-footer">
        <Button type="button" className="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </dialog>
  )
}
