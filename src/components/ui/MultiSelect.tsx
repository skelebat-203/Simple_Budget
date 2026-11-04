import { useEffect, useId, useState } from 'react'
import { Button } from './Button'
import { useAnnounce } from './announcer'

export interface MultiOption {
  key: string
  name: string
  /** Shown after the name, e.g. the item's group. */
  group: string
  /** Accessible name when `name` repeats (e.g. "Car, Insurance"). */
  spoken: string
  color: string
}

/**
 * Multi-select with autocomplete (onboarding, 0008 §8). An editable combobox over a
 * listbox with aria-multiselectable: typing filters, Up/Down move, Enter or a click
 * toggles the highlighted option and keeps the list open. Chosen options also show
 * as a list with Remove buttons, so the choice is readable and editable without the list.
 * Typed text that matches no option offers "Add …" when `onAdd` is given; it returns
 * an error message, or null when the text was added.
 */
export function MultiSelect({ id, label, options, selected, onToggle, onAdd, addLabel, describedBy }: {
  id: string
  /** Name of the combobox and listbox. */
  label: string
  options: MultiOption[]
  selected: Set<string>
  onToggle: (key: string) => void
  onAdd?: (text: string) => string | null
  /** Text of the Add option, given the typed text. */
  addLabel?: (text: string) => string
  describedBy?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [error, setError] = useState('')
  const listId = `${id}-listbox`
  const errId = `${id}-error_msg`
  const hint = useId()

  const q = query.trim().toLowerCase()
  const shown = options.filter(o => !q || o.name.toLowerCase().includes(q) || o.group.toLowerCase().includes(q))
  const canAdd = !!onAdd && q !== '' && !options.some(o => o.name.toLowerCase() === q)
  const count = shown.length + (canAdd ? 1 : 0)
  const optId = (i: number) => `${id}-opt-${i}`

  useEffect(() => {
    if (active >= 0) document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' })
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  function choose(i: number) {
    if (i < shown.length) { onToggle(shown[i].key); return }
    const msg = onAdd!(query)
    setError(msg ?? '')
    if (!msg) { setQuery(''); setActive(-1) }
  }

  const chosen = options.filter(o => selected.has(o.key))
  useAnnounce(`${chosen.length} selected`, true)
  useAnnounce(error)
  return (
    <div className="multi">
      <div className="combo">
        <input id={id} className="input" role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId}
          aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
          aria-invalid={!!error || undefined} aria-describedby={[describedBy, hint, error ? errId : ''].filter(Boolean).join(' ')}
          autoComplete="off" value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(-1); setError('') }}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(count - 1, a + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
            else if (e.key === 'Enter') { e.preventDefault(); if (open && active >= 0) choose(active); else if (canAdd) choose(shown.length) }
            else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false) }
          }} />
        {open && (
          <div id={listId} className="listbox" role="listbox" aria-label={label} aria-multiselectable="true" tabIndex={-1}>
            {count === 0 && <p className="listbox-empty">No match.</p>}
            {shown.map((o, i) => (
              <div key={o.key} id={optId(i)} role="option" aria-selected={selected.has(o.key)} aria-label={`${o.spoken}${selected.has(o.key) ? ', selected' : ''}`}
                className={`option${i === active ? ' active' : ''}${selected.has(o.key) ? ' checked' : ''}`}
                onMouseDown={e => { e.preventDefault(); choose(i) }}>
                <span aria-hidden="true">{selected.has(o.key) ? '✓ ' : ''}</span>{o.name} <span className="help">{o.group}</span>
              </div>
            ))}
            {canAdd && (
              <div id={optId(shown.length)} role="option" aria-selected="false" className={`option add${shown.length === active ? ' active' : ''}`}
                onMouseDown={e => { e.preventDefault(); choose(shown.length) }}>
                {addLabel ? addLabel(query.trim()) : `Add “${query.trim()}”`}
              </div>
            )}
          </div>
        )}
      </div>
      <p id={hint} className="help">Type to search; Up and Down arrows move; Enter picks or removes the highlighted item.</p>
      {error && <p id={errId} className="error">{error}</p>}
      <p className="status">{chosen.length} selected</p>
      {chosen.length > 0 && (
        <ul className="plain-list chips" aria-label="Selected items">
          {chosen.map(o => (
            <li key={o.key} className="chip">
              <span>{o.name} <span className="help">{o.group}</span></span>
              <Button type="button" className="secondary small" aria-label={`Remove ${o.spoken}`} onClick={() => onToggle(o.key)}><span aria-hidden="true">×</span></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
