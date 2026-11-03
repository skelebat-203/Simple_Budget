import { useRef, useState } from 'react'
import type { BudgetItem, Range } from '../storage/db'
import { isoDate, parseIso, periodsFor, rangeHasEstimates, shiftRange, type Calendar, type CatNode } from '../budget/tree'
import { dateBounds } from '../budget/validate'
import { BudgetTable } from '../components/BudgetTable'
import { Button, DatePicker } from '../components/ui'

const RANGES: { value: Range; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'annual', label: 'Annual' },
]

/** Noun for the Previous / Next button names. */
const UNIT: Record<Range, string> = { day: 'day', week: 'week', month: 'month', annual: 'year' }

export function Budget({ roots, items, range, onRangeChange, calendar, onChanged }: {
  roots: CatNode[]
  onChanged: () => void
  calendar: Calendar
  items: BudgetItem[]
  range: Range
  onRangeChange: (r: Range) => void
}) {
  const [showEstimates, setShowEstimates] = useState(true)
  // Date nav (0007 §9.5): the shown range contains `anchor`; defaults to today.
  const [anchor, setAnchor] = useState(() => new Date())
  const [bounds] = useState(() => dateBounds(new Date()))
  const [picking, setPicking] = useState(false)
  // The field keeps what's typed; partial years (e.g. "0002") must not reset it.
  const [draft, setDraft] = useState('')
  const pickerButton = useRef<HTMLButtonElement>(null)
  const { columns, total, title } = periodsFor(range, anchor, calendar)
  const shown = total ?? columns[0]
  const prev = shiftRange(range, anchor, calendar, -1)
  const next = shiftRange(range, anchor, calendar, 1)
  const closePicker = () => { setPicking(false); pickerButton.current?.focus() }
  return (
    <section className="panel wide" aria-labelledby="budget-heading">
      <h2 id="budget-heading" className="section-title">Budget</h2>
      <div className="toolbar">
        <div className="toggle-group ranges" role="group" aria-label="Range">
          {RANGES.map(r => (
            <Button key={r.value} type="button" className="toggle" aria-pressed={range === r.value} onClick={() => onRangeChange(r.value)}>
              {r.label}
            </Button>
          ))}
        </div>
        {/* Estimates exist only in Week and Month, so the toggle shows only there (0004, roadmap v0.4). */}
        {rangeHasEstimates(range) && (
          <label className="check">
            <input type="checkbox" checked={showEstimates} onChange={e => setShowEstimates(e.target.checked)} />
            Show estimates
          </label>
        )}
      </div>
      <nav className="toolbar" aria-label="Date range">
        <Button type="button" className="secondary" disabled={shown.from <= bounds.min} onClick={() => setAnchor(prev)}>
          Previous {UNIT[range]}
        </Button>
        <button type="button" className="btn secondary" ref={pickerButton} aria-expanded={picking} aria-controls="nav_date-popover"
          aria-label={`${title}, choose a date`} onClick={() => { setDraft(isoDate(anchor)); setPicking(p => !p) }}>
          {title}
        </button>
        <Button type="button" className="secondary" disabled={shown.to >= bounds.max} onClick={() => setAnchor(next)}>
          Next {UNIT[range]}
        </Button>
      </nav>
      {picking && (
        <div id="nav_date-popover" className="field" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); closePicker() } }}>
          <label className="label" htmlFor="nav_date">Go to date</label>
          <p id="nav_date-help" className="help">Shows the {UNIT[range]} that contains this date. Escape closes.</p>
          <DatePicker id="nav_date" aria-describedby="nav_date-help" autoFocus value={draft} min={bounds.min} max={bounds.max}
            onChange={e => { const v = e.target.value; setDraft(v); if (v && v >= bounds.min && v <= bounds.max) setAnchor(parseIso(v)) }} />
        </div>
      )}
      <BudgetTable date={anchor} roots={roots} items={items} range={range} showEstimates={showEstimates} calendar={calendar} onChanged={onChanged} />
    </section>
  )
}
