import { useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { AmountField } from './AmountField'
import { DatePicker } from './DatePicker'
import { Input } from './Input'
import { useAnnounce } from './announcer'
import { cleanDescription, cleanName, DESCRIPTION_MAX, moneyError, NAME_MAX, parseAmount } from '../../budget/validate'

/** What a dialog's save returns: an error message to show in the dialog, or nothing when it worked (the caller closes it). */
export type SaveResult = string | void

/** A field: label, help, control, error, in that order (0012 §4). Required fields show `*` (G5). */
function Field({ id, label, error, help, required, children }: { id: string; label: string; error?: string; help?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className={help ? 'field' : 'field field-align'}>
      <label className="label" htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
      {help && <p id={`${id}-help`} className="help">{help}</p>}
      {children}
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
    <Dialog id={id} title={`Rename ${spoken}`} onClose={onCancel} form={{ submitLabel: 'Save', onSubmit: submit, error: saver.error, busy: saver.busy }}>
      <div className="banner banner-warn" role="note">
        <p className="banner-title">This changes ALL historic records.</p>
      </div>
      <Field id={fieldId} label="New name" error={fieldError} required>
        <Input id={fieldId} ref={input} maxLength={NAME_MAX} value={value} autoComplete="off" aria-required="true"
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
    </Dialog>
  )
}

/**
 * Amount dialog (0009 §4.1): a new purchase (Day, category row; with a description), a change to a
 * purchase's amount (Day, purchase row), or a value added to or subtracted from an item's total
 * (Week, Month). Amounts accept typed sums.
 */
export function AmountDialog({ id, title, spoken, intro, initial, initialDescription, withDescription, dateField, submitLabel = 'Save', onSave, onDelete, onCancel }: {
  id: string
  title: string
  spoken: string
  /** Help for the Amount field, shown between its label and the box. */
  intro: string
  initial?: string
  initialDescription?: string
  withDescription?: boolean
  /** Shows a date picker limited to min..max (the period being viewed, 0009 §4.1). */
  dateField?: { initial: string; min: string; max: string }
  submitLabel?: string
  onSave: (amount: number, description: string, date: string) => SaveResult | Promise<SaveResult>
  /** When given, a Delete button shows at the right of the footer. */
  onDelete?: () => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial ?? '')
  const [description, setDescription] = useState(initialDescription ?? '')
  const [date, setDate] = useState(dateField?.initial ?? '')
  const [dateError, setDateError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const saver = useSaver()
  const fieldId = `${id}-amount`
  const dateId = `${id}-date`
  async function submit() {
    const r = parseAmount(value, { allowNegative: true })
    if (!r.ok) {
      setFieldError(moneyError(`Amount for ${spoken}`, r, '12.50, 12.50+3 or -12.50'))
      document.getElementById(fieldId)?.focus()
      return
    }
    setFieldError('')
    if (dateField) {
      const bad = date === '' ? 'Error: Date cannot be empty'
        : date < dateField.min || date > dateField.max ? `Invalid: Date use a date from ${dateField.min} to ${dateField.max}` : ''
      setDateError(bad)
      if (bad) { document.getElementById(dateId)?.focus(); return }
    }
    await saver.run(() => onSave(r.value, cleanDescription(description), date))
  }
  useAnnounce(fieldError)
  useAnnounce(dateError)
  return (
    <Dialog id={id} title={title} className="amount-dialog" onClose={onCancel}
      form={{ submitLabel, onSubmit: submit, error: saver.error, busy: saver.busy, endButton: onDelete && <Button type="button" className="danger" onClick={onDelete}>Delete</Button> }}>
      <Field id={fieldId} label="Amount" error={fieldError} help={intro} required>
        <AmountField id={fieldId} className="amount" allowNegative value={value} aria-required="true"
          aria-invalid={!!fieldError || undefined} aria-describedby={describe(fieldId, fieldError, true)}
          onFocus={e => { if (initial) e.target.select() }}
          onChange={e => setValue(e.target.value)} />
      </Field>
      {dateField && (
        <Field id={dateId} label="Date" error={dateError} help={dateField.min === dateField.max ? `The day shown, ${dateField.min}.` : `From ${dateField.min} to ${dateField.max}.`} required>
          <DatePicker id={dateId} value={date} min={dateField.min} max={dateField.max} aria-required="true"
            aria-invalid={!!dateError || undefined} aria-describedby={[dateError && `${dateId}-error_msg`, `${dateId}-help`].filter(Boolean).join(' ')}
            onChange={e => setDate(e.target.value)} />
        </Field>
      )}
      {withDescription && (
        <Field id={`${id}-description`} label="Description" help={`Up to ${DESCRIPTION_MAX} characters.`}>
          <Input id={`${id}-description`} maxLength={DESCRIPTION_MAX} value={description} autoComplete="off" aria-describedby={`${id}-description-help`}
            onChange={e => setDescription(e.target.value)} />
        </Field>
      )}
    </Dialog>
  )
}
