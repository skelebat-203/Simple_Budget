import { useRef, useState } from 'react'
import { Button, ErrorSummary, FormDialog, focusFirstError } from './ui'
import { usePurchaseForm, type PurchaseSave } from './PurchaseForm'
import { NameTakenError } from '../storage/repository'
import { formatAmount, type CatNode } from '../budget/tree'
import type { BudgetItem } from '../storage/db'

/**
 * Day table purchase dialog (0009 §3, §4): the purchase as recorded, then the Add purchase form
 * prepopulated with it. Save replaces the record; Delete (right) removes it after a confirmation.
 * The caller stores the result; it may throw NameTakenError, which is shown on the field.
 */
export function PurchaseDialog({ id, title, roots, node, purchase, onSave, onDelete, onCancel }: {
  id: string
  title: string
  /** The whole tree, so Item can be changed to any row. */
  roots: CatNode[]
  node: CatNode
  purchase: BudgetItem
  onSave: (p: PurchaseSave) => Promise<string | void>
  onDelete: () => void
  onCancel: () => void
}) {
  const prefix = `${id}-`
  const form = usePurchaseForm(roots, { target: node, amount: purchase.amount.toFixed(2), description: purchase.description ?? '', date: purchase.date }, prefix)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const banner = useRef<HTMLDivElement>(null)

  async function submit() {
    setError('')
    const list = form.validate()
    if (list.length) { requestAnimationFrame(() => focusFirstError(list, banner.current)); return }
    setBusy(true)
    try {
      const e = await onSave(form.build())
      if (e) setError(e)
    } catch (err) {
      if (err instanceof NameTakenError) {
        const l = form.nameTaken(err.message)
        requestAnimationFrame(() => focusFirstError(l, banner.current))
      } else setError('Error: The purchase wasn’t saved. Try again.')
    }
    setBusy(false)
  }

  return (
    <FormDialog id={id} title={title} submitLabel="Save" className="purchase-dialog"
      onCancel={onCancel} onSubmit={submit} error={error} busy={busy}
      endButton={<Button type="button" className="danger" onClick={onDelete}>Delete</Button>}>
      <dl className="detail">
        <dt>Amount:</dt><dd>{formatAmount(purchase.amount) || '0.00'}</dd>
        <dt>Date:</dt><dd>{purchase.date}</dd>
      </dl>
      <ErrorSummary ref={banner} errors={form.errorList} />
      {form.fields}
      {form.useInFutureField}
    </FormDialog>
  )
}
