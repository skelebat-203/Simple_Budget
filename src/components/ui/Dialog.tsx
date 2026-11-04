import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Generic modal dialog (v0.4 step 8). Native `<dialog>` opened with showModal,
 * so the page behind is inert. Focus starts on the dialog itself (tabIndex -1),
 * Tab and Shift+Tab wrap inside it, Escape calls `onClose`, and focus returns
 * to what had it before the dialog opened unless the caller moves it.
 * Title, content and buttons come from the caller; buttons go Cancel left, Confirm right (0007 §4.2).
 */
export function Dialog({ id, title, children, buttons, onClose, className, describedBy, focusId }: {
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
  /** Id of the control that takes focus on open (a form's first field); default is the dialog itself. */
  focusId?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    const opener = document.activeElement as HTMLElement | null
    if (d && !d.open) d.showModal()
    const first = focusId ? document.getElementById(focusId) : null
    if (first) first.focus(); else d?.focus()
    return () => {
      d?.close()
      // Back to the opener unless the caller already moved focus elsewhere.
      if (opener?.isConnected && (document.activeElement === document.body || !document.activeElement)) opener.focus()
    }
  }, [focusId])

  return (
    <dialog ref={ref} id={id} tabIndex={-1} className={`dialog ${className ?? ''}`.trim()} aria-modal="true"
      aria-labelledby={`${id}-title`} aria-describedby={describedBy}
      onCancel={e => { e.preventDefault(); onClose() }}
      onKeyDown={e => {
        if (e.key !== 'Tab') return
        const f = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)]
        if (!f.length) return
        e.preventDefault()
        const i = f.indexOf(document.activeElement as HTMLElement)
        // From the dialog itself, Tab goes to the first control and Shift+Tab to the last.
        const next = i < 0 ? (e.shiftKey ? f.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length
        f[next].focus()
      }}>
      <div className="dialog-body">
        <h2 id={`${id}-title`} className="section-title">{title}</h2>
        {children}
        <div className="actions dialog-actions">{buttons}</div>
      </div>
    </dialog>
  )
}
