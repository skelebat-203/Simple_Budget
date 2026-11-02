import { forwardRef } from 'react'

import type { FieldError } from './errors'

/**
 * Error banner per digital_accessibility.md: h2 heading, then a list whose
 * items link to each errant field. Focusable so 4+ errors can move focus here.
 */
export const ErrorSummary = forwardRef<HTMLDivElement, { errors: FieldError[] }>(function ErrorSummary({ errors }, ref) {
  if (!errors.length) return null
  return (
    <div ref={ref} className="banner" role="alert" tabIndex={-1}>
      <h2 className="banner-title">To continue, correct the following errors</h2>
      <ul>
        {errors.map(e => (
          <li key={e.fieldId}>
            <a href={`#${e.fieldId}`} onClick={ev => { ev.preventDefault(); document.getElementById(e.fieldId)?.focus() }}>{e.message}</a>
          </li>
        ))}
      </ul>
    </div>
  )
})
