import { useEffect, useRef, useState } from 'react'
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
  const popover = useRef<HTMLDivElement>(null)
  const { columns, total, title } = periodsFor(range, anchor, calendar)
  const shown = total ?? columns[0]
  const prev = shiftRange(range, anchor, calendar, -1)
  const next = shiftRange(range, anchor, calendar, 1)
  /** Place the popover under the title button, kept inside the viewport (v0.4 review: visible frame). */
  const place = () => {
    const b = pickerButton.current, p = popover.current
    if (!b || !p) return
    const r = b.getBoundingClientRect(), gap = 8, vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight
    // 100vw counts the scrollbar, so cap the width to the layout viewport here.
    p.style.maxWidth = `${vw - 2 * gap}px`
    const left = Math.max(gap, Math.min(r.left, vw - p.offsetWidth - gap))
    const below = r.bottom + 4
    const top = below + p.offsetHeight <= vh - gap ? below : Math.max(gap, r.top - 4 - p.offsetHeight)
    p.style.left = `${left}px`; p.style.top = `${top}px`
  }
  useEffect(() => {
    if (!picking) return
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [picking])
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
        {/* Go to date: a native popover anchored to the title (v0.4 review). Escape and outside clicks close it; focus returns here. */}
        <button type="button" className="btn secondary" ref={pickerButton} id="nav_date-button" aria-expanded={picking} aria-controls="nav_date-popover"
          aria-label={`${title}, choose a date`} popoverTarget="nav_date-popover">
          {title}
        </button>
        <Button type="button" className="secondary" disabled={shown.to >= bounds.max} onClick={() => setAnchor(next)}>
          Next {UNIT[range]}
        </Button>
      </nav>
      <div id="nav_date-popover" ref={popover} popover="auto" className="popover field" aria-labelledby="nav_date-label"
        onBeforeToggle={e => { if (e.newState === 'open') setDraft(isoDate(anchor)) }}
        onToggle={e => {
          const open = e.newState === 'open'
          setPicking(open)
          if (open) { place(); document.getElementById('nav_date')?.focus() }
        }}>
        <label className="label" id="nav_date-label" htmlFor="nav_date">Go to date</label>
        <p id="nav_date-help" className="help">Shows the {UNIT[range]} that contains this date. Escape closes.</p>
        <DatePicker id="nav_date" aria-describedby="nav_date-help" value={draft} min={bounds.min} max={bounds.max}
          onChange={e => { const v = e.target.value; setDraft(v); if (v && v >= bounds.min && v <= bounds.max) setAnchor(parseIso(v)) }} />
      </div>
      <BudgetTable date={anchor} roots={roots} items={items} range={range} showEstimates={showEstimates} calendar={calendar} onChanged={onChanged} />
    </section>
  )
}
