import type { BudgetItem } from '../storage/db'
import { Fragment } from 'react'

const today = () => new Date().toISOString().slice(0, 10)

function getColorForCategory(cat: string) {
  if (cat === 'Pay' || cat === 'Incidental Income') return 'clr-blue'
  if (cat === 'Taxes') return 'clr-red'
  if (cat === 'Net Income') return 'clr-highlight-blue'
  if (cat === 'Savings') return 'clr-green'
  if (cat === 'Expenses') return 'clr-orange'
  if (cat === 'Debt' || cat === 'Utilities' || cat === 'Subscriptions') return 'clr-lighter-orange'
  if (cat === 'Charity') return 'clr-lighter-orange'
  if (cat === 'Groceries' || cat === 'Gas' || cat === 'Gifts' || cat === 'Incidentals' || cat === 'Medical' || cat === 'Insurance' || cat === 'Maintenance') return 'clr-lighter-orange'
  return ''
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
            <tr className="row-category">
              <td className={`indent-0 ${getColorForCategory(cat)}`}>{cat}</td>
              <td>{sumField(i => (i.category || i.name) === cat, 'estimate')}</td>
              <td>{sumField(i => (i.category || i.name) === cat, 'amount')}</td>
            </tr>
            {its.filter(i => (i.amount ?? 0) !== 0 || (i.estimate ?? 0) !== 0).map(i => (
              <tr key={i.id} className="row-item">
                <td className={`indent-2 ${getColorForCategory(i.category || cat)}`}>{i.name}</td>
                <td>{i.estimate ?? ''}</td>
                <td>{i.amount || ''}</td>
              </tr>
            ))}
          </Fragment>
        ))}
        <tr className="row-computed"><td className={`indent-0 clr-highlight-blue`}>Net Income</td><td>{estNet}</td><td>{netIncome}</td></tr>
        <tr className="row-computed"><td className={`indent-0 clr-green`}>Savings</td><td>{sumField(i => i.type === 'savings', 'estimate')}</td><td>{savings}</td></tr>
        <tr className="row-computed"><td className={`indent-0 clr-orange`}>Expenses</td><td>{sumField(i => i.type === 'expense', 'estimate')}</td><td>{expenses}</td></tr>
      </tbody>
    </table>
  )
}
