import { useState, useEffect } from 'react'
import { budgetItemRepo } from '../storage/repository'
import type { BudgetItem } from '../storage/db'
import { DayTable } from '../components/DayTable'
import { Button } from '../components/ui'
import { BudgetSetup } from './BudgetSetup'

export type BudgetView = 'day' | 'week' | 'month'

export function Budget({ refreshKey, defaultRange }: { refreshKey?: number; defaultRange: BudgetView }) {
  const [view, setView] = useState<BudgetView>(defaultRange)
  const [items, setItems] = useState<BudgetItem[]>([])
  const [showSetup, setShowSetup] = useState(false)
  const [range, setRange] = useState<BudgetView>(defaultRange)

  useEffect(() => {
    budgetItemRepo.list().then(setItems)
  }, [refreshKey])
  useEffect(() => {
    setView(defaultRange)
  }, [defaultRange])

  function reload() {
    budgetItemRepo.list().then(setItems)
  }

  return (
    <div className="form wide">
      <h2 id="budget-heading" className="section-title">Budget</h2>
      <div className="button-row">
        <Button type="button" onClick={() => setShowSetup(true)}>Set estimates</Button>
      </div>
      <div className="button-row">
        <Button type="button" onClick={() => setView('day')} disabled={view === 'day'} aria-pressed={view === 'day'}>Day</Button>
        <Button type="button" onClick={() => setView('week')} disabled={view === 'week'} aria-pressed={view === 'week'}>Week</Button>
        <Button type="button" onClick={() => setView('month')} disabled={view === 'month'} aria-pressed={view === 'month'}>Month</Button>
      </div>
      {view === 'day' ? (
        <DayTable items={items} />
      ) : (
        <table className="table" aria-labelledby="budget-heading">
          <caption>{view === 'week' ? 'Week' : 'Month'} view</caption>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Amount</th><th scope="col">Date</th></tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className="row-item"><td>{i.name}</td><td>{i.type}</td><td>{i.amount}</td><td>{i.date}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {showSetup && (
        <BudgetSetup
          onClose={() => setShowSetup(false)}
          defaultRange={range}
          onDefaultRangeChange={(v) => setRange(v)}
          onSaved={reload}
        />
      )}
    </div>
  )
}
