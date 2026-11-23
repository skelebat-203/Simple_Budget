import type { ReactNode } from 'react'

/**
 * Expand/collapse control of a table row (0008 §1): a real button holding a decorative
 * icon and the row name, so the name is the button's accessible name.
 */
export function Expander({ open, onToggle, children, id, label, describedBy }: {
  open: boolean; onToggle: () => void; children: ReactNode; id?: string
  /** Accessible name when the visible name repeats elsewhere (e.g. "Car, Insurance"). */
  label?: string
  /** In a data table: the row header's id (digital_accessibility.md, Tables). */
  describedBy?: string
}) {
  return (
    <button type="button" className="expander" id={id} aria-expanded={open} aria-label={label} aria-describedby={describedBy} onClick={onToggle}>
      <span className="twisty" aria-hidden="true">{open ? '▾' : '▸'}</span>
      <span>{children}</span>
    </button>
  )
}

/** Expand/collapse chevron of a table row (0009 §3): the row's name is a separate button. */
export function Chevron({ open, onToggle, label, id, describedBy }: { open: boolean; onToggle: () => void; label: string; id?: string; describedBy?: string }) {
  return (
    <button type="button" className="chevron" id={id} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`} aria-describedby={describedBy} onClick={onToggle}>
      <span className="twisty" aria-hidden="true">{open ? '▾' : '▸'}</span>
    </button>
  )
}
