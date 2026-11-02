import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddBudget } from './screens/AddBudget'
import { Budget } from './screens/Budget'
import { BudgetSetup } from './screens/BudgetSetup'
import { Backup } from './components/Backup'
import { Notices, type NoticeState } from './components/Notices'
import { budgetItemRepo, categoryRepo, settingsRepo, skipped } from './storage/repository'
import { dbEvents, type BudgetItem, type Category, type Range } from './storage/db'
import { buildTree } from './budget/tree'

const PERSIST_DISMISSED = 'simple-budget:persist-dismissed'
const LOAD_ERROR = 'Reload the page to try again. If this keeps happening, your browser may be blocking storage for this app.'

function App() {
  const [cats, setCats] = useState<Category[]>([])
  const [items, setItems] = useState<BudgetItem[]>([])
  const [range, setRange] = useState<Range>('day')
  const [defaultRange, setDefaultRange] = useState<Range>('day')
  const [setupOpen, setSetupOpen] = useState(false)
  const [notices, setNotices] = useState<NoticeState>({})
  const note = useCallback((p: Partial<NoticeState>) => setNotices(n => ({ ...n, ...p })), [])

  // Loads report failures and skipped rows instead of showing an empty table (security-v0.2 8.2, 6.5).
  const reloadCats = useCallback(() => categoryRepo.list()
    .then(c => { setCats(c); note({ skipped: skipped.items + skipped.categories }) })
    .catch(() => note({ loadError: LOAD_ERROR })), [note])
  const reloadItems = useCallback(() => budgetItemRepo.list()
    .then(i => { setItems(i); note({ skipped: skipped.items + skipped.categories }) })
    .catch(() => note({ loadError: LOAD_ERROR })), [note])

  useEffect(() => {
    reloadCats()
    reloadItems()
    settingsRepo.get()
      .then(s => { const r = s.defaultRange ?? 'day'; setRange(r); setDefaultRange(r) })
      .catch(() => note({ loadError: LOAD_ERROR }))
  }, [reloadCats, reloadItems, note])

  // Ask the browser to keep this app's data (security-v0.2 6.1).
  useEffect(() => {
    let dismissed = false
    try { dismissed = localStorage.getItem(PERSIST_DISMISSED) === '1' } catch { /* storage unavailable */ }
    navigator.storage?.persist?.()
      .then(granted => { if (!granted && !dismissed) note({ notPersisted: true }) })
      .catch(() => { /* unsupported; nothing to report */ })
  }, [note])

  // Another tab blocking or finishing an upgrade (security-v0.2 8.4).
  useEffect(() => {
    const blocked = () => note({ dbBlocked: true })
    const changed = () => note({ dbChanged: true })
    dbEvents.addEventListener('blocked', blocked)
    dbEvents.addEventListener('versionchange', changed)
    return () => {
      dbEvents.removeEventListener('blocked', blocked)
      dbEvents.removeEventListener('versionchange', changed)
    }
  }, [note])

  const roots = useMemo(() => buildTree(cats), [cats])

  function dismissPersist() {
    try { localStorage.setItem(PERSIST_DISMISSED, '1') } catch { /* storage unavailable */ }
    note({ notPersisted: false })
  }

  return (
    <main className="main">
      <h1 className="title">Simple Budget</h1>
      <Notices state={notices} onDismissPersist={dismissPersist} />
      <AddBudget roots={roots} onSaved={() => { reloadItems(); reloadCats() }} onOpenSetup={() => setSetupOpen(true)} />
      <Budget roots={roots} items={items} range={range} onRangeChange={setRange} />
      <Backup onRestored={() => {
        reloadCats(); reloadItems()
        settingsRepo.get().then(s => { const r = s.defaultRange ?? 'day'; setRange(r); setDefaultRange(r) }).catch(() => note({ loadError: LOAD_ERROR }))
      }} />
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
