import { useState } from 'react'
import { budgetItemRepo } from '../storage/repository'
import { useEffect } from 'react'
import type { BudgetItem } from '../storage/db'

export function Budget() {
  const [view, setView] = useState<'day' | 'week'>('day')
  const [items, setItems] = useState<BudgetItem[]>([])

  useEffect(() => {
    budgetItemRepo.list().then(setItems)
  }, [])

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <h2>Budget</h2>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        <button onClick={() => setView('day')} disabled={view === 'day'}>Day</button>
        <button onClick={() => setView('week')} disabled={view === 'week'}>Week</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-labelledby="budget-heading">
      <caption id="budget-heading" className="sr-only">Budget items</caption>
        <thead>
          <tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Amount</th><th scope="col">Date</th></tr>
        </thead>
        <tbody>
          {items.map(i => (
            <tr key={i.id}><td>{i.name}</td><td>{i.type}</td><td>{i.amount}</td><td>{i.date}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
