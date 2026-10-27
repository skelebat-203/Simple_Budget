import { useState } from 'react'
import { Button, AmountInput, DatePicker, DropdownWithSearch } from '../components/ui'
import { budgetItemRepo } from '../storage/repository'
import type { BudgetType, Frequency } from '../storage/db'

const KNOWN_ITEMS = ['Groceries', 'Rent', 'Salary', 'Coffee', 'Transport']
const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'bimonthly', label: 'Every 2 months' },
  { value: 'biweek', label: 'Every 2 weeks' },
]

export function AddBudget({ onSaved }: { onSaved: () => void }) {
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

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'cannot be empty'
    const amt = Number(amount)
    if (amount === '' || amount === null || amount === undefined) {
      errs.amount = 'cannot be empty'
    } else if (!Number.isFinite(amt) || amt < 0) {
      errs.amount = 'use number format'
    }
    if (estimate !== '') {
      const est = Number(estimate)
      if (!Number.isFinite(est) || est < 0) errs.estimate = 'use number format'
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
        category: '',
        type,
        amount: Number(amount),
        date,
        estimate: estimate !== '' ? Number(estimate) : undefined,
        frequency,
        dueDate: dueDate || undefined,
        autopay: autopay || undefined,
      })
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
    <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxWidth: 400, margin: '0 auto' }}>
      <h2 style={{ color: 'var(--color-foreground-page)' }}>Add Budget Item</h2>
      {error && error === 'To continue, correct the following errors' ? (
        <div role="alert" aria-live="assertive" style={{ color: 'var(--color-alert)', border: '1px solid var(--color-alert)', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)' }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>To continue, correct the following errors</h2>
          <ul>
            {Object.entries(fieldErrors).map(([k, v]) => (
              <li key={k}>
                {v === 'cannot be empty' ? `Error: ${k === 'name' ? 'Item name' : k === 'amount' ? 'Amount' : k} cannot be empty` : `Error: ${k === 'amount' ? 'Amount' : k === 'estimate' ? 'Estimated spend' : k} use number format`}
              </li>
            ))}
          </ul>
        </div>
      ) : error ? (
        <div role="alert" aria-live="polite" style={{ color: 'var(--color-alert)' }}>{error}</div>
      ) : null}
      <label htmlFor="item-name">Item name <span aria-hidden="true">*</span></label>
      <DropdownWithSearch id="item-name" options={KNOWN_ITEMS} value={name} onChange={setName} aria-required={true} aria-describedby={fieldErrors.name ? 'err-name' : undefined} />
      {fieldErrors.name && <div id="err-name" style={{ color: 'var(--color-alert)' }}>Error: Item name {fieldErrors.name}</div>}
      <label htmlFor="item-type">Type</label>
      <select id="item-type" value={type} onChange={e => setType(e.target.value as BudgetType)} style={{ padding: 'var(--space-sm)', minHeight: 44 }}>
        <option value="income">Income</option>
        <option value="savings">Savings</option>
        <option value="expense">Expense</option>
      </select>
      <label htmlFor="item-amount">Amount <span aria-hidden="true">*</span></label>
      <small id="amount-help">Enter a non-negative number.</small>
      <AmountInput id="item-amount" value={amount} onChange={e => setAmount(e.target.value)} aria-required="true" aria-invalid={!!fieldErrors.amount} aria-describedby={fieldErrors.amount ? 'err-amount amount-help' : 'amount-help'} />
      {fieldErrors.amount && <div id="err-amount" style={{ color: 'var(--color-alert)' }}>Error: Amount {fieldErrors.amount === 'use number format' ? 'use number format' : fieldErrors.amount}</div>}
      <label htmlFor="item-estimate">Estimated spend</label>
      <AmountInput id="item-estimate" value={estimate} onChange={e => setEstimate(e.target.value)} aria-invalid={!!fieldErrors.estimate} aria-describedby={fieldErrors.estimate ? 'err-estimate estimate-help' : 'estimate-help'} />
      <small id="estimate-help">Optional; how much this item typically costs per period.</small>
      {fieldErrors.estimate && <div id="err-estimate" style={{ color: 'var(--color-alert)' }}>Error: Estimated spend {fieldErrors.estimate}</div>}
      <label htmlFor="item-frequency">Recurrence</label>
      <select id="item-frequency" value={frequency} onChange={e => setFrequency(e.target.value as Frequency)} style={{ padding: 'var(--space-sm)', minHeight: 44 }}>
        {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <label htmlFor="item-date">Date</label>
      <DatePicker id="item-date" value={date} onChange={e => setDate(e.target.value)} />
      <label htmlFor="item-due-date">Due date</label>
      <DatePicker id="item-due-date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
      <small id="due-date-help">Optional; when the payment is due.</small>
      <label htmlFor="item-autopay" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
        <input id="item-autopay" type="checkbox" checked={autopay} onChange={e => setAutopay(e.target.checked)} style={{ width: 'auto', minHeight: 44, minWidth: 44 }} />
        Autopay
      </label>
      <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </div>
  )
}