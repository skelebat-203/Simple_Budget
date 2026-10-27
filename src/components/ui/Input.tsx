import type { InputHTMLAttributes } from 'react'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        minHeight: 44,
        padding: 'var(--space-sm)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--font-size-base)',
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
