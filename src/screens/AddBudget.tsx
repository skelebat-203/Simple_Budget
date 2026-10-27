import { useState } from 'react'
import { Button, AmountInput, DatePicker, ItemSelector, type ItemOption } from '../components/ui'
import { budgetItemRepo } from '../storage/repository'
import { FREQUENCIES } from '../components/ui/frequencies'
import type { BudgetType, Frequency } from '../storage/db'

export function AddBudget({ onSaved }: { onSaved: () => void }) {
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<BudgetType>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [estimate, setEstimate] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('month')
  const [dueDate, setDueDate] = useState('')
  const [autopay, setAutopay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function handleItemChange(opt: ItemOption | null) {
    setSelectedItem(opt)
    if (opt) {
      setName(opt.name)
      setType(opt.type)
    } else {
      setName('')
    }
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'cannot be empty'
    const amt = Number(amount)
    if (amount === '' || amount === null || amount === undefined) {
      errs.amount = 'cannot be empty'
    } else if (!Number.isFinite(amt)) {
      errs.amount = 'use number format'
    }
    if (estimate !== '') {
      const est = Number(estimate)
      if (!Number.isFinite(est)) errs.estimate = 'use number format'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function save() {
    setError(null)
    if (!validate()) {
      const firstErr = Object.keys(fieldErrors)[0]
      if (firstErr) {
        const el = document.getElementById(firstErr === 'name' ? 'item-name' : firstErr === 'amount' ? 'item-amount' : firstErr === 'estimate' ? 'item-estimate' : `item-${firstErr}`)
        if (el) el.focus()
      }
      setError('To continue, correct the following errors')
      return
    }
    setSaving(true)
    try {
      await budgetItemRepo.add({
        name: name.trim(),
        category: selectedItem?.category || '',
        type,
        amount: Number(amount),
        date,
        estimate: estimate !== '' ? Number(estimate) : undefined,
        frequency,
        dueDate: dueDate || undefined,
        autopay: autopay || undefined,
      })
      setSelectedItem(null)
      setName('')
      setAmount('')
      setEstimate('')
      setFrequency('month')
      setDueDate('')
      setAutopay(false)
      setFieldErrors({})
      onSaved()
    } catch (e) {
      console.error(e)
      setError('Error: failed to save item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="form">
      <h2 className="title">Add Budget Item</h2>
      {error && error === 'To continue, correct the following errors' ? (
        <div role="alert" aria-live="assertive" className="banner">
          <h2 className="banner-title">To continue, correct the following errors</h2>
          <ul>
            {Object.entries(fieldErrors).map(([k, v]) => (
              <li key={k}>
                {v === 'cannot be empty' ? `Error: ${k === 'name' ? 'Item' : k === 'amount' ? 'Amount' : k} cannot be empty` : `Error: ${k === 'amount' ? 'Amount' : k === 'estimate' ? 'Estimated spend' : k} use number format`}
              </li>
            ))}
          </ul>
        </div>
      ) : error ? (
        <div role="alert" aria-live="polite" className="error">{error}</div>
      ) : null}
      <label className="label" htmlFor="item-name">Item <span aria-hidden="true">*</span></label>
      <ItemSelector id="item-name" value={name} onChange={handleItemChange} aria-required={true} aria-describedby={fieldErrors.name ? 'err-name' : undefined} />
      {fieldErrors.name && <div id="err-name" className="error">Error: Item {fieldErrors.name}</div>}
      <label className="label" htmlFor="item-amount">Amount <span aria-hidden="true">*</span></label>
      <small id="amount-help" className="help">Enter a number (negative amounts allowed for credits).</small>
      <AmountInput id="item-amount" value={amount} onChange={e => setAmount(e.target.value)} aria-required="true" aria-invalid={!!fieldErrors.amount} aria-describedby={fieldErrors.amount ? 'err-amount amount-help' : 'amount-help'} />
      {fieldErrors.amount && <div id="err-amount" className="error">Error: Amount {fieldErrors.amount === 'use number format' ? 'use number format' : fieldErrors.amount}</div>}
      <label className="label" htmlFor="item-estimate">Estimated spend</label>
      <AmountInput id="item-estimate" value={estimate} onChange={e => setEstimate(e.target.value)} aria-invalid={!!fieldErrors.estimate} aria-describedby={fieldErrors.estimate ? 'err-estimate estimate-help' : 'estimate-help'} />
      <small id="estimate-help" className="help">Optional; how much this item typically costs per period.</small>
      {fieldErrors.estimate && <div id="err-estimate" className="error">Error: Estimated spend {fieldErrors.estimate}</div>}
      <label className="label" htmlFor="item-frequency">Recurrence</label>
      <select id="item-frequency" className="input" value={frequency} onChange={e => setFrequency(e.target.value as Frequency)}>
        {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <label className="label" htmlFor="item-date">Date</label>
      <DatePicker id="item-date" value={date} onChange={e => setDate(e.target.value)} />
      <label className="label" htmlFor="item-due-date">Due date</label>
      <DatePicker id="item-due-date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
      <small id="due-date-help" className="help">Optional; when the payment is due.</small>
      <label className="label checkbox-item" htmlFor="item-autopay">
        <input id="item-autopay" type="checkbox" className="checkbox" checked={autopay} onChange={e => setAutopay(e.target.checked)} />
        Autopay
      </label>
      <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </div>
  )
}
