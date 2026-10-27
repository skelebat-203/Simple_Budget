import type { BudgetItem } from '../storage/db'

const today = () => new Date().toISOString().slice(0, 10)

export function DayTable({ items }: { items: BudgetItem[] }) {
  const dayItems = items.filter(i => i.date === today() && (i.amount || i.estimate))

  const groups = new Map<string, BudgetItem[]>()
  for (const it of dayItems) {
    if (!groups.has(it.category)) groups.set(it.category, [])
    groups.get(it.category)!.push(it)
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
    <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Day budget">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Est.</th>
          <th scope="col">Act.</th>
        </tr>
      </thead>
      <tbody>
        {[...groups.entries()].map(([cat, its]) => (
          <>
            <tr key={cat}>
              <td style={{ fontWeight: 600 }}>{cat}</td>
              <td>{sumField(i => i.category === cat, 'estimate')}</td>
              <td>{sumField(i => i.category === cat, 'amount')}</td>
            </tr>
            {its.filter(i => i.amount || i.estimate).map(i => (
              <tr key={i.id}>
                <td style={{ paddingLeft: 'var(--space-md)' }}>{i.name}</td>
                <td>{i.estimate ?? ''}</td>
                <td>{i.amount || ''}</td>
              </tr>
            ))}
          </>
        ))}
        <tr><td style={{ fontWeight: 600 }}>Net Income</td><td>{estNet}</td><td>{netIncome}</td></tr>
        <tr><td style={{ fontWeight: 600 }}>Savings</td><td>{sumField(i => i.type === 'savings', 'estimate')}</td><td>{savings}</td></tr>
        <tr><td style={{ fontWeight: 600 }}>Expenses</td><td>{sumField(i => i.type === 'expense', 'estimate')}</td><td>{expenses}</td></tr>
      </tbody>
    </table>
  )
}
