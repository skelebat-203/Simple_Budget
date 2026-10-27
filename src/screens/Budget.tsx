import { useState, useEffect } from 'react'
import { budgetItemRepo } from '../storage/repository'
import type { BudgetItem } from '../storage/db'
import { DayTable } from '../components/DayTable'
import { Button } from '../components/ui'

export function Budget({ refreshKey }: { refreshKey: number }) {
  const [view, setView] = useState<'day' | 'week'>('day')
  const [items, setItems] = useState<BudgetItem[]>([])

  useEffect(() => {
    budgetItemRepo.list().then(setItems)
  }, [refreshKey])

  return (
    <div style={{ padding: 'var(--space-md)', maxWidth: 800, margin: '0 auto' }}>
      <h2 id="budget-heading" style={{ color: 'var(--color-foreground-page)' }}>Budget</h2>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        <Button onClick={() => setView('day')} disabled={view === 'day'} aria-pressed={view === 'day'}>Day</Button>
        <Button onClick={() => setView('week')} disabled={view === 'week'} aria-pressed={view === 'week'}>Week</Button>
      </div>
      {view === 'day' ? (
        <DayTable items={items} />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-labelledby="budget-heading">
          <caption style={{ textAlign: 'left', marginBottom: 'var(--space-sm)' }}>Budget items</caption>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Amount</th><th scope="col">Date</th></tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}><td>{i.name}</td><td>{i.type}</td><td>{i.amount}</td><td>{i.date}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
