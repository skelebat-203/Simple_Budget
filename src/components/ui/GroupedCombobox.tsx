import { useEffect, useId, useMemo, useState } from 'react'
import { announce } from './announcer'

export interface ComboOption { value: string; label: string }
/** A heading with options under it. Give `choice` to make the heading itself a selectable option (shown in bold). */
export interface ComboGroup { key: string; heading: string; choice?: string; options: ComboOption[] }

/**
 * Searchable combobox over grouped choices, same markup and keys as ItemSelector (0007 §4.1, §8.3):
 * type to filter, Down arrow shows every choice, Enter picks, Escape closes the list only.
 * Typed text that names exactly one choice picks it. The count of matches is announced politely while typing.
 * `value` is the picked choice (null when none); the text box shows its label.
 */
export function GroupedCombobox({ id, label, groups, value, onChange, invalid, describedBy, required = true }: {
  id: string
  /** Listbox name. */
  label: string
  groups: ComboGroup[]
  value: string | null
  onChange: (value: string | null) => void
  invalid?: boolean
  describedBy?: string
  required?: boolean
}) {
  const uid = useId()
  const all = useMemo(() => groups.flatMap(g => [...(g.choice != null ? [{ value: g.choice, label: g.heading }] : []), ...g.options]), [groups])
  const [query, setQuery] = useState(() => all.find(o => o.value === value)?.label ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = `${id}-listbox`
  const optId = (o: ComboOption) => `${id}-opt-${o.value}`

  const q = query.trim().toLowerCase()
  const match = (o: ComboOption) => !q || o.label.toLowerCase().includes(q)
  const shown = groups
    .map(g => ({ g, head: g.choice != null && match({ value: g.choice, label: g.heading }), options: g.options.filter(match) }))
    .filter(x => x.head || x.options.length)
  const flat = shown.flatMap(x => [...(x.head ? [{ value: x.g.choice!, label: x.g.heading }] : []), ...x.options])

  useEffect(() => {
    if (open && q) announce(flat.length === 1 ? '1 choice available.' : `${flat.length} choices available.`)
  }, [open, q, flat.length])
  useEffect(() => {
    if (active >= 0 && flat[active]) document.getElementById(optId(flat[active]))?.scrollIntoView({ block: 'nearest' })
  })

  function pick(o: ComboOption) {
    setQuery(o.label); setOpen(false); setActive(-1)
    onChange(o.value)
  }
  function type(text: string) {
    setQuery(text); setOpen(true); setActive(-1)
    const m = all.filter(o => o.label.toLowerCase() === text.trim().toLowerCase())
    onChange(m.length === 1 ? m[0].value : null)
  }
  const move = (d: number) => { setOpen(true); setActive(a => Math.max(0, Math.min(flat.length - 1, a + d))) }

  return (
    <div className="combo">
      <input id={id} className="input" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 && flat[active] ? optId(flat[active]) : undefined}
        aria-required={required || undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        autoComplete="off" value={query}
        onChange={e => type(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
          else if (e.key === 'Enter' && open && active >= 0 && flat[active]) { e.preventDefault(); pick(flat[active]) }
          else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false) }
        }} />
      <svg className="combo-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" /></svg>
      {open && (
        <div id={listId} className="listbox" role="listbox" aria-label={label} tabIndex={-1}>
          {flat.length === 0 && <p className="listbox-empty">No rows match.</p>}
          {shown.map(x => {
            const hid = `${uid}-h-${x.g.key}`
            const one = (o: ComboOption, cls: string) => (
              <li key={o.value} id={optId(o)} role="option" aria-selected={active >= 0 && flat[active]?.value === o.value} className={cls}
                onMouseDown={e => { e.preventDefault(); pick(o) }}>{o.label}</li>
            )
            return (
              <ul key={x.g.key} role="group" aria-labelledby={x.g.choice != null ? undefined : hid} aria-label={x.g.choice != null ? x.g.heading : undefined} className="option-group">
                {x.g.choice != null
                  ? x.head && one({ value: x.g.choice, label: x.g.heading }, 'option option-choice')
                  : <li role="presentation" id={hid} className="option-heading">{x.g.heading}</li>}
                {x.options.map(o => one(o, 'option'))}
              </ul>
            )
          })}
        </div>
      )}
    </div>
  )
}
