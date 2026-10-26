import type { ButtonHTMLAttributes } from 'react'

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', ...props.style }} />
}
