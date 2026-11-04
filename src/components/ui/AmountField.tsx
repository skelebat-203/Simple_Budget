import { useId, type InputHTMLAttributes } from 'react'
import { parseAmount } from '../../budget/validate'
import { formatAmount } from '../../budget/tree'
import { Input } from './Input'

/**
 * Text amount field that also reads sums such as `12.50+3` or `40-5.25`.
 * When a typed sum is valid, its result shows under the field (not a live region;
 * it is read when the field is focused, through aria-describedby).
 */
export function AmountField({ allowNegative, describedBy, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'> & {
  allowNegative: boolean
  describedBy?: string
  value: string
}) {
  const resultId = useId()
  const r = parseAmount(props.value, { allowNegative })
  const result = r.ok && r.expr ? `Result: ${formatAmount(r.value) || '0.00'}` : ''
  const described = [props['aria-describedby'], describedBy, result ? resultId : ''].filter(Boolean).join(' ') || undefined
  return (
    <>
      <Input {...props} type="text" inputMode="text" autoComplete="off" spellCheck={false} aria-describedby={described} />
      {result && <p id={resultId} className="help">{result}</p>}
    </>
  )
}
