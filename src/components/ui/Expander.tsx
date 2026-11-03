import type { ReactNode } from 'react'

/**
 * Expand/collapse control of a table row (0008 §1): a real button holding a decorative
 * icon and the row name, so the name is the button's accessible name.
 */
export function Expander({ open, onToggle, children, id }: { open: boolean; onToggle: () => void; children: ReactNode; id?: string }) {
  return (
    <button type="button" className="expander" id={id} aria-expanded={open} onClick={onToggle}>
      <span className="twisty" aria-hidden="true">{open ? '▾' : '▸'}</span>
      <span>{children}</span>
    </button>
  )
}
