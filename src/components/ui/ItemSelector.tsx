import { useState, useEffect, useRef } from 'react'
import { categoryRepo } from '../../storage/repository'
import type { BudgetType, Category } from '../../storage/db'

export interface ItemOption {
  name: string
  category: string
  type: BudgetType
  level: 'category' | 'subcategory' | 'item'
  color: string
  parent?: string
  root?: string
}

const TOP_LEVEL_TYPE: Record<string, BudgetType> = {
  Pay: 'income',
  'Incidental Income': 'income',
  'Net Income': 'income',
  Savings: 'savings',
}

export function buildOptions(cats: Category[]): ItemOption[] {
  const byId = new Map<number, Category>()
  for (const c of cats as any[]) {
    if (typeof c.id === 'number') byId.set(c.id, c as Category)
  }
  const kids = new Map<number, Category[]>()
  for (const c of cats as any[]) {
    const pid = c.parentId == null ? -1 : c.parentId
    const list = kids.get(pid)
    if (list) {
      list.push(c as Category)
    } else {
      kids.set(pid, [c as Category])
    }
  }
  const hasChildren = (id: number | null): boolean => {
    if (id == null) {
      const list = kids.get(-1)
      if (!list) return false
      return list.some((c: any) => c.parentId === null)
    }
    const list = kids.get(id)
    if (!list) return false
    return list.some((c: any) => c.parentId === id)
  }
  const inferType = (name: string, parentId: any): BudgetType => {
    const t = (TOP_LEVEL_TYPE as any)[name]
    if (t) return t
    if (parentId == null) return 'expense'
    const parent = byId.get(parentId)
    if (!parent) return 'expense'
    return inferType((parent as any).name, (parent as any).parentId == null ? null : (parent as any).parentId)
  }
  const options: ItemOption[] = []
  const roots = (cats as any[]).filter((c: any) => c.parentId === null).sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0))
  for (let r = 0; r < roots.length; r++) {
    const root: any = roots[r]
    options.push({ name: root.name, category: root.name, type: inferType(root.name, null), level: 'category', color: root.color, root: root.name })
    const direct = kids.get(-1) ?? []
    const subs = direct.filter((c: any) => c.parentId === root.id && hasChildren(c.id)).sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0))
    for (let s = 0; s < subs.length; s++) {
      const sub: any = subs[s]
      options.push({ name: sub.name, category: root.name, type: inferType(sub.name, sub.parentId == null ? null : sub.parentId), level: 'subcategory', color: sub.color, parent: root.name, root: root.name })
      if (typeof sub.id === 'number') {
        const subLeaves = (kids.get(sub.id) ?? []).filter((c: any) => c.parentId === sub.id && !hasChildren(c.id)).sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0))
        for (let i = 0; i < subLeaves.length; i++) {
          const leaf: any = subLeaves[i]
          options.push({ name: leaf.name, category: sub.name, type: inferType(leaf.name, leaf.parentId == null ? null : leaf.parentId), level: 'item', color: leaf.color, parent: sub.name, root: root.name })
        }
      }
    }
    const leaves = direct.filter((c: any) => c.parentId === root.id && !hasChildren(c.id)).sort((a: any, b: any) => (a.id ?? 0) - (b.id ?? 0))
    for (let i = 0; i < leaves.length; i++) {
      const leaf: any = leaves[i]
      options.push({ name: leaf.name, category: root.name, type: inferType(leaf.name, leaf.parentId == null ? null : leaf.parentId), level: 'item', color: leaf.color, parent: root.name, root: root.name })
    }
  }
  return options
}

export function ItemSelector({ value, onChange, onTextChange, id, 'aria-required': ariaRequired, 'aria-describedby': ariaDescribedby, placeholder = 'Search items...' }: { value: string; onChange: (option: ItemOption | null) => void; onTextChange?: (text: string) => void; id?: string; 'aria-required'?: boolean; 'aria-describedby'?: string; placeholder?: string }) {
  const [options, setOptions] = useState<ItemOption[]>([])
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [selected, setSelected] = useState<ItemOption | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = id ? `${id}-listbox` : undefined

  useEffect(() => {
    categoryRepo.list().then(cats => {
      setOptions(buildOptions(cats as any))
    })
  }, [])

  useEffect(() => {
    setQuery(value)
    setSelected(options.find(o => o.name === value) ?? null)
  }, [value, options])

  const filtered = options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))

  function pick(opt: ItemOption) {
    setSelected(opt)
    setQuery(opt.name)
    setOpen(false)
    setActiveIndex(-1)
    onChange(opt)
    onTextChange?.(opt.name)
  }

  return (
    <div className="dropdown" role="none">
      <input
        ref={inputRef}
        id={id}
        className="dropdown-input item-selector-input"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); setSelected(null); onChange(null); onTextChange?.(e.target.value) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setOpen(true)
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex(i => Math.max(i - 1, -1))
          } else if (e.key === 'Enter') {
            if (activeIndex >= 0 && filtered[activeIndex]) {
              e.preventDefault()
              pick(filtered[activeIndex])
              return
            }
            setOpen(false)
            setActiveIndex(-1)
          } else if (e.key === 'Escape') {
            setOpen(false)
            setActiveIndex(-1)
            setQuery(selected ? selected.name : value)
          }
        }}
        placeholder={placeholder}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 && id ? `${id}-option-${activeIndex}` : undefined}
        role="combobox"
        aria-required={ariaRequired}
        aria-describedby={ariaDescribedby}
        autoComplete="off"
      />
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="dropdown-list item-selector-list"
        >
          {filtered.length === 0 ? (
            <li role="option" aria-disabled="true" className="dropdown-option item item-selector-empty">No matching items</li>
          ) : (
            filtered.map((o, idx) => {
              const colorClass = `clr-${o.color}`
              return (
                <li
                  key={`${o.name}-${idx}`}
                  id={id ? `${id}-option-${idx}` : undefined}
                  role="option"
                  aria-selected={selected?.name === o.name}
                  aria-roledescription={o.level}
                  data-active={idx === activeIndex}
                  onMouseDown={(ev) => { ev.preventDefault(); pick(o) }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`dropdown-option item-selector-option ${o.level} ${colorClass}`}
                >
                  {o.name}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
