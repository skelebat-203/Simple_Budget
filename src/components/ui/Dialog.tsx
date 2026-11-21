import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE = 'button:not([disabled]), summary, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Controls Tab can reach: visible ones only, and one stop per radio group (the checked radio, else the first). */
function tabStops(root: HTMLElement): HTMLElement[] {
  const stops = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.getClientRects().length > 0)
  return stops.filter(el => {
    if (!(el instanceof HTMLInputElement) || el.type !== 'radio' || !el.name) return true
    const group = stops.filter((o): o is HTMLInputElement => o instanceof HTMLInputElement && o.type === 'radio' && o.name === el.name && o.form === el.form)
    return el === (group.find(o => o.checked) ?? group[0])
  })
}

/**
 * Generic modal dialog (v0.4 step 8). Native `<dialog>` opened with showModal,
 * so the page behind is inert. Focus starts on the dialog itself (tabIndex -1),
 * Tab and Shift+Tab wrap inside it, Escape calls `onClose`, and focus returns
 * to what had it before the dialog opened unless the caller moves it.
 * Title, content and buttons come from the caller; buttons go Cancel left, Confirm right (0007 §4.2).
 */
export function Dialog({ id, title, children, buttons, onClose, className, describedBy, footerClassName }: {
  id: string
  title: ReactNode
  children: ReactNode
  /** The action buttons, in visual order. */
  buttons: ReactNode
  /** Escape (the dialog's cancel). */
  onClose: () => void
  className?: string
  /** Id of the content element that describes the dialog, if any. */
  describedBy?: string
  /** Extra class for the button row (for example the sticky review footer). */
  footerClassName?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    const opener = document.activeElement as HTMLElement | null
    if (d && !d.open) d.showModal()
    d?.focus()
    return () => {
      d?.close()
      // Back to the opener unless the caller already moved focus elsewhere.
      if (opener?.isConnected && (document.activeElement === document.body || !document.activeElement)) opener.focus()
    }
  }, [])

  return (
    <dialog ref={ref} id={id} tabIndex={-1} className={`dialog ${className ?? ''}`.trim()} aria-modal="true"
      aria-labelledby={`${id}-title`} aria-describedby={describedBy}
      onCancel={e => { e.preventDefault(); if (e.target === e.currentTarget) onClose() }} // a dialog opened from this one's React tree must not close this one too
      onKeyDown={e => {
        if (e.key !== 'Tab') return
        const f = tabStops(e.currentTarget)
        if (!f.length) return
        e.preventDefault()
        e.stopPropagation() // a dialog opened from another dialog's React tree must not run that one's trap too
        const i = f.indexOf(document.activeElement as HTMLElement)
        // From the dialog itself, Tab goes to the first control and Shift+Tab to the last.
        const next = i < 0 ? (e.shiftKey ? f.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length
        f[next].focus()
      }}>
      <div className="dialog-body">
        <h2 id={`${id}-title`} className="section-title">{title}</h2>
        {children}
        <div className={`actions dialog-actions ${footerClassName ?? ''}`.trim()}>{buttons}</div>
      </div>
    </dialog>
  )
}
