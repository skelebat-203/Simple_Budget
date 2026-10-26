import { useState } from 'react'
import { Button, AmountInput, DatePicker, DropdownWithSearch } from '../components/ui'
import { budgetItemRepo } from '../storage/repository'
import type { BudgetType } from '../storage/db'

const KNOWN_ITEMS = ['Groceries', 'Rent', 'Salary', 'Coffee', 'Transport']

export function AddBudget({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<BudgetType>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (!name.trim()) { setError('Invalid: name cannot be empty'); return }
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) < 0) { setError('Invalid: amount use number format'); return }
    setSaving(true)
    try {
      await budgetItemRepo.add({ name, category: '', type, amount: Number(amount), date })
      setName('')
      setAmount('')
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
      <label htmlFor="item-date">Date</label>
      <DatePicker id="item-date" value={date} onChange={e => setDate(e.target.value)} />
      <label htmlFor="item-amount">Amount <span aria-hidden="true">*</span></label>
      <small id="amount-help">Enter a non-negative number.</small>
      <AmountInput id="item-amount" value={amount} onChange={e => setAmount(e.target.value)} aria-required="true" aria-invalid={!!error && (!amount || !Number.isFinite(Number(amount)))} aria-describedby="amount-help" />
      {error && <div role="alert" aria-live="polite" style={{ color: 'var(--color-alert)' }}>{error}</div>}
      <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </div>
  )
}
