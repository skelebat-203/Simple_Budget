import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'

const COLLAPSED_KEY = 'simple-budget:collapsed'
const COLLAPSED_EVENT = 'simple-budget:collapsed'

function loadCollapsed(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')) } catch { return new Set() }
}

/**
 * Closed (▸) category/subcategory rows of the budget tables (v0.4 step 9). One
 * shared state for Day, Week, Month and Annual, kept in localStorage so it
 * survives reloads, and synced between mounted tables and other tabs.
 * Budget setup keeps its own, unsaved expand state.
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

const widgetsOf = (cell: Element) => [...cell.querySelectorAll<HTMLElement>('input, select, button')]

/**
 * Keyboard support for a `role="treegrid"` table (0007 §10). Body rows carry
 * `aria-level`, expandable rows `aria-expanded` and `data-id`.
 *
 * - One tab stop: the last focused cell. Controls inside cells are not tab stops.
 * - Up/Down/Left/Right move between cells; Home/End to the row's ends,
 *   Ctrl+Home/End to the first/last row.
 * - In the first cell, Right expands and Left collapses (or goes to the parent row).
 * - Enter or F2 moves into the cell's first control; Tab/Shift+Tab move between
 *   the cell's controls; Escape returns to the cell. Space toggles a cell's checkbox.
 *
 * Pass `enabled: false` for a read-only table that renders as a plain table.
 */
export function useTreegrid(onToggle: (id: number) => void, enabled = true) {
  const gridRef = useRef<HTMLTableElement>(null)
  const lastCell = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid || !enabled) return
    const cells = [...grid.querySelectorAll<HTMLElement>('tbody td, tbody th')]
    const current = lastCell.current && grid.contains(lastCell.current) ? lastCell.current : cells[0]
    for (const c of cells) {
      c.tabIndex = c === current ? 0 : -1
      for (const w of widgetsOf(c)) w.tabIndex = -1
    }
  })

  function onFocus(e: FocusEvent<HTMLTableElement>) {
    const c = (e.target as HTMLElement).closest('td, th')
    if (c && c.closest('tbody')) lastCell.current = c as HTMLElement
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableElement>) {
    const t = e.target as HTMLElement
    const cell = t.closest('td, th') as HTMLElement | null
    if (!cell || !cell.closest('tbody')) return
    if (e.key === 'Escape' && t !== cell) { e.preventDefault(); e.stopPropagation(); cell.focus(); return }
    if (e.key === 'Tab' && t !== cell) {
      const ws = widgetsOf(cell), i = ws.indexOf(t)
      const next = ws[i + (e.shiftKey ? -1 : 1)]
      if (next) { e.preventDefault(); next.focus() }
      return
    }
    const inText = t !== cell && (t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !['checkbox', 'radio'].includes((t as HTMLInputElement).type)))
    if (inText) return
    if (t === cell && (e.key === 'Enter' || e.key === 'F2')) {
      const w = widgetsOf(cell)[0]
      if (w) { e.preventDefault(); w.focus() }
      return
    }
    if (t === cell && e.key === ' ') {
      const box = cell.querySelector<HTMLInputElement>('input[type=checkbox]')
      if (box) { e.preventDefault(); box.click() }
      return
    }
    if (t !== cell && (e.key === 'Enter' || e.key === ' ')) return // let the control act
    const row = cell.parentElement as HTMLTableRowElement
    const rows = [...(row.parentElement as HTMLTableSectionElement).rows]
    const r = rows.indexOf(row)
    const col = [...row.cells].indexOf(cell as HTMLTableCellElement)
    const go = (ri: number, ci: number) => {
      const target = rows[Math.max(0, Math.min(rows.length - 1, ri))]
      const c = target.cells[Math.max(0, Math.min(target.cells.length - 1, ci))]
      lastCell.current = c
      c.focus()
    }
    const isOpen = row.getAttribute('aria-expanded')
    switch (e.key) {
      case 'ArrowDown': go(r + 1, col); break
      case 'ArrowUp': go(r - 1, col); break
      case 'ArrowRight':
        if (col === 0 && isOpen === 'false') onToggle(Number(row.dataset.id))
        else go(r, col + 1)
        break
      case 'ArrowLeft':
        if (col === 0 && isOpen === 'true') onToggle(Number(row.dataset.id))
        else if (col === 0) {
          const level = Number(row.getAttribute('aria-level'))
          const p = rows.slice(0, r).reverse().find(x => Number(x.getAttribute('aria-level')) < level)
          if (p) go(rows.indexOf(p), 0)
        } else go(r, col - 1)
        break
      case 'Home': go(e.ctrlKey ? 0 : r, 0); break
      case 'End': go(e.ctrlKey ? rows.length - 1 : r, 99); break
      default: return
    }
    e.preventDefault()
  }

  return enabled ? { ref: gridRef, onKeyDown, onFocus, role: 'treegrid' as const } : { ref: gridRef }
}
