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
 * - `stacked` puts name and hint above the pill, keeps option labels on one line, and swaps in a select box below 640px.
 * - `card` draws a 1px border around the name, pill and hint.
 */
export function Toggle<V extends string>({ name, options, value, onChange, suffix, hint, card, stacked }: {
  name: string
  options: { value: V; label: string }[]
  value: V | null
  onChange: (value: V) => void
  suffix?: string
  hint?: string
  card?: boolean
  /** Name and hint above the pill at every width; the pill's options never wrap. Below 640px a select box with the same name, hint, options and value replaces the pill. */
  stacked?: boolean
}) {
  const id = useId()
  const nameId = `${id}-name`
  const suffixId = `${id}-suffix`
  const hintId = `${id}-hint`
  const hintDescribes = hint ? hintId : undefined
  return (
    <div className={`toggle-field${suffix ? ' with-suffix' : ''}${card ? ' toggle-card' : ''}${stacked ? ' toggle-stacked' : ''}`}>
      <span className="toggle-name" id={nameId}>{name}</span>
      {stacked && hint && <p id={hintId} className="toggle-hint">{hint}</p>}
      {stacked && (
        <select id={`${id}-select`} className="input toggle-select" aria-labelledby={nameId} aria-describedby={hintDescribes}
          value={value ?? ''} onChange={e => onChange(e.target.value as V)}>
          {value === null && <option value="" disabled />}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <div className="toggle-row">
        <div className="toggle" role="radiogroup" aria-labelledby={nameId} aria-describedby={hintDescribes}>
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
      {!stacked && hint && <p id={hintId} className="toggle-hint">{hint}</p>}
    </div>
  )
}
