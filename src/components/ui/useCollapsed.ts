import { useEffect, useState } from 'react'

const COLLAPSED_KEY = 'simple-budget:collapsed'
const COLLAPSED_EVENT = 'simple-budget:collapsed'

function loadCollapsed(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')) } catch { return new Set() }
}

/**
 * Closed (▸) category/subcategory rows of the budget tables (v0.4 step 9). One
 * shared state for Day, Week, Month and Annual, kept in localStorage so it
 * survives reloads, and synced between mounted tables and other tabs.
 * Budget setup keeps its own, unsaved expand state. The tables have no keyboard
 * shortcuts of their own: every control is a Tab stop (0008 §2, applied to all tables in v0.5.9).
 */
export function useCollapsed(): [Set<number>, (id: number) => void] {
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  useEffect(() => {
    const sync = () => setCollapsed(loadCollapsed())
    const onStorage = (e: StorageEvent) => { if (e.key === COLLAPSED_KEY) sync() }
    window.addEventListener(COLLAPSED_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener(COLLAPSED_EVENT, sync); window.removeEventListener('storage', onStorage) }
  }, [])
  function toggle(id: number) {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id); else next.add(id)
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      window.dispatchEvent(new Event(COLLAPSED_EVENT))
    } catch { /* storage unavailable: this table, this session only */ }
  }
  return [collapsed, toggle]
}

/** Expand/collapse buttons are always Tab stops (0008 §1), so they aren't managed here. */
