import { useState, useRef } from 'react'

export function DropdownWithSearch({ options, value, onChange, id, 'aria-required': ariaRequired, 'aria-describedby': ariaDescribedby }: { options: string[]; value: string; onChange: (v: string) => void; id?: string; 'aria-required'?: boolean; 'aria-describedby'?: string }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const filtered = options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActiveIndex(-1) }}
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
          } else if (e.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
            e.preventDefault()
            onChange(filtered[activeIndex])
            setOpen(false)
            setActiveIndex(-1)
          } else if (e.key === 'Escape') {
            setOpen(false)
            setActiveIndex(-1)
          }
        }}
        placeholder="Search items..."
        style={{ padding: 'var(--space-sm)', width: '100%', minHeight: 44, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-activedescendant={activeIndex >= 0 && id ? `${id}-option-${activeIndex}` : undefined}
        role="combobox"
        aria-required={ariaRequired}
        aria-describedby={ariaDescribedby}
      />
      {open && filtered.length > 0 && (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 200, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', position: 'absolute', width: '100%', background: 'var(--color-background-page)', zIndex: 10 }}
        >
          {filtered.map((o, idx) => (
            <li
              key={o}
              id={id ? `${id}-option-${idx}` : undefined}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); setActiveIndex(-1) }}
              onMouseEnter={() => setActiveIndex(idx)}
              style={{ padding: 'var(--space-xs)', cursor: 'pointer', minHeight: 44, background: idx === activeIndex ? 'var(--color-border)' : undefined }}
            >{o}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
