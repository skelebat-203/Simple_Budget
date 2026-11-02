import { useState } from 'react'
import type { BudgetItem, Range } from '../storage/db'
import { rangeHasEstimates, type Calendar, type CatNode } from '../budget/tree'
import { BudgetTable } from '../components/BudgetTable'
import { Button } from '../components/ui'

const RANGES: { value: Range; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Annual' },
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
          <input type="checkbox" checked={showEstimates && rangeHasEstimates(range)} aria-disabled={!rangeHasEstimates(range) || undefined}
            aria-describedby="estimates-help"
            onChange={e => { if (rangeHasEstimates(range)) setShowEstimates(e.target.checked) }} />
          Show estimates
        </label>
        <p id="estimates-help" className="help">Estimates show in Week and Month. Day and Annual show what you recorded.</p>
      </div>
      <BudgetTable roots={roots} items={items} range={range} showEstimates={showEstimates} calendar={calendar} />
    </section>
  )
}
