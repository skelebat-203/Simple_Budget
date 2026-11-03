import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Modal confirmation (v0.4 step 8). Native `<dialog>` opened with showModal so
 * the page behind is inert; Tab and Shift+Tab wrap inside it; Escape = Cancel.
 * Cancel left, Confirm right (0007 §4.2). Focus starts on Confirm. The caller moves focus after it closes.
 */
export function ConfirmDialog({ id, title, children, confirmLabel = 'Confirm', onConfirm, onCancel }: {
  id: string
  title: string
  children: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    d?.querySelector<HTMLButtonElement>('.confirm-ok')?.focus()
    return () => d?.close()
  }, [])

  return (
    <dialog ref={ref} id={id} className="dialog confirm-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`}
      onCancel={e => { e.preventDefault(); onCancel() }}
      onKeyDown={e => {
        if (e.key !== 'Tab') return
        const bs = [...e.currentTarget.querySelectorAll<HTMLElement>('button')]
        const i = bs.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length]?.focus()
      }}>
      <div className="dialog-body">
        <h2 id={`${id}-title`} className="section-title">{title}</h2>
        <p id={`${id}-desc`}>{children}</p>
        <div className="actions confirm-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn confirm-ok" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  )
}
