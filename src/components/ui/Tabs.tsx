import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface Tab { id: string; label: string; panel: ReactNode }

/**
 * ARIA tabs pattern (0007 §6): one panel shows at a time; Left/Right arrows
 * move between tabs and select them, Home/End jump to the first/last. Hidden
 * panels stay mounted so a half-filled form keeps its values. `aside` sits on
 * the tab list row, outside the tab list (e.g. a button that opens a dialog).
 */
export function Tabs({ label, tabs, aside }: { label: string; tabs: Tab[]; aside?: ReactNode }) {
  const [current, setCurrent] = useState(tabs[0].id)
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  function select(i: number) {
    const t = tabs[(i + tabs.length) % tabs.length]
    setCurrent(t.id)
    refs.current[t.id]?.focus()
  }

  function onKeyDown(e: KeyboardEvent, i: number) {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    select(to)
  }

  return (
    <div className="tabs">
      <div className="tab-row">
        <div role="tablist" aria-label={label} className="tablist">
        {tabs.map((t, i) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} className="tab"
            ref={el => { refs.current[t.id] = el }}
            aria-selected={current === t.id} aria-controls={`tabpanel-${t.id}`}
            tabIndex={current === t.id ? 0 : -1}
            onClick={() => setCurrent(t.id)} onKeyDown={e => onKeyDown(e, i)}>
            {t.label}
          </button>
        ))}
        </div>
        {aside}
      </div>
      {tabs.map(t => (
        <div key={t.id} role="tabpanel" id={`tabpanel-${t.id}`} aria-labelledby={`tab-${t.id}`}
          className="tabpanel" tabIndex={0} hidden={current !== t.id}>
          {t.panel}
        </div>
      ))}
    </div>
  )
}
