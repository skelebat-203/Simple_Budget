import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

/** Space kept between a floating menu and the window edge. */
const VIEWPORT_GAP_PX = 8

/** A menu item: `id` is its DOM id; `value` is passed to onSelect. */
export type MenuAction<T extends string = string> = { id: string; label: string; value: T }

/**
 * Row actions menu (menu button pattern, v0.4 step 7). One button per row so
 * the Actions column lines up.
 *
 * - Enter, Space or Down opens on the first item; Up opens on the last.
 * - Up/Down (wrapping), Home/End move; Enter or Space picks; Escape closes;
 *   Tab closes. Focus returns to the button, then the picked action may move it.
 * - Keys it handles don't reach a surrounding treegrid.
 * - The menu is placed against the window, never past its edges, so a scrolling
 *   table box or a dialog can't clip it (D006).
 */
export function ActionsMenu<T extends string>({ id, label, buttonLabel = 'Actions', items, onSelect, describedBy }: {
  /** In a data table: the row header's id, on the button and each item (digital_accessibility.md, Tables). */
  describedBy?: string
  /** Button id; the menu is `{id}-menu`. */
  id: string
  /** Accessible name of the button, e.g. "Actions for Rent". */
  label: string
  /** Visible text of the button; default "Actions". */
  buttonLabel?: string
  items: MenuAction<T>[]
  onSelect: (value: T) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const refs = useRef<(HTMLLIElement | null)[]>([])

  const [place, setPlace] = useState<CSSProperties | undefined>()
  // Below the button, or above it when there is more room there; right edges line up.
  useLayoutEffect(() => {
    if (!open || !button.current) { setPlace(undefined); return }
    const b = button.current.getBoundingClientRect()
    const below = innerHeight - b.bottom - VIEWPORT_GAP_PX, above = b.top - VIEWPORT_GAP_PX
    const down = below >= above
    // Right edges line up unless there is more room to the right; the menu never leaves the window.
    const roomLeft = b.right - VIEWPORT_GAP_PX, roomRight = innerWidth - b.left - VIEWPORT_GAP_PX
    setPlace({
      position: 'fixed', boxSizing: 'border-box',
      ...(roomLeft >= roomRight
        ? { right: Math.max(VIEWPORT_GAP_PX, innerWidth - b.right), left: 'auto', maxWidth: roomLeft }
        : { left: Math.max(VIEWPORT_GAP_PX, b.left), right: 'auto', maxWidth: roomRight }),
      minWidth: `min(var(--size-menu-row-min), ${Math.max(roomLeft, roomRight)}px)`,
      ...(down ? { top: b.bottom, bottom: 'auto' } : { bottom: innerHeight - b.top, top: 'auto' }),
      maxHeight: `min(var(--size-menu-max-h), ${Math.max(down ? below : above, 0)}px)`,
    })
  }, [open])
  useEffect(() => { if (open && place) refs.current[active]?.focus() }, [open, active, place])

  function show(at: number) { setActive(at); setOpen(true) }
  function close(focusButton = true) { setOpen(false); if (focusButton) button.current?.focus() }
  function pick(i: number) { close(); onSelect(items[i].value) }

  function onButtonKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation()
      show(e.key === 'ArrowDown' ? 0 : items.length - 1)
    }
  }
  function onMenuKey(e: KeyboardEvent<HTMLUListElement>) {
    const to = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: items.length - 1 }[e.key]
    if (to !== undefined) setActive((to + items.length) % items.length)
    else if (e.key === 'Enter' || e.key === ' ') pick(active)
    else if (e.key === 'Escape' || e.key === 'Tab') close()
    else return
    e.preventDefault(); e.stopPropagation()
  }

  return (
    <div className="menu-wrap actions-menu"
      onBlur={e => { if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) close(false) }}>
      <button ref={button} type="button" id={id} className="btn secondary small menu-button"
        aria-label={label} aria-describedby={describedBy} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? close() : show(0))} onKeyDown={onButtonKey}>
        {buttonLabel} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul id={`${id}-menu`} role="menu" aria-labelledby={id} className="menu" style={place} onKeyDown={onMenuKey}>
          {items.map((a, i) => (
            <li key={a.id} id={a.id} role="menuitem" tabIndex={-1} className="menu-item" aria-describedby={describedBy}
              ref={el => { refs.current[i] = el }}
              onClick={() => pick(i)} onMouseEnter={() => setActive(i)}>
              {a.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
