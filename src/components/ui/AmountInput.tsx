import type { InputHTMLAttributes } from 'react'
import { Input } from './Input'

export function AmountInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="number" step="0.01" min="0" {...props} />
}
