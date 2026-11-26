import { useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { AmountField } from './AmountField'
import { DatePicker } from './DatePicker'
import { Input } from './Input'
import { useAnnounce } from './announcer'
import { cleanDescription, expandName, DESCRIPTION_MAX, moneyError, NAME_MAX, parseAmount } from '../../budget/validate'

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

const RENAME_WARNING = 'Changes the name in ALL historic records.'

/** Annual's pencil: a name change only, as a convenient bulk rename (0009 §4). */
export function RenameDialog({ id, spoken, name, onSave, onCancel }: {
  id: string
  /** Accessible name of the row, e.g. "Car, Insurance". */
  spoken: string
  name: string
  onSave: (name: string) => SaveResult | Promise<SaveResult>
  onCancel: () => void
}) {
  const [value, setValue] = useState(name)
  const [fieldError, setFieldError] = useState('')
  const saver = useSaver()
  const input = useRef<HTMLInputElement>(null)
  const fieldId = `${id}-name`
  async function submit() {
    const clean = expandName(value, name)
    if (!clean) { setFieldError(`Error: Name for ${spoken} cannot be empty`); input.current?.focus(); return }
    setFieldError('')
    if (clean === name) return onCancel()
    await saver.run(() => onSave(clean))
  }
  useAnnounce(fieldError)
  return (
    <Dialog id={id} title={`Rename ${spoken}`} onClose={onCancel} form={{ submitLabel: 'Save', onSubmit: submit, error: saver.error, busy: saver.busy }}>
      <Field id={fieldId} label="New name" error={fieldError} help={RENAME_WARNING} required>
        <Input id={fieldId} ref={input} maxLength={NAME_MAX} value={value} autoComplete="off" spellCheck aria-required="true"
          aria-invalid={!!fieldError || undefined} aria-describedby={describe(fieldId, fieldError, true)}
          onChange={e => setValue(e.target.value)} />
      </Field>
    </Dialog>
  )
}

/** What Update changed. `amount` is the new period total; `moveTo` the chosen parent's id. */
export interface UpdateChange { name?: string; amount?: number; moveTo?: number }

/**
 * Update (v0.7 step 15d, from the Actions menu in Week and Month): the row's name, its total for the
 * period shown, and Move to, in one dialog; Delete at the right of the footer. Each part shows only
 * where it applies (no name or move for a top-level row, no amount for a total row).
 */
export function UpdateDialog({ id, spoken, name, amount, moves, onSave, onDelete, onCancel }: {
  id: string
  spoken: string
  /** Present when the row can be renamed. */
  name?: string
  /** Present when the row takes amounts: its current total and the field's help. */
  amount?: { label: string; current: number; help: string }
  /** Present when the row can move: "Keep in …" first (value ''), then the places it can go. */
  moves?: { value: string; label: string }[]
  onSave: (change: UpdateChange) => SaveResult | Promise<SaveResult>
  onDelete?: () => void
  onCancel: () => void
}) {
  const shownAmount = (n: number) => n.toFixed(2)
  const [nameText, setNameText] = useState(name ?? '')
  const [amountText, setAmountText] = useState(amount ? shownAmount(amount.current) : '')
  const [move, setMove] = useState('')
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({})
  const saver = useSaver()
  const nameId = `${id}-name`, amountId = `${id}-amount`, moveId = `${id}-move_to`
  async function submit() {
    const e: typeof errors = {}
    const change: UpdateChange = {}
    if (name !== undefined) {
      const clean = expandName(nameText, name)
      if (!clean) e.name = `Error: Name for ${spoken} cannot be empty`
      else if (clean !== name) change.name = clean
    }
    if (amount) {
      const r = parseAmount(amountText, { allowNegative: true })
      if (!r.ok) e.amount = moneyError(amount.label, r, '120.00, 100+20 or -12.50')
      else if (Math.round(r.value * 100) !== Math.round(amount.current * 100)) change.amount = r.value
    }
    if (move) change.moveTo = Number(move)
    setErrors(e)
    if (e.name || e.amount) { document.getElementById(e.name ? nameId : amountId)?.focus(); return }
    if (!Object.keys(change).length) return onCancel()
    await saver.run(() => onSave(change))
  }
  useAnnounce(errors.name ?? errors.amount ?? '')
  return (
    <Dialog id={id} title={`Update ${spoken}`} className="update-dialog" onClose={onCancel}
      form={{ submitLabel: 'Save', onSubmit: submit, error: saver.error, busy: saver.busy, endButton: onDelete && <Button type="button" className="danger" onClick={onDelete}>Delete</Button> }}>
      {name !== undefined && (
        <Field id={nameId} label="Name" error={errors.name} help={RENAME_WARNING} required>
          <Input id={nameId} maxLength={NAME_MAX} value={nameText} autoComplete="off" spellCheck aria-required="true"
            aria-invalid={!!errors.name || undefined} aria-describedby={describe(nameId, errors.name, true)}
            onChange={e => setNameText(e.target.value)} />
        </Field>
      )}
      {amount && (
        <Field id={amountId} label={amount.label} error={errors.amount} help={amount.help} required>
          <AmountField id={amountId} className="amount" allowNegative value={amountText} aria-required="true"
            aria-invalid={!!errors.amount || undefined} aria-describedby={describe(amountId, errors.amount, true)}
            onFocus={e => e.target.select()} onChange={e => setAmountText(e.target.value)} />
        </Field>
      )}
      {moves && moves.length > 1 && (
        <Field id={moveId} label="Move to" help="A subcategory moved into another becomes an item; an item moved to a category becomes a subcategory.">
          <select id={moveId} className="input" value={move} aria-describedby={`${moveId}-help`} onChange={e => setMove(e.target.value)}>
            {moves.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
      )}
    </Dialog>
  )
}

/**
 * New purchase (0009 §4.1; Week and Month Actions menu): an amount, a date within the period
 * shown, and a description. Amounts accept typed sums.
 */
export function AmountDialog({ id, title, spoken, intro, dateField, onSave, onCancel }: {
  id: string
  title: string
  spoken: string
  /** Help for the Amount field, shown between its label and the box. */
  intro: string
  /** A date picker limited to min..max (the period being viewed, 0009 §4.1). */
  dateField: { initial: string; min: string; max: string }
  onSave: (amount: number, description: string, date: string) => SaveResult | Promise<SaveResult>
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(dateField.initial)
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
    const bad = date === '' ? 'Error: Date cannot be empty'
      : date < dateField.min || date > dateField.max ? `Invalid: Date use a date from ${dateField.min} to ${dateField.max}` : ''
    setDateError(bad)
    if (bad) { document.getElementById(dateId)?.focus(); return }
    await saver.run(() => onSave(r.value, cleanDescription(description), date))
  }
  useAnnounce(fieldError)
  useAnnounce(dateError)
  return (
    <Dialog id={id} title={title} className="amount-dialog" onClose={onCancel}
      form={{ submitLabel: 'Save', onSubmit: submit, error: saver.error, busy: saver.busy }}>
      <Field id={fieldId} label="Amount" error={fieldError} help={intro} required>
        <AmountField id={fieldId} className="amount" allowNegative value={value} aria-required="true"
          aria-invalid={!!fieldError || undefined} aria-describedby={describe(fieldId, fieldError, true)}
          onChange={e => setValue(e.target.value)} />
      </Field>
      <Field id={dateId} label="Date" error={dateError} help={dateField.min === dateField.max ? `The day shown, ${dateField.min}.` : `From ${dateField.min} to ${dateField.max}.`} required>
        <DatePicker id={dateId} value={date} min={dateField.min} max={dateField.max} aria-required="true"
          aria-invalid={!!dateError || undefined} aria-describedby={[dateError && `${dateId}-error_msg`, `${dateId}-help`].filter(Boolean).join(' ')}
          onChange={e => setDate(e.target.value)} />
      </Field>
      <Field id={`${id}-description`} label="Description" help={`Up to ${DESCRIPTION_MAX} characters.`}>
        <Input id={`${id}-description`} maxLength={DESCRIPTION_MAX} value={description} autoComplete="off" aria-describedby={`${id}-description-help`}
          onChange={e => setDescription(e.target.value)} />
      </Field>
    </Dialog>
  )
}
