import type { ButtonHTMLAttributes } from 'react'

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        minHeight: 44,
        minWidth: 44,
        padding: 'var(--space-sm) var(--space-md)',
        background: 'var(--color-primary)',
        color: 'var(--color-primary-fg)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        outline: '2px solid transparent',
        outlineOffset: 2,
        ...props.style,
      }}
    />
  )
}
