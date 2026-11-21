import { useState } from 'react'
import { Combobox, type ComboGroup, type ComboOption } from '../ui'

/** "Where should X go?" picker (14d): the shared Combobox over the place choices. Typed text that names exactly one choice picks it. */
export function PlaceField({ id, label, groups, value, onChange, invalid, describedBy }: {
  id: string
  /** Listbox name. */
  label: string
  groups: ComboGroup[]
  /** The picked choice, or null. */
  value: string | null
  onChange: (value: string | null) => void
  invalid?: boolean
  describedBy?: string
}) {
  const all: ComboOption[] = groups.flatMap(g => [...(g.choice != null ? [{ value: g.choice, label: g.heading ?? '' }] : []), ...g.options])
  const [query, setQuery] = useState(() => all.find(o => o.value === value)?.label ?? '')
  function type(text: string) {
    setQuery(text)
    const m = all.filter(o => o.label.toLowerCase() === text.trim().toLowerCase())
    onChange(m.length === 1 ? m[0].value : null)
  }
  return (
    <Combobox id={id} label={label} groups={groups} query={query} onQueryChange={type}
      onPick={o => { setQuery(o.label); onChange(o.value) }}
      emptyText="No rows match." announceCount chevron required invalid={invalid} describedBy={describedBy} />
  )
}
