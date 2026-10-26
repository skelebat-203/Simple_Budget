import { useState } from 'react'
import { Button, Input, AmountInput, DatePicker, DropdownWithSearch } from '../components/ui'
import { budgetItemRepo } from '../storage/repository'
import type { BudgetType } from '../storage/db'

const KNOWN_ITEMS = ['Groceries', 'Rent', 'Salary', 'Coffee', 'Transport']

export function AddBudget() {
  const [name, setName] = useState('')
  const [type, setType] = useState<BudgetType>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name || !amount) return
    setSaving(true)
    await budgetItemRepo.add({ name, category: '', type, amount: Number(amount), date })
    setSaving(false)
    setName('')
    setAmount('')
  }

  return (
    <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', maxWidth: 400 }}>
      <h2>Add Budget Item</h2>
      <DropdownWithSearch options={KNOWN_ITEMS} onSelect={setName} />
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Item name" />
      <select value={type} onChange={e => setType(e.target.value as BudgetType)} style={{ padding: 'var(--space-sm)' }}>
        <option value="income">Income</option>
        <option value="savings">Savings</option>
        <option value="expense">Expense</option>
      </select>
      <DatePicker value={date} onChange={e => setDate(e.target.value)} />
      <AmountInput value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
      <Button onClick={save} disabled={saving || !name || !amount}>{saving ? 'Saving...' : 'Save'}</Button>
    </div>
  )
}
