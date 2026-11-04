import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

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
 */
export function ActionsMenu<T extends string>({ id, label, buttonLabel = 'Actions', items, onSelect }: {
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

  useEffect(() => { if (open) refs.current[active]?.focus() }, [open, active])

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
        aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? close() : show(0))} onKeyDown={onButtonKey}>
        {buttonLabel} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul id={`${id}-menu`} role="menu" aria-labelledby={id} className="menu" onKeyDown={onMenuKey}>
          {items.map((a, i) => (
            <li key={a.id} id={a.id} role="menuitem" tabIndex={-1} className="menu-item"
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
