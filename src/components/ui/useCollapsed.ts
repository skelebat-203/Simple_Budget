import { useEffect, useState } from 'react'

const COLLAPSED_KEY = 'simple-budget:collapsed'
const COLLAPSED_EVENT = 'simple-budget:collapsed'

/** The saved closed rows, or null when nothing was ever saved (v0.7 step 6: then the caller's default applies). */
function loadCollapsed(): Set<number> | null {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    return raw == null ? null : new Set(JSON.parse(raw))
  } catch { return null }
}

/**
 * Closed (▴) category/subcategory rows of the budget tables (v0.4 step 9). One
 * shared state for Day, Week, Month and Annual, kept in localStorage so it
 * survives reloads, and synced between mounted tables and other tabs.
 * Until anything is saved, `defaults` are closed (narrow screens start with categories closed, v0.7 step 6).
 * Budget setup keeps its own, unsaved expand state. The tables have no keyboard
 * shortcuts of their own: every control is a Tab stop (0008 §2, applied to all tables in v0.5.9).
 */
export function useCollapsed(defaults: number[] = []): [Set<number>, (id: number) => void, (ids: number[]) => void] {
  const [saved, setSaved] = useState(loadCollapsed)
  useEffect(() => {
    const sync = () => setSaved(loadCollapsed())
    const onStorage = (e: StorageEvent) => { if (e.key === COLLAPSED_KEY) sync() }
    window.addEventListener(COLLAPSED_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener(COLLAPSED_EVENT, sync); window.removeEventListener('storage', onStorage) }
  }, [])
  const collapsed = saved ?? new Set(defaults)
  function save(next: Set<number>) {
    setSaved(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      window.dispatchEvent(new Event(COLLAPSED_EVENT))
    } catch { /* storage unavailable: this table, this session only */ }
  }
  function toggle(id: number) {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id); else next.add(id)
    save(next)
  }
  /** Open every row in `ids` (e.g. the rows above an item that was just moved, so it shows). */
  function open(ids: number[]) {
    if (!ids.some(id => collapsed.has(id))) return
    const next = new Set(collapsed)
    ids.forEach(id => next.delete(id))
    save(next)
  }
  return [collapsed, toggle, open]
}

/** Expand/collapse buttons are always Tab stops (0008 §1), so they aren't managed here. */
