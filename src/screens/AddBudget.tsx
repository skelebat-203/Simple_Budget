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

  async function save() {
    setError(null)
    if (!name.trim()) { setError('Invalid: name cannot be empty'); return }
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) < 0) { setError('Invalid: amount use number format'); return }
    setSaving(true)
    try {
      await budgetItemRepo.add({
        name,
        category: '',
        type,
        amount: Number(amount),
        date,
        estimate: estimate ? Number(estimate) : undefined,
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
      <label htmlFor="item-name">Item name <span aria-hidden="true">*</span></label>
      <DropdownWithSearch options={KNOWN_ITEMS} value={name} onChange={setName} />
      <label htmlFor="item-type">Type</label>
      <select id="item-type" value={type} onChange={e => setType(e.target.value as BudgetType)} style={{ padding: 'var(--space-sm)', minHeight: 44 }}>
        <option value="income">Income</option>
        <option value="savings">Savings</option>
        <option value="expense">Expense</option>
      </select>
      <label htmlFor="item-amount">Amount <span aria-hidden="true">*</span></label>
      <small id="amount-help">Enter a non-negative number.</small>
      <AmountInput id="item-amount" value={amount} onChange={e => setAmount(e.target.value)} aria-required="true" aria-invalid={!!error && (!amount || !Number.isFinite(Number(amount)))} aria-describedby="amount-help" />
      <label htmlFor="item-estimate">Estimated spend</label>
      <AmountInput id="item-estimate" value={estimate} onChange={e => setEstimate(e.target.value)} aria-describedby="estimate-help" />
      <small id="estimate-help">Optional; how much this item typically costs per period.</small>
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
      {error && <div role="alert" aria-live="polite" style={{ color: 'var(--color-alert)' }}>{error}</div>}
      <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </div>
  )
}