import type { ButtonHTMLAttributes } from 'react'

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        minHeight: 44,
        minWidth: 44,
        padding: 'var(--space-sm) var(--space-md)',
        background: 'var(--color-primary-background)',
        color: 'var(--color-primary-foreground)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        outline: '2px solid transparent',
        outlineOffset: 2,
        ...props.style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid var(--color-info)'
        if (props.onFocus) props.onFocus(e)
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = '2px solid transparent'
        if (props.onBlur) props.onBlur(e)
      }}
    />
  )
}
