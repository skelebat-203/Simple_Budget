import { useId } from 'react'

/**
 * Pill-shaped choice between a few text options (design standards 0012 §3).
 * A native radio group: one Tab stop, arrow keys move and select, no aria-pressed.
 * The chosen option fills its whole part of the pill and turns bold, so colour is never the only cue.
 * `value` null means no option is chosen (a mixed state). Text only; no icons.
 *
 * - `name` is the visible group name (left of the pill from 640px wide, above it below).
 * - `suffix` is closing text after the pill ("data"): each radio is then named "{name} {option} {suffix}".
 * - `hint` is extra help read after the group name.
 * - `card` draws a 1px border around the name, pill and hint.
 */
export function Toggle<V extends string>({ name, options, value, onChange, suffix, hint, card }: {
  name: string
  options: { value: V; label: string }[]
  value: V | null
  onChange: (value: V) => void
  suffix?: string
  hint?: string
  card?: boolean
}) {
  const id = useId()
  const nameId = `${id}-name`
  const suffixId = `${id}-suffix`
  const hintId = `${id}-hint`
  return (
    <div className={`toggle-field${suffix ? ' with-suffix' : ''}${card ? ' toggle-card' : ''}`}>
      <span className="toggle-name" id={nameId}>{name}</span>
      <div className="toggle-row">
        <div className="toggle" role="radiogroup" aria-labelledby={nameId} aria-describedby={hint ? hintId : undefined}>
          {options.map(o => (
            <label key={o.value} className="toggle-option">
              <input type="radio" name={id} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)}
                aria-labelledby={suffix ? `${nameId} ${id}-${o.value} ${suffixId}` : undefined} />
              <span id={`${id}-${o.value}`}>{o.label}</span>
            </label>
          ))}
        </div>
        {suffix && <span id={suffixId} className="toggle-name">{suffix}</span>}
      </div>
      {hint && <p id={hintId} className="toggle-hint">{hint}</p>}
    </div>
  )
}
