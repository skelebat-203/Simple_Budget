import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddBudget } from './screens/AddBudget'
import { Budget } from './screens/Budget'
import { BudgetSetup } from './screens/BudgetSetup'
import { budgetItemRepo, categoryRepo, settingsRepo } from './storage/repository'
import type { BudgetItem, Category, Range } from './storage/db'
import { buildTree } from './budget/tree'

function App() {
  const [cats, setCats] = useState<Category[]>([])
  const [items, setItems] = useState<BudgetItem[]>([])
  const [range, setRange] = useState<Range>('day')
  const [defaultRange, setDefaultRange] = useState<Range>('day')
  const [setupOpen, setSetupOpen] = useState(false)

  const reloadCats = useCallback(() => categoryRepo.list().then(setCats), [])
  const reloadItems = useCallback(() => budgetItemRepo.list().then(setItems), [])

  useEffect(() => {
    reloadCats()
    reloadItems()
    settingsRepo.get().then(s => { const r = s.defaultRange ?? 'day'; setRange(r); setDefaultRange(r) })
  }, [reloadCats, reloadItems])

  const roots = useMemo(() => buildTree(cats), [cats])

  return (
    <main className="main">
      <h1 className="title">Simple Budget</h1>
      <AddBudget roots={roots} onSaved={() => { reloadItems(); reloadCats() }}onOpenSetup={() => setSetupOpen(true)} />
      <Budget roots={roots} items={items} range={range} onRangeChange={setRange} />
      {setupOpen && (
        <BudgetSetup
          roots={roots}
          defaultRange={defaultRange}
          onClose={() => setSetupOpen(false)}
          onChanged={r => { reloadCats(); if (r) { setDefaultRange(r); setRange(r) } }}
        />
      )}
    </main>
  )
}

export default App
