export interface FieldError {
  /** id of the errant field (link target). */
  fieldId: string
  /** e.g. "Error: Amount cannot be empty" */
  message: string
}

/** Focus rule: ≤3 errors → first errant field; 4+ → the banner. */
export function focusFirstError(errors: FieldError[], banner: HTMLElement | null) {
  if (!errors.length) return
  if (errors.length >= 4) banner?.focus()
  else document.getElementById(errors[0].fieldId)?.focus()
}
