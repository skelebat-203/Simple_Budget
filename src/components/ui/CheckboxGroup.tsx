import type { ReactNode } from 'react'

export function CheckboxGroup({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>{children}</div>
}
