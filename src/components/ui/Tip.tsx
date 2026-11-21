import { useId, useState, type ReactNode } from 'react'

/**
 * Tooltip for one focusable control (WCAG 1.4.13): the note shows on hover or keyboard focus, stays while the pointer is
 * over it, and Escape hides it without closing anything around it. The control is described by the note (`aria-describedby`),
 * so a screen reader reads it with the control's name. `children` gets the id to put on the control.
 */
export function Tip({ text, children }: { text: string; children: (describedBy: string) => ReactNode }) {
  const id = useId()
  const [hidden, setHidden] = useState(false)
  return (
    <span className={`tip-wrap tip-start${hidden ? ' tip-off' : ''}`} onMouseLeave={() => setHidden(false)} onBlur={() => setHidden(false)}
      onKeyDown={e => { if (e.key === 'Escape' && !hidden) { e.preventDefault(); e.stopPropagation(); setHidden(true) } }}>
      {children(id)}
      <span id={id} role="tooltip" className="tooltip">{text}</span>
    </span>
  )
}
