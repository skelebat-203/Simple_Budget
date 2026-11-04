import { useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { AmountField } from './AmountField'
import { Input } from './Input'
import { useAnnounce } from './announcer'
import { cleanDescription, cleanName, DESCRIPTION_MAX, moneyError, NAME_MAX, parseAmount } from '../../budget/validate'

/** What a dialog's save returns: an error message to show in the dialog, or nothing when it worked (the caller closes it). */
export type SaveResult = string | void

/**
 * Form inside a Dialog (0009 §4): Cancel at the left, the submit button at the right; Enter in a
 * field submits. `error` is a message for the whole form (e.g. a failed save); field errors are
 * shown by each dialog under its field. Messages go through the single live region.
 */
export function FormDialog({ id, title, className, submitLabel, onCancel, onSubmit, error, busy, endButton, children }: {
  id: string
  title: string
  className?: string
  submitLabel: string
  onCancel: () => void
  onSubmit: () => void
  error?: string
  busy?: boolean
  /** A button kept apart at the right (e.g. Delete); Cancel and the submit button then sit together at the left. */
  endButton?: ReactNode
  children: ReactNode
}) {
  useAnnounce(error ?? '')
  return (
    <Dialog id={id} title={title} className={`form-dialog ${className ?? ''}`.trim()} onClose={onCancel}
      buttons={endButton
        ? <>
          <span className="actions">
            <Button type="button" className="secondary" onClick={onCancel}>Cancel</Button>
            <Button type="submit" form={`${id}-form`} disabled={busy}>{submitLabel}</Button>
          </span>
          {endButton}
        </>
        : <>
          <Button type="button" className="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" form={`${id}-form`} disabled={busy}>{submitLabel}</Button>
        </>}>
      <form id={`${id}-form`} noValidate className="dialog-form" onSubmit={e => { e.preventDefault(); onSubmit() }}>
        {children}
        {error && <p className="error">{error}</p>}
      </form>
    </Dialog>
  )
}

/** A text field with its label above and its error below. */
function Field({ id, label, error, help, children }: { id: string; label: string; error?: string; help?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {help && <p id={`${id}-help`} className="help">{help}</p>}
      {error && <p id={`${id}-error_msg`} className="error">{error}</p>}
    </div>
  )
}

const describe = (id: string, error?: string, help?: boolean) =>
  [error && `${id}-error_msg`, help && `${id}-help`].filter(Boolean).join(' ') || undefined

/** Run a save and show its error, or leave closing to the caller. */
function useSaver() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function run(save: () => SaveResult | Promise<SaveResult>) {
    setBusy(true)
    const e = await save()
    setBusy(false)
    setError(e ?? '')
  }
  return { error, busy, run, setError }
}

/** Rename an item; a Category select moves it when its new place differs (0009 §4). */
export function RenameDialog({ id, spoken, name, parentId, parents, level, onSave, onCancel }: {
  id: string
  /** Accessible name of the row, e.g. "Car, Insurance". */
  spoken: string
  name: string
  parentId: number
  /** Where the row may live: its current parent and others at the same level. */
  parents: { id: number; label: string }[]
  /** "Category" for a subcategory, "Subcategory" for an item. */
  level: 'Category' | 'Subcategory'
  onSave: (name: string, parentId: number) => SaveResult | Promise<SaveResult>
  onCancel: () => void
}) {
  const [value, setValue] = useState(name)
  const [parent, setParent] = useState(parentId)
  const [fieldError, setFieldError] = useState('')
  const saver = useSaver()
  const input = useRef<HTMLInputElement>(null)
  const fieldId = `${id}-name`
  async function submit() {
    const clean = cleanName(value)
    if (!clean) { setFieldError(`Error: Name for ${spoken} cannot be empty`); input.current?.focus(); return }
    setFieldError('')
    if (clean === name && parent === parentId) return onCancel()
    await saver.run(() => onSave(clean, parent))
  }
  useAnnounce(fieldError)
  return (
    <FormDialog id={id} title={`Rename ${spoken}`} submitLabel="Save" onCancel={onCancel} onSubmit={submit} error={saver.error} busy={saver.busy}>
      <div className="banner banner-warn" role="note">
        <p className="banner-title">This changes ALL historic records.</p>
      </div>
      <Field id={fieldId} label="New name" error={fieldError}>
        <Input id={fieldId} ref={input} maxLength={NAME_MAX} value={value} autoComplete="off"
          aria-invalid={!!fieldError || undefined} aria-describedby={describe(fieldId, fieldError)}
          onChange={e => setValue(e.target.value)} />
      </Field>
      {parents.length > 1 && (
        <Field id={`${id}-category`} label={level} help="Choosing another one moves the item there.">
          <select id={`${id}-category`} className="input" value={parent} aria-describedby={`${id}-category-help`}
            onChange={e => setParent(Number(e.target.value))}>
            {parents.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
      )}
    </FormDialog>
  )
}

/**
 * Amount dialog (0009 §4.1): a new purchase (Day, category row; with a description), a change to a
 * purchase's amount (Day, purchase row), or a value added to or subtracted from an item's total
 * (Week, Month). Amounts accept typed sums.
 */
export function AmountDialog({ id, title, spoken, intro, initial, initialDescription, withDescription, submitLabel = 'Save', onSave, onDelete, onCancel }: {
  id: string
  title: string
  spoken: string
  /** One line of help above the amount. */
  intro: string
  initial?: string
  initialDescription?: string
  withDescription?: boolean
  submitLabel?: string
  onSave: (amount: number, description: string) => SaveResult | Promise<SaveResult>
  /** When given, a Delete button shows at the right of the footer. */
  onDelete?: () => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial ?? '')
  const [description, setDescription] = useState(initialDescription ?? '')
  const [fieldError, setFieldError] = useState('')
  const saver = useSaver()
  const fieldId = `${id}-amount`
  async function submit() {
    const r = parseAmount(value, { allowNegative: true })
    if (!r.ok) {
      setFieldError(moneyError(`Amount for ${spoken}`, r, '12.50, 12.50+3 or -12.50'))
      document.getElementById(fieldId)?.focus()
      return
    }
    setFieldError('')
    await saver.run(() => onSave(r.value, cleanDescription(description)))
  }
  useAnnounce(fieldError)
  return (
    <FormDialog id={id} title={title} submitLabel={submitLabel} onCancel={onCancel} onSubmit={submit} error={saver.error} busy={saver.busy}
      endButton={onDelete && <Button type="button" className="danger" onClick={onDelete}>Delete</Button>}>
      <p id={`${id}-intro`} className="help">{intro}</p>
      <Field id={fieldId} label="Amount" error={fieldError}>
        <AmountField id={fieldId} className="amount" allowNegative value={value}
          aria-invalid={!!fieldError || undefined} aria-describedby={[describe(fieldId, fieldError), `${id}-intro`].filter(Boolean).join(' ')}
          onFocus={e => { if (initial) e.target.select() }}
          onChange={e => setValue(e.target.value)} />
      </Field>
      {withDescription && (
        <Field id={`${id}-description`} label="Description (optional)">
          <Input id={`${id}-description`} maxLength={DESCRIPTION_MAX} value={description} autoComplete="off"
            onChange={e => setDescription(e.target.value)} />
        </Field>
      )}
    </FormDialog>
  )
}
