import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'

export interface Tab { id: string; label: string; panel: ReactNode }
/** A command shown beside the tabs (wide) or as a menu item (narrow), e.g. opening a dialog. */
export interface TabAction { id: string; label: string; onSelect: () => void }

const WIDE = '(min-width: 1280px)'
const subscribe = (cb: () => void) => { const m = matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) }
const useWide = () => useSyncExternalStore(subscribe, () => matchMedia(WIDE).matches)

/**
 * Screen switcher (0007 §6, §10). Large screens: ARIA tabs (Left/Right with
 * wrap, Home/End) with actions as buttons on the tab row. Small and medium
 * screens: a "Screens" menu button listing the screens and the actions.
 * Hidden panels stay mounted so a half-filled form keeps its values.
 */
export function Tabs({ label, tabs, actions = [] }: { label: string; tabs: Tab[]; actions?: TabAction[] }) {
  const wide = useWide()
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
      {wide
        ? (
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
            {actions.map(a => (
              <button key={a.id} type="button" id={a.id} className="btn secondary" onClick={a.onSelect}>{a.label}</button>
            ))}
          </div>
        )
        : <ScreensMenu tabs={tabs} actions={actions} current={current} onPick={id => {
          setCurrent(id)
          // New screen: focus its heading (SPA navigation rule).
          requestAnimationFrame(() => {
            const h = document.querySelector<HTMLElement>(`#tabpanel-${id} h2`)
            if (h) { h.tabIndex = -1; h.focus() }
          })
        }} />}
      {tabs.map(t => (
        <div key={t.id} id={`tabpanel-${t.id}`} hidden={current !== t.id}
          {...(wide ? { role: 'tabpanel', 'aria-labelledby': `tab-${t.id}`, tabIndex: 0, className: 'tabpanel' } : { className: 'screen' })}>
          {t.panel}
        </div>
      ))}
    </div>
  )
}

/** Menu button pattern: Enter/Space/Down opens; Up/Down/Home/End move; Enter picks; Escape/Tab close. */
function ScreensMenu({ tabs, actions, current, onPick }: {
  tabs: Tab[]; actions: TabAction[]; current: string; onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const items = useRef<(HTMLLIElement | null)[]>([])
  const entries = [...tabs.map(t => ({ id: t.id, label: t.label, screen: true })), ...actions.map(a => ({ id: a.id, label: a.label, screen: false }))]

  useEffect(() => { if (open) items.current[active]?.focus() }, [open, active])

  function show(at = Math.max(0, entries.findIndex(e => e.id === current))) { setActive(at); setOpen(true) }
  function close(focusButton = true) { setOpen(false); if (focusButton) button.current?.focus() }
  function pick(i: number) {
    const e = entries[i]
    close()
    if (e.screen) onPick(e.id)
    else actions.find(a => a.id === e.id)?.onSelect()
  }

  return (
    <div className="menu-wrap">
      <button ref={button} type="button" id="screens-button" className="btn secondary menu-button"
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'screens-menu' : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); show() }
          else if (e.key === 'ArrowUp') { e.preventDefault(); show(entries.length - 1) }
        }}>
        Screens <span className="menu-current">({tabs.find(t => t.id === current)?.label})</span> <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul id="screens-menu" role="menu" aria-labelledby="screens-button" className="menu"
          onKeyDown={e => {
            const to = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: entries.length - 1 }[e.key]
            if (to !== undefined) { e.preventDefault(); setActive((to + entries.length) % entries.length) }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active) }
            else if (e.key === 'Escape') { e.preventDefault(); close() }
            else if (e.key === 'Tab') close(false)
          }}>
          {entries.map((e, i) => (
            <li key={e.id} role={e.screen ? 'menuitemradio' : 'menuitem'} aria-checked={e.screen ? e.id === current : undefined}
              tabIndex={-1} ref={el => { items.current[i] = el }} className="menu-item"
              onClick={() => pick(i)} onMouseEnter={() => setActive(i)}>
              {e.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
