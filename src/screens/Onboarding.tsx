import { useMemo, useState } from 'react'
import { Button, Dialog } from '../components/ui'
import { useAnnounce } from '../components/ui/announcer'
import { MultiSelect, type MultiOption } from '../components/ui/MultiSelect'
import { saveSetup } from '../storage/repository'
import type { Category, Frequency } from '../storage/db'
import { buildTree, FREQUENCIES, flatten, isTotal, repeatedNames, scheduleClears, spokenName, type Cat } from '../budget/tree'
import { cleanName, NAME_MAX } from '../budget/validate'
import * as edit from '../budget/setupEdits'

/**
 * Onboarding questionnaire (0008 §8): pay frequency, then whether to add spending and
 * savings categories. Shown on first run (Skip) and reopened by the ? help button (Cancel).
 */
export function Onboarding({ cats, firstRun, onClose, onSkip, onDone }: {
  cats: Category[]
  firstRun: boolean
  onClose: () => void
  /** First run only: remember the questionnaire was skipped. */
  onSkip: () => void
  onDone: () => void
}) {
  const original = useMemo(() => cats.filter((c): c is Cat => typeof c.id === 'number'), [cats])
  const roots = useMemo(() => buildTree(original), [original])
  const income = roots.find(r => r.cat.name === 'Income')
  const incomeItems = income ? flatten([income]).filter(n => n !== income && !isTotal(n)) : []
  const expenses = roots.find(r => r.cat.name === 'Expenses')

  const [freq, setFreq] = useState<Frequency>(incomeItems[0]?.cat.frequency ?? 'month')
  const [wantCats, setWantCats] = useState(false)
  const repeated = useMemo(() => repeatedNames(roots), [roots])
  const base: MultiOption[] = useMemo(() => roots
    .filter(r => r.cat.name === 'Savings' || r.cat.name === 'Expenses')
    .flatMap(r => flatten([r]).filter(n => n !== r && !isTotal(n)).map(n => ({
      key: String(n.cat.id), name: n.cat.name, group: n.parent!.cat.name, spoken: spokenName(n, repeated), color: n.cat.color,
    }))), [roots, repeated])
  const [selected, setSelected] = useState(() => new Set(base.filter(o => original.find(c => String(c.id) === o.key)?.selected).map(o => o.key)))
  const [extras, setExtras] = useState<MultiOption[]>([])
  const options = [...base, ...extras]
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useAnnounce(error)

  const toggle = (key: string) => setSelected(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })

  /** "Add your own": a new item under Expenses (0008 §8). Returns an error message, or null when added. */
  function add(text: string): string | null {
    const name = cleanName(text)
    if (!name) return 'Error: Name cannot be empty'
    if (!expenses) return 'Error: There is no Expenses group to add to'
    if (edit.nameTaken(original, expenses.cat.id, name) || extras.some(x => x.name.toLowerCase() === name.toLowerCase())) {
      return `Invalid: Name “${name}” already exists in Expenses`
    }
    const key = `new-${extras.length + 1}`
    setExtras(x => [...x, { key, name, group: 'Expenses', spoken: name, color: 'lighter-orange' }])
    setSelected(s => new Set(s).add(key))
    return null
  }

  async function done() {
    setSaving(true); setError('')
    let work: Cat[] = original
    // Pay frequency is the Recurrence of every Income item.
    for (const n of incomeItems) work = edit.patch(work, n.cat.id, { frequency: freq, ...scheduleClears(n.cat, freq) })
    if (wantCats) {
      for (const o of base) work = edit.patch(work, Number(o.key), { selected: selected.has(o.key) })
      for (const x of extras) if (selected.has(x.key)) work = edit.create(work, x.name, expenses!.cat.id).cats
    }
    try {
      await saveSetup(work, original, { onboarded: true })
    } catch {
      setSaving(false)
      setError('Error: Your answers weren’t saved, and nothing was changed. Check that your device has free storage space, then try again.')
      return
    }
    onDone()
  }

  return (
    <Dialog id="onboarding" title="Let’s set up your budget" onClose={firstRun ? onSkip : onClose} className="onboarding"
      buttons={<>
        <Button type="button" className="secondary" id="onboarding-skip" onClick={firstRun ? onSkip : onClose}>{firstRun ? 'Skip' : 'Cancel'}</Button>
        <Button type="button" id="onboarding-done" onClick={done} disabled={saving}>{saving ? 'Saving…' : 'Done'}</Button>
      </>}>
      <p className="help">Two quick questions. You can skip this and change everything later in Budget setup. The “?” button next to the title brings these questions back.</p>

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

      <fieldset className="fieldset" role="radiogroup" aria-labelledby="add_categories-legend">
        <legend id="add_categories-legend" className="legend">Add spending and savings categories?</legend>
        <ul className="plain-list choice-buttons">
          {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(o => (
            <li key={o.l}>
              <label className="choice-button">
                <input type="radio" className="sr-only" name="add_categories" id={`add_categories-${o.l.toLowerCase()}`} checked={wantCats === o.v} onChange={() => setWantCats(o.v)} />
                {o.l}
              </label>
            </li>
          ))}
        </ul>
        {wantCats && (
          <div className="field">
            <label className="label" htmlFor="categories">Savings and spending items to track</label>
            <MultiSelect id="categories" label="Savings and spending items" options={options} selected={selected} onToggle={toggle}
              onAdd={add} addLabel={t => `Add “${t}” to Expenses`} maxLength={NAME_MAX} describedBy="categories-help" />
            <p id="categories-help" className="help">Names can be up to {NAME_MAX} characters.</p>
          </div>
        )}
      </fieldset>
      {error && <p className="error">{error}</p>}
    </Dialog>
  )
}
