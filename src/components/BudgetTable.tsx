import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BudgetItem, Range } from '../storage/db'
import { actualFor, estimateTotal, formatAmount, isTotal, periodsFor, rangeHasEstimates, repeatedNames, spokenName, type Calendar, type CatNode, type Period } from '../budget/tree'
import { slug } from '../budget/validate'
import { budgetItemRepo } from '../storage/repository'
import { Button } from './ui'

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
  const repeated = repeatedNames(roots)
  const say = (n: CatNode) => spokenName(n, repeated)
  const [confirm, setConfirm] = useState<number | null>(null)
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
    const label = isTotal(n) ? `${n.cat.name} *` : n.cat.name
    rows.push(
      <tr key={n.cat.id} className={`row depth-${n.depth}${n.children.length ? ' group' : ''}`}>
        <th scope="row" className={`name clr-${n.cat.color}`}>
          {kids.length > 0 && !preview
            ? <button type="button" className="expander" aria-expanded={open} onClick={() => toggle(n.cat.id)}>{label}</button>
            : label}
        </th>
        {cells(p => values(n, p))}
        {actions && <td />}
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
          {actions && (
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
          <th scope="row" className={`name clr-${r.cat.color}`}>Net Income *</th>
          {cells(netIncome)}
          {actions && <td />}
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
          {range !== 'day' && (
            <tr>
              <td />
              {periods.map(p => <th key={p.label} scope="colgroup" colSpan={colSpan}>{p.label}</th>)}
              {actions && <td />}
            </tr>
          )}
          <tr>
            <th scope="col" className="name">Item</th>
            {periods.map(p => (
              <Fragment key={p.label}>
                {showEstimates && <th scope="col" className="num">Est.</th>}
                <th scope="col" className="num">Act.</th>
              </Fragment>
            ))}
            {actions && <th scope="col" className="name">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows : <tr><td className="empty" colSpan={1 + periods.length * colSpan + (actions ? 1 : 0)}>Nothing recorded for this range yet.</td></tr>}
        </tbody>
      </table>
      <p id={`${idBase}-key`} className="help">Only rows with an amount appear. Rows marked * are totals.{range === 'day' && ' Each purchase is listed under its item.'}</p>
      {actions && <p className="status" role="status">{status}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}
