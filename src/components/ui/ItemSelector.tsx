import { useId, useMemo, useState } from 'react'
import { ancestors, displayName, entryTarget, flatten, type CatNode } from '../../budget/tree'

/**
 * Combined "Item" control (stuff.md #1): one combobox over every category,
 * subcategory and item, filtered as the user types, colored and weighted by
 * level, in tree order. Picking a group heading that can't take an amount
 * narrows the list to that group instead.
 */
export function ItemSelector({ id, roots, onChange, invalid, describedBy }: {
  id: string
  roots: CatNode[]
  onChange: (target: CatNode | null) => void
  invalid?: boolean
  describedBy?: string
}) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const all = useMemo(() => flatten(roots).filter(n => n.cat.name !== 'Net Income'), [roots])
  const q = query.trim().toLowerCase()
  const shown = q
    ? all.filter(n => [n, ...ancestors(n)].some(x => x.cat.name.toLowerCase().includes(q)))
    : all

  function pick(n: CatNode) {
    const target = entryTarget(n)
    if (!target) { setQuery(n.cat.name); setActive(-1); return }
    setQuery(displayName(n))
    setOpen(false)
    setActive(-1)
    onChange(target)
  }

  function move(delta: number) {
    setOpen(true)
    const next = Math.max(0, Math.min(shown.length - 1, active + delta))
    setActive(next)
    document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div className="combo">
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-required="true"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder="Start typing, e.g. coffee"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActive(-1); onChange(null) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
          else if (e.key === 'Enter' && open && active >= 0) { e.preventDefault(); pick(shown[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && (
        <ul id={listId} className="listbox" role="listbox" aria-label="Items" tabIndex={-1}>
          {shown.length === 0 && <li className="listbox-empty">No match. Add it in Set estimates.</li>}
          {shown.map((n, i) => (
            <li
              key={n.cat.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`option depth-${n.depth}${n.children.length ? ' group' : ''} clr-${n.cat.color}`}
              onMouseDown={e => { e.preventDefault(); pick(n) }}
            >
              {n.cat.name}
              {q && n.parent && <span className="option-path"> · {ancestors(n).map(a => a.cat.name).join(' › ')}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
