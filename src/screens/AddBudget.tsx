import { useRef, useState } from 'react'
import { AmountInput, Button, DatePicker, ErrorSummary, focusFirstError, ItemSelector, type FieldError } from '../components/ui'
import { budgetItemRepo, categoryRepo } from '../storage/repository'
import type { Frequency } from '../storage/db'
import { FREQUENCIES, isoDate, type CatNode } from '../budget/tree'
import { dateBounds, moneyError, parseMoney } from '../budget/validate'

type Errors = { item?: string; amount?: string; estimate?: string; date?: string }

const toList = (e: Errors): FieldError[] =>
  (['item', 'amount', 'estimate', 'date'] as const).filter(k => e[k]).map(k => ({ fieldId: k, message: e[k]! }))

export function AddBudget({ roots, onSaved, onOpenSetup }: {
  roots: CatNode[]
  onSaved: () => void
  onOpenSetup: () => void
}) {
  const [target, setTarget] = useState<CatNode | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => isoDate(new Date()))
  const [estimate, setEstimate] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('month')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [formKey, setFormKey] = useState(0)
  const bannerRef = useRef<HTMLDivElement>(null)
  const [saveError, setSaveError] = useState('')
  const [bounds] = useState(() => dateBounds(new Date()))

  function validate(): Errors {
    const e: Errors = {}
    if (!target) e.item = 'Error: Item cannot be empty'
    // A number input reports '' for text it can't parse; tell that apart from empty (security-v0.2 3.3).
    const amountEl = document.getElementById('amount') as HTMLInputElement | null
    const amt = amountEl?.validity.badInput ? { ok: false as const, reason: 'format' as const } : parseMoney(amount, { allowNegative: true })
    if (!amt.ok) e.amount = moneyError('Amount', amt, '12.50 or -12.50')
    if (estimate.trim() !== '') {
      const est = parseMoney(estimate, { allowNegative: false })
      if (!est.ok) e.estimate = moneyError('Estimated spend', est, '40 or 1,200.00')
    }
    if (date === '') e.date = 'Error: Date cannot be empty'
    else if (date < bounds.min || date > bounds.max) e.date = `Invalid: Date use a date from ${bounds.min} to ${bounds.max}`
    return e
  }

  async function save() {
    setStatus('')
    setSaveError('')
    const e = validate()
    setErrors(e)
    const list = toList(e)
    if (list.length) {
      // Wait for the banner to render before moving focus.
      requestAnimationFrame(() => focusFirstError(list, bannerRef.current))
      return
    }
    setSaving(true)
    try {
      const amt = parseMoney(amount, { allowNegative: true })
      await budgetItemRepo.add({ categoryId: target!.cat.id, amount: amt.ok ? amt.value : 0, date })
      const est = parseMoney(estimate, { allowNegative: false })
      if (est.ok) {
        await categoryRepo.update(target!.cat.id, { estimate: est.value, frequency, selected: true })
      }
      setStatus(`Saved ${target!.cat.name}.`)
      setTarget(null)
      setAmount('')
      setEstimate('')
      setFrequency('month')
      setFormKey(k => k + 1) // clears the Item control
      onSaved()
    } catch (err) {
      // Name and message only; never the record (security-v0.2 8.6).
      console.error('Save failed:', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown')
      setSaveError('Error: The item wasn’t saved. Check that your device has free storage space, then try again.')
    } finally {
      setSaving(false)
    }
  }

  // Prefill the estimate fields with what the item already has.
  function pickTarget(t: CatNode | null) {
    setTarget(t)
    setEstimate(t?.cat.estimate != null ? String(t.cat.estimate) : '')
    setFrequency(t?.cat.frequency ?? 'month')
  }

  const errorList = toList(errors)

  return (
    <section className="panel" aria-labelledby="add-heading">
      <div className="panel-head">
        <h2 id="add-heading" className="section-title">Add budget item</h2>
        <Button type="button" className="secondary" onClick={onOpenSetup}>Set estimates</Button>
      </div>
      <ErrorSummary ref={bannerRef} errors={errorList} />
      <div className="field">
        <label className="label" htmlFor="item">Item <span aria-hidden="true">*</span></label>
        <ItemSelector key={formKey} id="item" roots={roots} onChange={pickTarget}
          invalid={!!errors.item} describedBy={errors.item ? 'item-error' : undefined} />
        {errors.item && <p id="item-error" className="error">{errors.item}</p>}
      </div>
      <div className="field">
        <label className="label" htmlFor="amount">Amount <span aria-hidden="true">*</span></label>
        <p id="amount-help" className="help">Use a minus sign for a credit or refund, e.g. -12.50.</p>
        <AmountInput id="amount" value={amount} onChange={e => setAmount(e.target.value)} aria-required="true"
          aria-invalid={!!errors.amount || undefined}
          aria-describedby={errors.amount ? 'amount-error amount-help' : 'amount-help'} />
        {errors.amount && <p id="amount-error" className="error">{errors.amount}</p>}
      </div>
      <div className="field">
        <label className="label" htmlFor="estimate">Estimated spend</label>
        <p id="estimate-help" className="help">Optional. What you expect this item to cost each time it recurs.</p>
        <input id="estimate" className="input" type="text" inputMode="decimal" autoComplete="off" value={estimate} onChange={e => setEstimate(e.target.value)}
          aria-invalid={!!errors.estimate || undefined}
          aria-describedby={errors.estimate ? 'estimate-error estimate-help' : 'estimate-help'} />
        {errors.estimate && <p id="estimate-error" className="error">{errors.estimate}</p>}
      </div>
      <div className="field">
        <label className="label" htmlFor="frequency">Recurrence</label>
        <select id="frequency" className="input" value={frequency} onChange={e => setFrequency(e.target.value as Frequency)}>
          {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor="date">Date</label>
        <DatePicker id="date" value={date} min={bounds.min} max={bounds.max} aria-invalid={!!errors.date || undefined}
          aria-describedby={errors.date ? 'date-error' : undefined} onChange={e => setDate(e.target.value)} />
        {errors.date && <p id="date-error" className="error">{errors.date}</p>}
      </div>
      <div className="actions">
        <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        <p className="status" role="status">{status}</p>
      </div>
      {saveError && <p className="error" role="alert">{saveError}</p>}
    </section>
  )
}
