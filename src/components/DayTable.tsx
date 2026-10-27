import type { BudgetItem } from '../storage/db'
import { Fragment } from 'react'

const today = () => new Date().toISOString().slice(0, 10)

const TOP_LEVEL = new Set(['Pay', 'Incidental Income', 'Taxes', 'Net Income', 'Savings', 'Expenses'])

function categoryRowClass(cat: string): string {
  if (cat === 'Pay' || cat === 'Incidental Income') return 'indent-0 clr-blue'
  if (cat === 'Taxes') return 'indent-0 clr-red'
  if (cat === 'Net Income') return 'indent-0 clr-highlight-blue'
  if (cat === 'Savings') return 'indent-0 clr-green'
  if (cat === 'Expenses') return 'indent-0 clr-orange'
  // subexpense categories
  return 'indent-1 clr-lighter-orange'
}

function itemRowClass(cat: string, type: string): string {
  if (type === 'savings' || cat === 'Savings') return 'indent-1 clr-lighter-green'
  if (cat === 'Pay' || cat === 'Incidental Income') return 'indent-1 clr-blue'
  if (cat === 'Taxes') return 'indent-1 clr-red'
  // expense items
  return 'indent-2 clr-even-lighter-orange'
}

export function DayTable({ items }: { items: BudgetItem[] }) {
  const dayItems = items.filter(i => i.date === today() && ((i.amount ?? 0) !== 0 || (i.estimate ?? 0) !== 0))

  const groups = new Map<string, BudgetItem[]>()
  for (const it of dayItems) {
    const cat = it.category || it.name
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(it)
  }

  const sumField = (pred: (i: BudgetItem) => boolean, field: 'amount' | 'estimate') =>
    dayItems.filter(pred).reduce((a, b) => a + (b[field] ?? 0), 0)

  const netIncome =
    sumField(i => i.category === 'Pay', 'amount') +
    sumField(i => i.category === 'Incidental Income', 'amount') -
    sumField(i => i.category === 'Taxes', 'amount')
  const savings = sumField(i => i.type === 'savings', 'amount')
  const expenses = sumField(i => i.type === 'expense', 'amount')

  const estNet =
    sumField(i => i.category === 'Pay', 'estimate') +
    sumField(i => i.category === 'Incidental Income', 'estimate') -
    sumField(i => i.category === 'Taxes', 'estimate')

  const estSavings = sumField(i => i.type === 'savings', 'estimate')
  const estExpenses = sumField(i => i.type === 'expense', 'estimate')

  return (
    <table className="table day-table" aria-label="Day budget">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Est.</th>
          <th scope="col">Act.</th>
        </tr>
      </thead>
      <tbody>
        {[...groups.entries()].map(([cat, its]) => (
          <Fragment key={cat}>
            <tr className={TOP_LEVEL.has(cat) ? 'row-category' : 'row-subcategory'}>
              <td className={categoryRowClass(cat)}>{cat}</td>
              <td>{sumField(i => (i.category || i.name) === cat, 'estimate')}</td>
              <td>{sumField(i => (i.category || i.name) === cat, 'amount')}</td>
            </tr>
            {its.filter(i => (i.amount ?? 0) !== 0 || (i.estimate ?? 0) !== 0).map(i => (
              <tr key={i.id} className="row-item">
                <td className={itemRowClass(cat, i.type)}>{i.name}</td>
                <td>{i.estimate ?? ''}</td>
                <td>{i.amount || ''}</td>
              </tr>
            ))}
          </Fragment>
        ))}
        {(estNet !== 0 || netIncome !== 0) && (
          <tr className="row-computed"><td className={`indent-0 clr-highlight-blue`}>Net Income</td><td>{estNet}</td><td>{netIncome}</td></tr>
        )}
        {(estSavings !== 0 || savings !== 0) && (
          <tr className="row-computed"><td className={`indent-0 clr-green`}>Savings</td><td>{estSavings}</td><td>{savings}</td></tr>
        )}
        {(estExpenses !== 0 || expenses !== 0) && (
          <tr className="row-computed"><td className={`indent-0 clr-orange`}>Expenses</td><td>{estExpenses}</td><td>{expenses}</td></tr>
        )}
      </tbody>
    </table>
  )
}
