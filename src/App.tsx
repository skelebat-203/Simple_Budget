import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddBudget } from './screens/AddBudget'
import { Budget } from './screens/Budget'
import { BudgetSetup } from './screens/BudgetSetup'
import { RewardLayer } from './rewards/RewardLayer'
import { Backup } from './components/Backup'
import { Notices, type NoticeState } from './components/Notices'
import { Tabs } from './components/ui'
import { budgetItemRepo, categoryRepo, settingsRepo, skipped } from './storage/repository'
import { dbEvents, type BudgetItem, type Category, type DefaultRange, type Range } from './storage/db'
import { buildTree, DEFAULT_CALENDAR, type Calendar } from './budget/tree'

const PERSIST_DISMISSED = 'simple-budget:persist-dismissed'
const LOAD_ERROR = 'Reload the page to try again. If this keeps happening, your browser may be blocking storage for this app.'

function App() {
  const [cats, setCats] = useState<Category[]>([])
  const [items, setItems] = useState<BudgetItem[]>([])
  const [range, setRange] = useState<Range>('day')
  const [defaultRange, setDefaultRange] = useState<DefaultRange>('day')
  const [calendar, setCalendar] = useState<Calendar>(DEFAULT_CALENDAR)
  const [rewardsEnabled, setRewardsEnabled] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
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

  const reloadSettings = useCallback(() => settingsRepo.get()
    .then(s => {
      const r = s.defaultRange ?? 'day'
      setRange(r); setDefaultRange(r)
      setRewardsEnabled(s.rewardsEnabled); setNotificationsEnabled(s.notificationsEnabled)
      setCalendar({ weekStart: s.weekStart ?? 0, monthBoundary: s.monthBoundary ?? 'weeks' })
    })
    .catch(() => note({ loadError: LOAD_ERROR })), [note])

  useEffect(() => {
    reloadCats()
    reloadItems()
    reloadSettings()
  }, [reloadCats, reloadItems, reloadSettings])

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
      <RewardLayer enabled={rewardsEnabled} />
      <Notices state={notices} onDismissPersist={dismissPersist} />
      <Tabs label="Sections" actions={[{ id: 'setup-budget', label: 'Setup Budget', onSelect: () => setSetupOpen(true) }]} tabs={[
        { id: 'add', label: 'Add purchase', panel: <AddBudget roots={roots} onSaved={() => { reloadItems(); reloadCats() }} /> },
        { id: 'budget', label: 'Budget', panel: <Budget roots={roots} items={items} range={range} onRangeChange={setRange} calendar={calendar} onChanged={() => { reloadItems(); reloadCats() }} /> },
      ]} />
      <Backup onRestored={() => {
        reloadCats(); reloadItems(); reloadSettings()
      }} />
      {setupOpen && (
        <BudgetSetup
          cats={cats}
          items={items}
          defaultRange={defaultRange}
          calendar={calendar}
          rewardsEnabled={rewardsEnabled}
          notificationsEnabled={notificationsEnabled}
          onClose={() => setSetupOpen(false)}
          onSaved={() => { reloadCats(); reloadSettings(); setSetupOpen(false) }}
        />
      )}
    </main>
  )
}

export default App
