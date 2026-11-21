import { useMemo, useState } from 'react'
import { ancestors, displayName, domId, flatten, isSoloCharity, isTotal, repeatedNames, spokenName, type CatNode } from '../../budget/tree'
import { Combobox, type ComboGroup, type ComboOption } from './Combobox'

interface Group { heading: CatNode; options: CatNode[] }

/**
 * Item and category picker (roadmap v0.3; 0007 §4.1, §8.3): the shared Combobox over the budget tree.
 * Options sit under their parent's heading, and the heading in view sticks to the top of the list.
 * Headings are never options.
 *
 * - mode 'item': every row that takes amounts. Before the user types, only
 *   rows passing `initial` show; typing searches everything.
 * - mode 'category': the rows directly under Income, Savings and Expenses,
 *   under those headings, so the user can pick where something goes.
 *
 * Typed text that names exactly one option picks it. `onText` reports the
 * text so a form can offer to create something new.
 */
export function ItemSelector({ id, roots, mode = 'item', initial, defaultTarget, onChange, onText, invalid, describedBy, required = true, label }: {
  id: string
  roots: CatNode[]
  mode?: 'item' | 'category'
  initial?: (n: CatNode) => boolean
  /** Row already chosen when the control opens (editing a saved purchase). */
  defaultTarget?: CatNode
  onChange: (target: CatNode | null) => void
  onText?: (text: string, matches: number) => void
  invalid?: boolean
  describedBy?: string
  required?: boolean
  /** Listbox name. */
  label: string
}) {
  const [query, setQuery] = useState(() => (defaultTarget ? displayName(defaultTarget) : ''))

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

  const nodes = useMemo(() => new Map(groups.flatMap(g => g.options).map(n => [String(n.cat.id), n])), [groups])
  const comboGroups: ComboGroup[] = useMemo(() => groups.map(g => ({
    key: String(g.heading.cat.id),
    heading: g.heading.cat.name,
    headingId: domId(`${id}_heading`, g.heading),
    headingClassName: `clr-${g.heading.cat.color}`,
    options: g.options.map((n): ComboOption => ({
      value: String(n.cat.id), label: n.cat.name, id: domId(id, n),
      search: [n, ...ancestors(n)].map(x => x.cat.name),
      ariaLabel: repeated.has(n.cat.name) ? spokenName(n, repeated) : undefined,
      className: `clr-${n.cat.color}`,
    })),
  })), [groups, repeated, id])

  const exact = (text: string) => [...nodes.values()].filter(n => n.cat.name.toLowerCase() === text.trim().toLowerCase())

  function type(text: string) {
    setQuery(text)
    const m = exact(text)
    onText?.(text, m.length)
    onChange(m.length === 1 ? m[0] : null)
  }
  function pick(o: ComboOption) {
    const n = nodes.get(o.value)!
    setQuery(displayName(n))
    onText?.(displayName(n), 1)
    onChange(n)
  }

  const emptyText = query.trim() ? 'No match.' : mode === 'item' ? 'No items selected yet. Start typing to search every item.' : 'Nothing to pick.'
  return (
    <Combobox id={id} label={label} groups={comboGroups} query={query} onQueryChange={type} onPick={pick}
      initial={initial ? o => initial(nodes.get(o.value)!) : undefined} emptyText={emptyText}
      required={required} invalid={invalid} describedBy={describedBy} />
  )
}
