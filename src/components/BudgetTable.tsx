import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BudgetItem, Range } from '../storage/db'
import { actualFor, domId, estimateTotal, isoDate, formatAmount, isTotal, periodsFor, rangeHasEstimates, repeatedNames, spokenName, type Calendar, type CatNode, type Period } from '../budget/tree'
import { cleanName, moneyError, NAME_MAX, parseMoney, slug } from '../budget/validate'
import { budgetItemRepo, categoryRepo } from '../storage/repository'
import { Button } from './ui'

/** Open row action: Add value / Delete (Week, Month, §9.2) or Rename (Annual, §9.3). */
type Kind = 'add' | 'delete' | 'rename'
const fieldOf: Record<Kind, string> = { add: 'add_value', delete: 'delete_row', rename: 'rename_value' }
const buttonOf: Record<Kind, string> = { add: 'add', delete: 'delete_row', rename: 'rename' }

const COLLAPSED_KEY = 'simple-budget:collapsed'

function loadCollapsed(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')) } catch { return new Set() }
}

/**
 * Budget table per docs/design/0004-table-design.md: tree order, indents
 * 0/1/2, category colors, computed rows, only rows with an amount, and
 * expand/collapse state kept across range changes and restarts.
 */
export function BudgetTable({ roots, items, range, showEstimates: wantEstimates, calendar, idBase = 'budget', preview = false, onChanged }: {
  roots: CatNode[]
  /** Data changed from a table action (0007 §9); reload. */
  onChanged?: () => void
  /** Prefix for this table's ids; the heading it's named by is `{idBase}-heading`. */
  idBase?: string
  /** Read-only preview (0007 §5.4): every row expanded, no expand/collapse buttons. */
  preview?: boolean
  calendar: Calendar
  items: BudgetItem[]
  range: Range
  showEstimates: boolean
}) {
  const showEstimates = wantEstimates && rangeHasEstimates(range)
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const [today] = useState(() => new Date())
  const { columns, total, title } = periodsFor(range, today, calendar)
  const periods = total ? [...columns, total] : columns

  const actions = !preview && !!onChanged
  /** Annual edits names in the name cell, so it has no Actions column (0007 §10). */
  const actionCol = actions && range !== 'year'
  const repeated = repeatedNames(roots)
  const say = (n: CatNode) => spokenName(n, repeated)
  const [confirm, setConfirm] = useState<number | null>(null)
  /** Row with an open action: Add value or Delete (Week/Month, §9.2). */
  const [rowEdit, setRowEdit] = useState<{ id: number; kind: Kind } | null>(null)
  const [value, setValue] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const focusAfter = useRef<string | null>(null)
  useEffect(() => {
    if (!focusAfter.current) return
    document.getElementById(focusAfter.current)?.focus()
    focusAfter.current = null
  })

  // Day: each purchase is its own row under its item (0007 §9.1).
  const purchasesOf = (n: CatNode) => range === 'day'
    ? items.filter(i => i.categoryId === n.cat.id && i.date === periods[0].from).sort((a, b) => a.createdAt - b.createdAt)
    : []
  const purchaseLabel = (i: BudgetItem) =>
    `Purchase, ${new Date(i.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  const deleteId = (n: CatNode, i: BudgetItem) => ['delete', n.parent && slug(n.parent.cat.name), slug(n.cat.name), i.id].filter(Boolean).join('-')

  async function remove(n: CatNode, i: BudgetItem, next: string) {
    setError('')
    try {
      await budgetItemRepo.remove(i.id!)
    } catch {
      setError(`Error: The ${n.cat.name} purchase wasn’t deleted. Try again.`)
      return
    }
    setConfirm(null)
    setStatus(`Deleted the ${say(n)} purchase of ${formatAmount(i.amount) || '0.00'}.`)
    focusAfter.current = next
    onChanged?.()
  }

  const span = total ?? columns[0]
  const todayIso = isoDate(today)
  /** Date for a value added from Week/Month: today if it's in range, else the range's last day. */
  const addDate = todayIso >= span.from && todayIso <= span.to ? todayIso : span.to

  function openRow(n: CatNode, kind: Kind) {
    setRowEdit({ id: n.cat.id, kind }); setValue(kind === 'rename' ? n.cat.name : ''); setFieldError(''); setError('')
    focusAfter.current = domId(fieldOf[kind], n) + (kind === 'delete' ? '-cancel' : '')
  }
  function closeRow(n: CatNode, kind: Kind) {
    setRowEdit(null); setFieldError('')
    focusAfter.current = domId(buttonOf[kind], n)
  }

  async function rename(n: CatNode) {
    const name = cleanName(value)
    const fail = (msg: string) => { setFieldError(msg); focusAfter.current = domId('rename_value', n) }
    if (!name) return fail(`Error: Name for ${say(n)} cannot be empty`)
    if (n.parent!.children.some(c => c !== n && slug(c.cat.name) === slug(name))) return fail(`Invalid: Name “${name}” already exists in ${n.parent!.cat.name}`)
    try {
      await categoryRepo.rename(n.cat.id, name)
    } catch {
      setError(`Error: ${n.cat.name} wasn’t renamed. Try again.`)
      return
    }
    setStatus(`Renamed ${say(n)} to ${name}.`)
    closeRow(n, 'rename')
    onChanged?.()
  }

  async function addValue(n: CatNode) {
    const r = parseMoney(value, { allowNegative: true })
    if (!r.ok) {
      setFieldError(moneyError(`Value for ${say(n)}`, r, '12.50 or -12.50'))
      focusAfter.current = domId('add_value', n)
      return
    }
    try {
      await budgetItemRepo.add({ categoryId: n.cat.id, amount: r.value, date: addDate })
    } catch {
      setError(`Error: The value for ${n.cat.name} wasn’t saved. Try again.`)
      return
    }
    setStatus(`Added ${formatAmount(r.value) || '0.00'} to ${say(n)} on ${addDate}.`)
    closeRow(n, 'add')
    onChanged?.()
  }

  async function deleteRow(n: CatNode) {
    try {
      await categoryRepo.removeEmpty(n.cat.id)
    } catch {
      setError(`Error: ${n.cat.name} wasn’t deleted. Try again.`)
      return
    }
    setRowEdit(null)
    setStatus(`Deleted ${say(n)}.`)
    focusAfter.current = `${idBase}-caption`
    onChanged?.()
  }

  const withOne = (n: CatNode) => {
    const p = items.find(i => i.categoryId === n.cat.id)
    return p ? ` and its purchase of ${formatAmount(p.amount) || '0.00'}` : ''
  }

  function tryDelete(n: CatNode) {
    const why = n.children.length ? 'delete its items first'
      : items.filter(i => i.categoryId === n.cat.id).length > 1 ? 'it has more than one purchase; delete them in the Day table first' : ''
    if (why) { setStatus(`${say(n)} can’t be deleted yet: ${why}.`); return }
    openRow(n, 'delete')
  }

  /** Annual name cell: the name with a pencil Rename button, or the rename form (0007 §9.3, §10). */
  function renameControls(n: CatNode): ReactNode {
    if (!actions || range !== 'year' || !n.parent) return null
    const id = domId('rename_value', n)
    if (rowEdit?.id !== n.cat.id || rowEdit.kind !== 'rename') {
      return (
        <Button type="button" className="secondary icon" id={domId('rename', n)} aria-label={`Rename ${say(n)}`}
          onClick={() => openRow(n, 'rename')}>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </Button>
      )
    }
    return (
      <>
        <span className="inline-form">
          <label className="sr-only" htmlFor={id}>New name for {say(n)}</label>
          <input id={id} className="input" maxLength={NAME_MAX} value={value} autoComplete="off"
            aria-invalid={!!fieldError || undefined} aria-describedby={fieldError ? `${id}-error_msg` : undefined}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rename(n) } else if (e.key === 'Escape') closeRow(n, 'rename') }} />
          <Button type="button" className="small" onClick={() => rename(n)}>Save</Button>
          <Button type="button" className="secondary small" onClick={() => closeRow(n, 'rename')}>Cancel</Button>
        </span>
        {fieldError && <p id={`${id}-error_msg`} className="error">{fieldError}</p>}
      </>
    )
  }

  /** Actions cell for a category row: Week/Month add value and delete (§9.2), Annual rename (§9.3). */
  function rowActions(n: CatNode): ReactNode {
    if (!actions) return null
    const kind = rowEdit?.id === n.cat.id ? rowEdit.kind : null
    if (range === 'year') return null
    if (range !== 'week' && range !== 'month') return <td />
    if (kind === 'add') {
      const id = domId('add_value', n)
      return (
        <td className="row-actions">
          <span className="inline-form">
            <label className="sr-only" htmlFor={id}>Value to add to {say(n)}</label>
            <input id={id} className="input amount" inputMode="decimal" value={value} autoComplete="off"
              aria-invalid={!!fieldError || undefined}
              aria-describedby={fieldError ? `${id}-error_msg ${idBase}-add-help` : `${idBase}-add-help`}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addValue(n) } else if (e.key === 'Escape') closeRow(n, 'add') }} />
            <Button type="button" className="small" onClick={() => addValue(n)}>Save</Button>
            <Button type="button" className="secondary small" onClick={() => closeRow(n, 'add')}>Cancel</Button>
          </span>
          {fieldError && <p id={`${id}-error_msg`} className="error">{fieldError}</p>}
        </td>
      )
    }
    const del = domId('delete_row', n)
    if (kind === 'delete') {
      return (
        <td className="row-actions">
          <span className="confirm" role="group" aria-label={`Delete ${say(n)}${withOne(n)}?`}>
            <span aria-hidden="true">Delete {n.cat.name}{withOne(n)}?</span>
            <Button type="button" className="danger small" id={`${del}-confirm`} onClick={() => deleteRow(n)}>Delete</Button>
            <Button type="button" className="secondary small" id={`${del}-cancel`} onClick={() => closeRow(n, 'delete')}>Cancel</Button>
          </span>
        </td>
      )
    }
    return (
      <td className="row-actions">
        <span className="reorder">
          {!isTotal(n) && n.cat.name !== 'Net Income' && (
            <Button type="button" className="secondary small" id={domId('add', n)} aria-label={`Add value to ${say(n)}`}
              onClick={() => openRow(n, 'add')}>Add value</Button>
          )}
          {n.parent && (
            <Button type="button" className="secondary small" id={del} aria-label={`Delete ${say(n)}`}
              onClick={() => tryDelete(n)}>Delete</Button>
          )}
        </span>
      </td>
    )
  }

  const values = (n: CatNode, p: Period) => ({ est: estimateTotal(n, p), act: actualFor(n, p, items) })
  const hasAmount = (n: CatNode) =>
    periods.some(p => { const v = values(n, p); return v.act !== 0 || (showEstimates && v.est !== 0) })

  function toggle(id: number) {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id); else next.add(id)
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])) } catch { /* storage unavailable */ }
  }

  const cells = (get: (p: Period) => { est: number; act: number }) => periods.map(p => {
    const v = get(p)
    return (
      <Fragment key={p.from + p.label}>
        {showEstimates && <td className="num">{formatAmount(v.est)}</td>}
        <td className={`num${v.act < 0 ? ' neg' : ''}`}>{formatAmount(v.act)}</td>
      </Fragment>
    )
  })

  const byName = (name: string) => roots.find(r => r.cat.name === name)
  const netIncome = (p: Period) => {
    const sum = (name: string) => { const n = byName(name); return n ? values(n, p) : { est: 0, act: 0 } }
    const [income, tax] = [sum('Income'), sum('Taxes')]
    return { est: income.est - tax.est, act: income.act - tax.act }
  }

  const rows: ReactNode[] = []
  function addRow(n: CatNode) {
    if (!hasAmount(n)) return
    const kids = n.children.filter(hasAmount)
    const open = preview || !collapsed.has(n.cat.id)
    const label = n.cat.name
    rows.push(
      <tr key={n.cat.id} className={`row depth-${n.depth}${n.children.length ? ' group' : ''}`}>
        <th scope="row" className={`name clr-${n.cat.color}`}>
          <span className="name-line">
            {rowEdit?.id === n.cat.id && rowEdit.kind === 'rename' ? null : kids.length > 0 && !preview
              ? <button type="button" className="expander" aria-expanded={open} onClick={() => toggle(n.cat.id)}>{label}</button>
              : label}
            {renameControls(n)}
          </span>
          {(range === 'week' || range === 'month') && !isTotal(n) && (n.cat.dueDate || n.cat.autopay) && (
            <span className="row-meta">
              {[n.cat.dueDate && `Due ${new Date(n.cat.dueDate + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, n.cat.autopay && 'autopay'].filter(Boolean).join(', ')}
            </span>
          )}
        </th>
        {cells(p => values(n, p))}
        {rowActions(n)}
      </tr>,
    )
    if (!open) return
    const bought = purchasesOf(n)
    bought.forEach((i, k) => {
      const id = deleteId(n, i)
      // After a delete, focus the next purchase's Delete, else the previous, else the caption.
      const next = bought[k + 1] ? deleteId(n, bought[k + 1]) : bought[k - 1] ? deleteId(n, bought[k - 1]) : `${idBase}-caption`
      const asking = confirm === i.id
      rows.push(
        <tr key={`p${i.id}`} className={`row purchase depth-${n.depth + 1}`}>
          <th scope="row" className="name">{purchaseLabel(i)}</th>
          <td className={`num${i.amount < 0 ? ' neg' : ''}`}>{formatAmount(i.amount) || '0.00'}</td>
          {actionCol && (
            <td className="row-actions">
              {asking
                ? <span className="confirm" role="group" aria-label={`Delete the ${say(n)} purchase of ${formatAmount(i.amount) || '0.00'}?`}>
                  <span aria-hidden="true">Delete this purchase?</span>
                  <Button type="button" className="danger small" id={`${id}-confirm`} onClick={() => remove(n, i, next)}>Delete</Button>
                  <Button type="button" className="secondary small" id={`${id}-cancel`}
                    onClick={() => { setConfirm(null); focusAfter.current = id }}>Cancel</Button>
                </span>
                : <Button type="button" className="secondary small" id={id}
                  aria-label={`Delete ${say(n)} purchase of ${formatAmount(i.amount) || '0.00'}`}
                  onClick={() => { setConfirm(i.id!); focusAfter.current = `${id}-cancel` }}>Delete</Button>}
            </td>
          )}
        </tr>,
      )
    })
    kids.forEach(addRow)
  }
  for (const r of roots) {
    if (r.cat.name !== 'Net Income') { addRow(r); continue }
    if (periods.some(p => { const v = netIncome(p); return v.act !== 0 || (showEstimates && v.est !== 0) })) {
      rows.push(
        <tr key={r.cat.id} className="row depth-0 net">
          <th scope="row" className={`name clr-${r.cat.color}`}>Net Income</th>
          {cells(netIncome)}
          {actionCol && <td />}
        </tr>,
      )
    }
  }

  const colSpan = showEstimates ? 2 : 1
  return (
    <div className="table-box">
      <table className="table budget-table" aria-labelledby={`${idBase}-heading ${idBase}-caption`} aria-describedby={`${idBase}-key`}>
        <caption id={`${idBase}-caption`} tabIndex={-1}>{title}</caption>
        <thead>
          {range !== 'day' && range !== 'year' && (
            <tr>
              <td />
              {periods.map(p => <th key={p.label} scope="colgroup" colSpan={colSpan}>{p.label}</th>)}
              {actionCol && <td />}
            </tr>
          )}
          <tr>
            <th scope="col" className="name">Item</th>
            {range === 'year'
              // Annual shows actuals only, so each month heads its own column (0007 §10).
              ? periods.map(p => <th key={p.label} scope="col" className="num">{p.label}</th>)
              : periods.map(p => (
                <Fragment key={p.label}>
                  {showEstimates && <th scope="col" className="num">Est.</th>}
                  <th scope="col" className="num">Act.</th>
                </Fragment>
              ))}
            {actionCol && <th scope="col" className="name">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows : <tr><td className="empty" colSpan={1 + periods.length * colSpan + (actionCol ? 1 : 0)}>Nothing recorded for this range yet.</td></tr>}
        </tbody>
      </table>
      <p id={`${idBase}-key`} className="help">Only rows with an amount appear. Every row totals the rows under it.{range === 'day' && ' Each purchase is listed under its item.'}</p>
      {actions && (range === 'week' || range === 'month') && (
        <p id={`${idBase}-add-help`} className="help">Add value records a new amount on that item, dated {addDate}. Use a minus sign to subtract, e.g. -12.50. A row can be deleted when it has no items and at most one purchase.</p>
      )}
      {actions && <p className="status" role="status">{status}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}
