import { Fragment, useState, type ReactNode } from 'react'
import type { BudgetItem, Range } from '../storage/db'
import { actualFor, estimateTotal, formatAmount, periodsFor, type CatNode, type Period } from '../budget/tree'

const COLLAPSED_KEY = 'simple-budget:collapsed'

function loadCollapsed(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')) } catch { return new Set() }
}

/**
 * Budget table per docs/design/0004-table-design.md: tree order, indents
 * 0/1/2, category colors, computed rows, only rows with an amount, and
 * expand/collapse state kept across range changes and restarts.
 */
export function BudgetTable({ roots, items, range, showEstimates }: {
  roots: CatNode[]
  items: BudgetItem[]
  range: Range
  showEstimates: boolean
}) {
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const [today] = useState(() => new Date())
  const { columns, total } = periodsFor(range, today)
  const periods = total ? [...columns, total] : columns

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
    const [pay, inc, tax] = [sum('Pay'), sum('Incidental Income'), sum('Taxes')]
    return { est: pay.est + inc.est - tax.est, act: pay.act + inc.act - tax.act }
  }

  const rows: ReactNode[] = []
  function addRow(n: CatNode) {
    if (!hasAmount(n)) return
    const kids = n.children.filter(hasAmount)
    const open = !collapsed.has(n.cat.id)
    const label = n.cat.computed ? `${n.cat.name} *` : n.cat.name
    rows.push(
      <tr key={n.cat.id} className={`row depth-${n.depth}${n.children.length ? ' group' : ''}`}>
        <th scope="row" className={`name clr-${n.cat.color}`}>
          {kids.length > 0
            ? <button type="button" className="expander" aria-expanded={open} onClick={() => toggle(n.cat.id)}>{label}</button>
            : label}
        </th>
        {cells(p => values(n, p))}
      </tr>,
    )
    if (open) kids.forEach(addRow)
  }
  for (const r of roots) {
    if (r.cat.name !== 'Net Income') { addRow(r); continue }
    if (periods.some(p => { const v = netIncome(p); return v.act !== 0 || (showEstimates && v.est !== 0) })) {
      rows.push(
        <tr key={r.cat.id} className="row depth-0 net">
          <th scope="row" className={`name clr-${r.cat.color}`}>Net Income *</th>
          {cells(netIncome)}
        </tr>,
      )
    }
  }

  const colSpan = showEstimates ? 2 : 1
  return (
    <div className="table-box">
      <table className="table budget-table" aria-labelledby="budget-heading budget-caption" aria-describedby="budget-key">
        <caption id="budget-caption">{range === 'day' ? columns[0].label : `${range === 'week' ? 'Week' : 'Month'} of ${columns[0].label.split(' – ')[0]}`}</caption>
        <thead>
          {range !== 'day' && (
            <tr>
              <td />
              {periods.map(p => <th key={p.label} scope="colgroup" colSpan={colSpan}>{p.label}</th>)}
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
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows : <tr><td className="empty" colSpan={1 + periods.length * colSpan}>Nothing recorded for this range yet.</td></tr>}
        </tbody>
      </table>
      <p id="budget-key" className="help">Only rows with an amount appear. Rows marked * are totals.</p>
    </div>
  )
}
