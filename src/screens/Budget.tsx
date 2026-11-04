import { useRef, useState } from 'react'
import type { BudgetItem, Range } from '../storage/db'
import { isoDate, parseIso, periodsFor, rangeHasEstimates, shiftRange, type Calendar, type CatNode } from '../budget/tree'
import { dateBounds } from '../budget/validate'
import { BudgetTable } from '../components/BudgetTable'
import { Button } from '../components/ui'

const RANGES: { value: Range; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'annual', label: 'Annual' },
]

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20">
    <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

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
  /** Set when the browser can't open its calendar from a button: the date field shows instead. */
  const [fallback, setFallback] = useState(false)
  const dateInput = useRef<HTMLInputElement>(null)
  const pickerButton = useRef<HTMLButtonElement>(null)
  const { columns, total, title } = periodsFor(range, anchor, calendar)
  const shown = total ?? columns[0]
  const prev = shiftRange(range, anchor, calendar, -1)
  const next = shiftRange(range, anchor, calendar, 1)
  /** The range title opens the browser's calendar directly (0008 §5). */
  const openCalendar = () => {
    const input = dateInput.current
    try {
      if (!input || typeof input.showPicker !== 'function') throw new Error('unsupported')
      input.showPicker()
    } catch { setFallback(true) }
  }
  const pick = (v: string) => { if (v && v >= bounds.min && v <= bounds.max) setAnchor(parseIso(v)) }
  return (
    <section className="panel wide" aria-labelledby="budget-heading">
      <h2 id="budget-heading" className="sr-only">Budget</h2>
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
        <Button type="button" className="secondary icon" disabled={shown.from <= bounds.min} onClick={() => setAnchor(prev)}
          aria-label={`Previous ${UNIT[range]}`}>
          <Chevron dir="left" />
        </Button>
        {/* The title opens the browser calendar; the date input is a hidden helper the calendar attaches to. */}
        <span className="date-nav-title">
          <button type="button" className="btn secondary" ref={pickerButton} id="nav_date-button"
            aria-label={`${title}, choose a date`} onClick={openCalendar}>
            {title}
          </button>
          <input type="date" ref={dateInput} id="nav_date" className={fallback ? 'input' : 'date-helper'}
            tabIndex={fallback ? 0 : -1} aria-hidden={fallback ? undefined : true} aria-label={`Go to date: shows the ${UNIT[range]} that contains it`}
            min={bounds.min} max={bounds.max} value={isoDate(anchor)}
            onChange={e => { pick(e.target.value); if (!fallback) pickerButton.current?.focus() }} />
        </span>
        <Button type="button" className="secondary icon" disabled={shown.to >= bounds.max} onClick={() => setAnchor(next)}
          aria-label={`Next ${UNIT[range]}`}>
          <Chevron dir="right" />
        </Button>
      </nav>
      <BudgetTable date={anchor} roots={roots} items={items} range={range} showEstimates={showEstimates} calendar={calendar} onChanged={onChanged} />
    </section>
  )
}
