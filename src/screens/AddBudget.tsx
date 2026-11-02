import { useState } from 'react'
import { AmountInput, Button, DatePicker, ItemSelector } from '../components/ui'
import { budgetItemRepo, categoryRepo } from '../storage/repository'
import type { Frequency } from '../storage/db'
import { FREQUENCIES, isoDate, type CatNode } from '../budget/tree'

type Errors = { item?: string; amount?: string; estimate?: string }

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

  function validate(): Errors {
    const e: Errors = {}
    if (!target) e.item = 'Choose an item from the list.'
    if (amount.trim() === '') e.amount = 'Enter an amount.'
    else if (!Number.isFinite(Number(amount))) e.amount = 'Enter the amount as a number, e.g. 12.50 or -12.50.'
    if (estimate.trim() !== '' && !Number.isFinite(Number(estimate))) e.estimate = 'Enter the estimated spend as a number, e.g. 40.'
    return e
  }

  async function save() {
    setStatus('')
    const e = validate()
    setErrors(e)
    if (e.item || e.amount || e.estimate) {
      document.getElementById(e.item ? 'item' : e.amount ? 'amount' : 'estimate')?.focus()
      return
    }
    setSaving(true)
    try {
      await budgetItemRepo.add({ categoryId: target!.cat.id, amount: Number(amount), date })
      if (estimate.trim() !== '') {
        await categoryRepo.update(target!.cat.id, { estimate: Number(estimate), frequency, selected: true })
      }
      setStatus(`Saved ${target!.cat.name}.`)
      setTarget(null)
      setAmount('')
      setEstimate('')
      setFrequency('month')
      setFormKey(k => k + 1) // clears the Item control
      onSaved()
    } catch (err) {
      console.error(err)
      setStatus('The item wasn’t saved. Try again.')
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

  const errorCount = Object.values(errors).filter(Boolean).length

  return (
    <section className="panel" aria-labelledby="add-heading">
      <div className="panel-head">
        <h2 id="add-heading" className="section-title">Add budget item</h2>
        <Button type="button" className="secondary" onClick={onOpenSetup}>Set estimates</Button>
      </div>
      {errorCount > 0 && (
        <div role="alert" className="banner">
          <p className="banner-title">To continue, fix {errorCount === 1 ? 'this error' : 'these errors'}:</p>
          <ul>{Object.values(errors).filter(Boolean).map(m => <li key={m}>{m}</li>)}</ul>
        </div>
      )}
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
        <AmountInput id="estimate" value={estimate} onChange={e => setEstimate(e.target.value)}
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
        <DatePicker id="date" value={date} onChange={e => setDate(e.target.value || isoDate(new Date()))} />
      </div>
      <div className="actions">
        <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        <p className="status" role="status">{status}</p>
      </div>
    </section>
  )
}
