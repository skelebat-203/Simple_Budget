import { useState } from 'react'

export function DropdownWithSearch({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const filtered = options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search items..."
        style={{ padding: 'var(--space-sm)', width: '100%', minHeight: 44, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
        aria-expanded={open}
        role="combobox"
      />
      {open && filtered.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 200, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', position: 'absolute', width: '100%', background: 'var(--color-bg)', zIndex: 10 }}>
          {filtered.map(o => <li key={o} onClick={() => { onChange(o); setOpen(false) }} style={{ padding: 'var(--space-xs)', cursor: 'pointer', minHeight: 44 }}>{o}</li>)}
        </ul>
      )}
    </div>
  )
}
