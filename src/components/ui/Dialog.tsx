import { useEffect, useRef, type ReactNode, type Ref } from 'react'
import { Button } from './Button'
import { useAnnounce } from './announcer'

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

/** A confirmation: the children are its message; Cancel left, Confirm right (0007 §4.2). */
export interface ConfirmMode {
  label?: string
  onConfirm: () => void
  /** A Delete: the confirm button is danger red (0012 G3). */
  danger?: boolean
}

/** A form: Cancel left, the submit button right; Enter in a field submits (0009 §4). */
export interface FormMode {
  submitLabel: string
  onSubmit: () => void
  /** A message for the whole form (e.g. a failed save), shown below the fields and announced. */
  error?: string
  busy?: boolean
  /** A button kept apart at the right (e.g. Delete); Cancel and the submit button then sit together at the left. */
  endButton?: ReactNode
}

/**
 * The app's one modal dialog (v0.7 step 1). Native `<dialog>` opened with showModal,
 * so the page behind is inert. Focus starts on the dialog itself (tabIndex -1),
 * Tab and Shift+Tab wrap inside it, Escape calls `onClose`, and focus returns
 * to what had it before the dialog opened unless the caller moves it.
 * The footer is one of: `confirm` (a message with Cancel and Confirm), `form`
 * (the children are the fields; Cancel and a submit button), or `buttons` (caller-made).
 */
export function Dialog({ id, title, children, buttons, confirm, form, onClose, className, describedBy, footerClassName, footerRef, suspended }: {
  id: string
  title: ReactNode
  children: ReactNode
  /** Custom action buttons, in visual order. */
  buttons?: ReactNode
  confirm?: ConfirmMode
  form?: FormMode
  /** Escape (the dialog's cancel). */
  onClose: () => void
  className?: string
  /** Id of the content element that describes the dialog, if any. */
  describedBy?: string
  /** Extra class for the button row (for example the sticky review footer). */
  footerClassName?: string
  /** Ref to the button row, for a caller that measures it. */
  footerRef?: Ref<HTMLDivElement>
  /** Closed for a while but kept mounted (state kept), e.g. while the Google Picker is open: it can't take clicks under a modal dialog. */
  suspended?: boolean
}) {
  useAnnounce(form?.error ?? '')
  const ref = useRef<HTMLDialogElement>(null)
  const cancel = <Button type="button" className="secondary" onClick={onClose}>Cancel</Button>
  const formId = `${id}-form`
  const submit = form && <Button type="submit" form={formId} disabled={form.busy}>{form.submitLabel}</Button>
  const footer = confirm ? <>{cancel}<Button type="button" className={confirm.danger ? 'confirm-ok danger' : 'confirm-ok'} onClick={confirm.onConfirm}>{confirm.label ?? 'Confirm'}</Button></>
    : form ? (form.endButton ? <><span className="actions">{cancel}{submit}</span>{form.endButton}</> : <>{cancel}{submit}</>)
    : buttons
  const kind = confirm ? 'confirm-dialog' : form ? 'form-dialog' : ''
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
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (suspended && d.open) d.close()
    else if (!suspended && !d.open) d.showModal()
  }, [suspended])

  return (
    <dialog ref={ref} id={id} tabIndex={-1} className={`dialog ${kind} ${className ?? ''}`.replace(/\s+/g, ' ').trim()} aria-modal="true"
      aria-labelledby={`${id}-title`} aria-describedby={describedBy ?? (confirm ? `${id}-desc` : undefined)}
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
        {confirm ? <p id={`${id}-desc`}>{children}</p>
          : form ? (
            <form id={formId} noValidate className="dialog-form" onSubmit={e => { e.preventDefault(); form.onSubmit() }}>
              {children}
              {form.error && <p className="error">{form.error}</p>}
            </form>
          )
          : children}
        <div ref={footerRef} className={`actions dialog-actions ${footerClassName ?? ''}`.trim()}>{footer}</div>
      </div>
    </dialog>
  )
}
