import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Dialog } from '../components/ui'
import { useAnnounce } from '../components/ui/announcer'
import { saveSetup } from '../storage/repository'
import type { Category, Frequency } from '../storage/db'
import { buildTree, FREQUENCIES, flatten, isTotal, scheduleClears, type Cat } from '../budget/tree'
import * as edit from '../budget/setupEdits'

type Step = 1 | 2 | 3
const STEPS = 3

interface Option { key: string; name: string; group: string; groupKey: string }

/**
 * Onboarding wizard (0009 §1, prototype 0010): three steps with a progress bar.
 * 1 pay frequency; 2 presets or own categories; 3 a grouped, collapsible checklist.
 * Shown on first run (Skip remembers it was skipped) and reopened by the ? help button (Cancel).
 */
export function Onboarding({ cats, firstRun, onClose, onSkip, onDone, onAdvanced }: {
  cats: Category[]
  firstRun: boolean
  onClose: () => void
  /** First run only: remember the wizard was skipped. */
  onSkip: () => void
  onDone: () => void
  /** Advanced setup: the answers are saved first, then the caller closes the wizard and opens Budget setup. */
  onAdvanced: () => void
}) {
  const original = useMemo(() => cats.filter((c): c is Cat => typeof c.id === 'number'), [cats])
  const roots = useMemo(() => buildTree(original), [original])
  const incomeItems = useMemo(() => {
    const income = roots.find(r => r.cat.name === 'Income')
    return income ? flatten([income]).filter(n => n !== income && !isTotal(n)) : []
  }, [roots])

  // Every preloaded Savings and Expenses item, grouped by its parent (0009 §1 step 3).
  const options: Option[] = useMemo(() => roots
    .filter(r => r.cat.name === 'Savings' || r.cat.name === 'Expenses')
    .flatMap(r => flatten([r]).filter(n => n !== r && !isTotal(n)).map(n => ({
      key: String(n.cat.id), name: n.cat.name,
      group: n.parent === r ? r.cat.name : `${r.cat.name} › ${n.parent!.cat.name}`, groupKey: String(n.parent!.cat.id),
    }))), [roots])
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; label: string; items: Option[] }>()
    for (const o of options) {
      const g = m.get(o.groupKey) ?? { key: o.groupKey, label: o.group, items: [] }
      g.items.push(o); m.set(o.groupKey, g)
    }
    return [...m.values()]
  }, [options])

  const [step, setStep] = useState<Step>(1)
  const [freq, setFreq] = useState<Frequency>(incomeItems[0]?.cat.frequency ?? 'month')
  const [selected, setSelected] = useState(() => new Set(options.filter(o => original.find(c => String(c.id) === o.key)?.selected).map(o => o.key)))
  const [choice, setChoice] = useState<'presets' | 'own'>('presets')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  useAnnounce(error || status)

  // Focus the first control of each step (the dialog itself holds focus on open).
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (step === 1) body.current?.querySelector<HTMLElement>('input:checked')?.focus()
    else if (step === 2) body.current?.querySelector<HTMLElement>('input:checked')?.focus()
    else body.current?.querySelector<HTMLElement>('input[type=checkbox]')?.focus()
  }, [step])

  function go(s: Step) { setStep(s); setStatus(`Step ${s} of ${STEPS}`) }
  const toggle = (key: string) => setSelected(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const toggleGroup = (items: Option[], on: boolean) => setSelected(s => { const n = new Set(s); for (const o of items) { if (on) n.add(o.key); else n.delete(o.key) } return n })

  /** Saves the pay frequency (the Recurrence of every Income item), and the checklist when `withCats`. */
  async function finish(withCats: boolean, then: () => void) {
    setSaving(true); setError('')
    let work: Cat[] = original
    for (const n of incomeItems) work = edit.patch(work, n.cat.id, { frequency: freq, ...scheduleClears(n.cat, freq) })
    if (withCats) for (const o of options) work = edit.patch(work, Number(o.key), { selected: selected.has(o.key) })
    try {
      await saveSetup(work, original, { onboarded: true })
    } catch {
      setSaving(false)
      setError('Error: Your answers weren’t saved, and nothing was changed. Check that your device has free storage space, then try again.')
      return
    }
    then()
  }

  const cancel = firstRun ? onSkip : onClose
  const left = step === 1
    ? <Button type="button" className="secondary" id="onboarding-skip" onClick={cancel}>{firstRun ? 'Skip' : 'Cancel'}</Button>
    : <Button type="button" className="secondary" id="onboarding-back" onClick={() => go((step - 1) as Step)} disabled={saving}>Back</Button>
  const right = step === 1
    ? <Button type="button" id="onboarding-next" onClick={() => go(2)}>Next</Button>
    : step === 2
      ? <Button type="button" id="onboarding-next" onClick={() => (choice === 'presets' ? finish(false, onDone) : go(3))} disabled={saving}>{saving ? 'Saving…' : 'Next'}</Button>
      : step === 3
      ? <Button type="button" id="onboarding-done" onClick={() => finish(true, onDone)} disabled={saving}>{saving ? 'Saving…' : 'Done'}</Button>
      : null

  return (
    <Dialog id="onboarding" title="Let’s set up your budget" onClose={cancel} className="onboarding"
      buttons={<>{left}{right}</>}>
      <div ref={body}>
        <div className="wizard-steps">
          <p id="onboarding-step" aria-hidden="true">Step {step} of {STEPS}</p>
          <div className="wizard-bar" role="progressbar" aria-labelledby="onboarding-step" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step}>
            <span style={{ width: `${step / STEPS * 100}%` }} />
          </div>
        </div>

        {step === 1 && (
          <fieldset className="fieldset" role="radiogroup" aria-labelledby="pay_frequency-legend">
            <legend id="pay_frequency-legend" className="legend">How often do you get paid?</legend>
            <ul className="plain-list choice-buttons">
              {FREQUENCIES.map(f => (
                <li key={f.value}>
                  <label className="choice-button">
                    <input type="radio" className="sr-only" name="pay_frequency" id={`pay_frequency-${f.value}`} value={f.value}
                      checked={freq === f.value} onChange={() => setFreq(f.value)} />
                    {f.label}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="fieldset" role="radiogroup" aria-labelledby="presets-legend" aria-describedby="presets-help">
            <legend id="presets-legend" className="legend">Use presets, or choose your own categories?</legend>
            <p id="presets-help" className="help">You can change presets later in Budget setup.</p>
            <ul className="plain-list choice-buttons">
              {([['presets', 'Use presets'], ['own', 'Add categories']] as const).map(([v, label]) => (
                <li key={v}>
                  <label className="choice-button">
                    <input type="radio" className="sr-only" name="presets" id={`presets-${v}`} value={v}
                      checked={choice === v} onChange={() => setChoice(v)} />
                    {label}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {step === 3 && (
          <div className="wizard-layout">
            <div>
              <h3 id="onboarding-list-title" className="legend">Choose the categories you track</h3>
              <p id="onboarding-list-help" className="help">Select a group to select everything in it. Open a group to pick single items.</p>
              <div className="wizard-list" role="group" aria-labelledby="onboarding-list-title" aria-describedby="onboarding-list-help onboarding-list-count">
                {groups.map((g, i) => {
                  const n = g.items.filter(o => selected.has(o.key)).length
                  return (
                    <details key={g.key} open={i < 2}>
                      <summary>
                        <label>
                          <input type="checkbox" id={`group-${g.key}`} checked={n === g.items.length}
                            ref={el => { if (el) el.indeterminate = n > 0 && n < g.items.length }}
                            onChange={e => toggleGroup(g.items, e.target.checked)} />
                          {g.label}
                        </label>
                      </summary>
                      <ul className="plain-list">
                        {g.items.map(o => (
                          <li key={o.key}>
                            <label>
                              <input type="checkbox" id={`item-${g.key}-${o.key}`} checked={selected.has(o.key)} onChange={() => toggle(o.key)} />
                              {o.name}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )
                })}
              </div>
              <p id="onboarding-list-count" className="wizard-count">{selected.size} selected</p>
            </div>
            <div><Button type="button" className="secondary" id="onboarding-advanced" onClick={() => finish(true, onAdvanced)} disabled={saving}>Advanced setup</Button></div>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </Dialog>
  )
}
