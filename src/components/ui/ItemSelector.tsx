import { useEffect, useMemo, useState } from 'react'
import { ancestors, displayName, domId, flatten, isSoloCharity, isTotal, repeatedNames, spokenName, type CatNode } from '../../budget/tree'

interface Group { heading: CatNode; options: CatNode[] }

/**
 * Shared search/filter dropdown (roadmap v0.3; 0007 §4.1, §8.3). A combobox
 * over a grouped listbox: options sit under their parent's heading, and the
 * heading in view sticks to the top of the list. Headings are never options.
 *
 * - mode 'item': every row that takes amounts. Before the user types, only
 *   rows passing `initial` show; typing searches everything.
 * - mode 'category': the rows directly under Income, Savings and Expenses,
 *   under those headings, so the user can pick where something goes.
 *
 * Typed text that names exactly one option picks it. `onText` reports the
 * text so a form can offer to create something new.
 */
export function ItemSelector({ id, roots, mode = 'item', initial, onChange, onText, invalid, describedBy, required = true, placeholder, label }: {
  id: string
  roots: CatNode[]
  mode?: 'item' | 'category'
  initial?: (n: CatNode) => boolean
  onChange: (target: CatNode | null) => void
  onText?: (text: string, matches: number) => void
  invalid?: boolean
  describedBy?: string
  required?: boolean
  placeholder?: string
  /** Listbox name. */
  label: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = `${id}-listbox`

  const repeated = useMemo(() => repeatedNames(roots), [roots])
  const groups: Group[] = useMemo(() => {
    const all = flatten(roots).filter(n => n.cat.name !== 'Net Income')
    if (mode === 'category') {
      return roots.filter(r => r.cat.computed && r.cat.name !== 'Net Income').map(r => ({ heading: r, options: r.children }))
    }
    // Item mode: every row that takes amounts, grouped by parent (a top-level row is its own heading).
    const byParent = new Map<CatNode, CatNode[]>()
    for (const n of all) {
      if (isTotal(n) && !isSoloCharity(n)) continue
      // While Charity takes purchases itself, its Miscellaneous child is not offered (0009 §6).
      if (n.cat.name === 'Miscellaneous' && n.parent && isSoloCharity(n.parent)) continue
      const h = n.parent ?? n
      byParent.set(h, [...(byParent.get(h) ?? []), n])
    }
    return all.filter(n => byParent.has(n)).map(h => ({ heading: h, options: byParent.get(h)! }))
  }, [roots, mode])

  const q = query.trim().toLowerCase()
  const shown = groups
    .map(g => ({
      ...g,
      options: g.options.filter(n => q
        ? [n, ...ancestors(n)].some(x => x.cat.name.toLowerCase().includes(q))
        : !initial || initial(n)),
    }))
    .filter(g => g.options.length)
  const flat = shown.flatMap(g => g.options)
  const exact = (text: string) => groups.flatMap(g => g.options).filter(n => n.cat.name.toLowerCase() === text.trim().toLowerCase())

  // Keep the active option in view below the sticky heading.
  useEffect(() => {
    if (active >= 0 && flat[active]) document.getElementById(domId(id, flat[active]))?.scrollIntoView({ block: 'nearest' })
  }, [active, flat, id])

  function pick(n: CatNode) {
    setQuery(displayName(n))
    setOpen(false)
    setActive(-1)
    onText?.(displayName(n), 1)
    onChange(n)
  }

  function type(text: string) {
    setQuery(text)
    setOpen(true)
    setActive(-1)
    const m = exact(text)
    onText?.(text, m.length)
    onChange(m.length === 1 ? m[0] : null)
  }

  const move = (delta: number) => {
    setOpen(true)
    setActive(a => Math.max(0, Math.min(flat.length - 1, a + delta)))
  }

  const empty = q ? 'No match.' : mode === 'item' ? 'No items selected yet. Start typing to search every item.' : 'Nothing to pick.'

  return (
    <div className="combo">
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 && flat[active] ? domId(id, flat[active]) : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={e => type(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
          else if (e.key === 'Enter' && open && active >= 0 && flat[active]) { e.preventDefault(); pick(flat[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && (
        <div id={listId} className="listbox" role="listbox" aria-label={label} tabIndex={-1}>
          {flat.length === 0 && <p className="listbox-empty">{empty}</p>}
          {shown.map(g => {
            const hid = domId(`${id}_heading`, g.heading)
            return (
              <ul key={g.heading.cat.id} role="group" aria-labelledby={hid} className="option-group">
                <li role="presentation" id={hid} className={`option-heading clr-${g.heading.cat.color}`}>{g.heading.cat.name}</li>
                {g.options.map(n => {
                  const i = flat.indexOf(n)
                  return (
                    <li key={n.cat.id} id={domId(id, n)} role="option" aria-selected={i === active}
                      aria-label={repeated.has(n.cat.name) ? spokenName(n, repeated) : undefined}
                      className={`option clr-${n.cat.color}`}
                      onMouseDown={e => { e.preventDefault(); pick(n) }}>
                      {n.cat.name}
                    </li>
                  )
                })}
              </ul>
            )
          })}
        </div>
      )}
    </div>
  )
}
