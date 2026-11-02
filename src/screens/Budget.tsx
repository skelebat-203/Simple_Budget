import { useState } from 'react'
import type { BudgetItem, Range } from '../storage/db'
import type { Calendar, CatNode } from '../budget/tree'
import { BudgetTable } from '../components/BudgetTable'
import { Button } from '../components/ui'

const RANGES: { value: Range; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

export function Budget({ roots, items, range, onRangeChange, calendar }: {
  roots: CatNode[]
  calendar: Calendar
  items: BudgetItem[]
  range: Range
  onRangeChange: (r: Range) => void
}) {
  const [showEstimates, setShowEstimates] = useState(true)
  return (
    <section className="panel wide" aria-labelledby="budget-heading">
      <h2 id="budget-heading" className="section-title">Budget</h2>
      <div className="toolbar">
        <div className="toggle-group" role="group" aria-label="Range">
          {RANGES.map(r => (
            <Button key={r.value} type="button" className="toggle" aria-pressed={range === r.value} onClick={() => onRangeChange(r.value)}>
              {r.label}
            </Button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={showEstimates} onChange={e => setShowEstimates(e.target.checked)} />
          Show estimates
        </label>
      </div>
      <BudgetTable roots={roots} items={items} range={range} showEstimates={showEstimates} calendar={calendar} />
    </section>
  )
}
