import type { ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'

/** Confirmation built on Dialog (v0.4 step 8): Cancel left, Confirm right; Escape = Cancel. The caller moves focus after it closes. */
export function ConfirmDialog({ id, title, children, confirmLabel = 'Confirm', onConfirm, onCancel }: {
  id: string
  title: string
  children: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog id={id} title={title} className="confirm-dialog" describedBy={`${id}-desc`} onClose={onCancel}
      buttons={<>
        <Button type="button" className="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="button" className="confirm-ok" onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      <p id={`${id}-desc`}>{children}</p>
    </Dialog>
  )
}
