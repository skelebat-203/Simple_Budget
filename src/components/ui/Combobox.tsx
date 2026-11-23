import { useEffect, useId, useState } from 'react'
import { announce } from './announcer'

export interface ComboOption {
  value: string
  label: string
  /** DOM id; defaults to `{id}-opt-{value}`. */
  id?: string
  /** Texts the typed search is matched against; defaults to the label. */
  search?: string[]
  /** Accessible name when the label alone is ambiguous. */
  ariaLabel?: string
  className?: string
}

/**
 * A heading with options under it. No heading: the options sit directly in the list.
 * `choice` makes the heading itself a selectable option, shown in bold.
 */
export interface ComboGroup {
  key: string
  heading?: string
  headingId?: string
  headingClassName?: string
  choice?: string
  options: ComboOption[]
}

/**
 * The app's one searchable combobox (roadmap v0.3; 0007 §4.1, §8.3): a text box over a grouped listbox.
 * Type to filter, Down arrow shows every choice, Up and Down move, Enter picks, Escape closes the list only.
 * The caller owns the text (`query`) and what a pick means (`onPick`); this component owns the list:
 * which options match, which one is active, and the ARIA wiring.
 *
 * - Before the user types, only options passing `initial` show; typing searches every option.
 * - `announceCount` announces how many choices match while the user types.
 * - The caller labels the text box with a `<label htmlFor={id}>` or `inputLabel`.
 */
export function Combobox({ id, label, groups, query, onQueryChange, onPick, initial, emptyText, announceCount, invalid, describedBy, required, inputLabel, chevron }: {
  id: string
  /** Listbox name. */
  label: string
  groups: ComboGroup[]
  query: string
  onQueryChange: (text: string) => void
  onPick: (option: ComboOption) => void
  initial?: (option: ComboOption) => boolean
  /** Shown in the list when nothing matches. */
  emptyText: string
  announceCount?: boolean
  invalid?: boolean
  describedBy?: string
  required?: boolean
  inputLabel?: string
  /** Draw a down chevron in the text box. */
  chevron?: boolean
}) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = `${id}-listbox`
  const optId = (o: ComboOption) => o.id ?? `${id}-opt-${o.value}`

  const q = query.trim().toLowerCase()
  const match = (o: ComboOption) => q ? (o.search ?? [o.label]).some(s => s.toLowerCase().includes(q)) : !initial || initial(o)
  const shown = groups
    .map(g => {
      const head = g.choice != null ? { value: g.choice, label: g.heading ?? '' } : undefined
      return { g, head: head && match(head) ? head : undefined, options: g.options.filter(match) }
    })
    .filter(x => x.head || x.options.length)
  const flat = shown.flatMap(x => [...(x.head ? [x.head] : []), ...x.options])

  useEffect(() => {
    if (announceCount && open && q) announce(flat.length === 1 ? '1 choice available.' : `${flat.length} choices available.`)
  }, [announceCount, open, q, flat.length])
  // Keep the active option in view below the sticky heading.
  useEffect(() => {
    if (active >= 0 && flat[active]) document.getElementById(optId(flat[active]))?.scrollIntoView({ block: 'nearest' })
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(o: ComboOption) {
    setOpen(false); setActive(-1)
    onPick(o)
  }
  const move = (d: number) => { setOpen(true); setActive(a => Math.max(0, Math.min(flat.length - 1, a + d))) }

  const option = (o: ComboOption, cls: string) => (
    <li key={o.value} id={optId(o)} role="option" aria-selected={active >= 0 && flat[active]?.value === o.value}
      aria-label={o.ariaLabel} className={`${cls}${o.className ? ` ${o.className}` : ''}`}
      onMouseDown={e => { e.preventDefault(); pick(o) }}>{o.label}</li>
  )

  return (
    <div className={`combo${chevron ? ' has-chevron' : ''}`}>
      <input id={id} className="input" role="combobox" aria-label={inputLabel} aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 && flat[active] ? optId(flat[active]) : undefined}
        aria-required={required || undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        autoComplete="off" spellCheck value={query}
        onChange={e => { onQueryChange(e.target.value); setOpen(true); setActive(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
          else if (e.key === 'Enter' && open && active >= 0 && flat[active]) { e.preventDefault(); pick(flat[active]) }
          else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false) } // closes the list only, not a dialog around it
        }} />
      {chevron && <svg className="combo-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" /></svg>}
      {open && (
        <div id={listId} className="listbox" role="listbox" aria-label={label} tabIndex={-1}>
          {flat.length === 0 && <p className="listbox-empty">{emptyText}</p>}
          {shown.map(x => {
            if (x.g.heading == null) return x.options.map(o => option(o, 'option'))
            const hid = x.g.headingId ?? `${uid}-heading-${x.g.key}`
            return (
              <ul key={x.g.key} role="group" aria-labelledby={x.head ? undefined : hid} aria-label={x.head ? x.g.heading : undefined} className="option-group">
                {x.head
                  ? option(x.head, 'option option-choice')
                  : <li role="presentation" id={hid} className={`option-heading${x.g.headingClassName ? ` ${x.g.headingClassName}` : ''}`}>{x.g.heading}</li>}
                {x.options.map(o => option(o, 'option'))}
              </ul>
            )
          })}
        </div>
      )}
    </div>
  )
}
