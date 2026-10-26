import { useState } from 'react'

export function DropdownWithSearch({ options, onSelect }: { options: string[]; onSelect: (v: string) => void }) {
  const [q, setQ] = useState('')
  const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." style={{ padding: 'var(--space-sm)', width: '100%' }} />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 200, overflow: 'auto' }}>
        {filtered.map(o => <li key={o} onClick={() => onSelect(o)} style={{ padding: 'var(--space-xs)', cursor: 'pointer' }}>{o}</li>)}
      </ul>
    </div>
  )
}
