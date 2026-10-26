import type { InputHTMLAttributes } from 'react'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ padding: 'var(--space-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-base)', ...props.style }} />
}
