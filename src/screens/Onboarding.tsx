import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Dialog, Toggle } from '../components/ui'
import { Expander } from '../components/ui/Expander'
import { useAnnounce } from '../components/ui/announcer'
import { ImportSection } from '../components/import/ImportSection'
import { WizardSync, type SyncTabId } from '../components/WizardSync'
import { useSyncState } from '../components/useSyncState'
import { SETUP_CONFLICT_TEXT, SetupConflictError, saveSetup, settingsRepo } from '../storage/repository'
import type { Category } from '../storage/db'
import { buildTree, flatten, isTotal, type Cat } from '../budget/tree'
import * as edit from '../budget/setupEdits'

type Step = 1 | 2 | 3
type Mode = 'local' | 'google'
const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'local', label: 'Local only' },
  { value: 'google', label: 'Sync with Google' },
]
const MODE_HELP = 'Sync keeps the same budget on your devices and with people you share it with, using a Google Sheet.'
const PAY_HELP = 'Set how often you get paid, and your estimated amounts, later in Advanced options.'
const NOT_LINKED = 'Error: The budget isn’t synced yet. Finish New Budget or Existing Budget, or choose Local only.'
const GROUPS_OPEN = 2 // step 3: how many groups start open

type Choice = 'presets' | 'own' | 'import'
const STEP2_NAME = 'Use presets, choose your own categories, or import a file?'
const STEP2_HINT = 'You can change presets later in Budget setup.'
const STEP2_OPTIONS: { value: Choice; label: string }[] = [
  { value: 'presets', label: 'Use presets' },
  { value: 'own', label: 'Add categories' },
  { value: 'import', label: 'Import a file' },
]
const IMPORT_NOTE = 'Your other answers in this setup are not used when you import.'

interface Option { key: string; name: string; group: string; groupKey: string }

/**
 * Onboarding wizard (0009 §1, prototype 0010; v0.7 step 3b): up to three steps with a progress bar.
 * 1 local only or sync with Google (new or existing budget); 2 presets or own categories;
 * 3 a grouped, collapsible checklist. An existing synced budget skips 2 and 3 (its categories come from the sheet).
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
  const syncState = useSyncState()
  const [mode, setMode] = useState<Mode>(() => (syncState.linked ? 'google' : 'local'))
  const [syncTab, setSyncTab] = useState<SyncTabId>('new')
  const [suspended, setSuspended] = useState(false)
  const [selected, setSelected] = useState(() => new Set(options.filter(o => original.find(c => String(c.id) === o.key)?.selected).map(o => o.key)))
  const [choice, setChoice] = useState<Choice>('presets')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  useAnnounce(error || status)

  // Focus the first control of each step (the dialog itself holds focus on open).
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Steps 1 and 2: the chosen radio, or step 2's select box when that replaces the pill (the hidden control has no box).
    if (step < 3) [...body.current?.querySelectorAll<HTMLElement>('input:checked, select') ?? []].find(el => el.getClientRects().length > 0)?.focus()
    else body.current?.querySelector<HTMLElement>('input[type=checkbox]')?.focus()
  }, [step])

  function chooseStep2(v: Choice) {
    setChoice(v)
    setStatus(v === 'import' ? 'Import options shown' : '')
  }

  /** After a successful import: mark the wizard done without applying the other answers. */
  async function imported() {
    try { await settingsRepo.update({ onboarded: true }) } catch { /* asked again next time */ }
    onDone()
  }

  // The step count follows the chosen path.
  const existing = mode === 'google' && syncTab === 'existing'
  const total = existing ? 1 : choice === 'own' ? 3 : 2
  function go(s: Step) { setError(''); setStep(s); setStatus(`Step ${s} of ${s === 1 || !existing ? total : choice === 'own' ? 3 : 2}`) }
  function chooseMode(m: Mode) { setMode(m); setError(''); setStatus(m === 'google' ? 'Sync options shown' : '') }
  /** Step 1: sync must be finished before going on, unless Local only. */
  function leaveStep1() {
    if (mode === 'google' && !syncState.linked) { setError(NOT_LINKED); return }
    if (existing) void finish(false, onDone)
    else go(2)
  }
  // Step 3 groups: the first two start open; a group the user toggled uses their choice.
  const [openGroups, setOpenGroups] = useState(() => new Map<string, boolean>())
  const isOpen = (key: string, i: number) => openGroups.get(key) ?? i < GROUPS_OPEN
  const toggleOpen = (key: string, i: number) => setOpenGroups(m => new Map(m).set(key, !isOpen(key, i)))
  const toggle = (key: string) => setSelected(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const toggleGroup = (items: Option[], on: boolean) => setSelected(s => { const n = new Set(s); for (const o of items) { if (on) n.add(o.key); else n.delete(o.key) } return n })

  /** Marks the wizard done, and saves the checklist when `withCats`. */
  async function finish(withCats: boolean, then: () => void) {
    setSaving(true); setError('')
    let work: Cat[] = original
    if (withCats) for (const o of options) work = edit.patch(work, Number(o.key), { selected: selected.has(o.key) })
    try {
      await saveSetup(work, original, { onboarded: true })
    } catch (e) {
      setSaving(false)
      setError(e instanceof SetupConflictError ? SETUP_CONFLICT_TEXT : 'Error: Your answers weren’t saved, and nothing was changed. Check that your device has free storage space, then try again.')
      return
    }
    then()
  }

  const cancel = firstRun ? onSkip : onClose
  const left = step === 1
    ? <Button type="button" className="secondary" id="onboarding-skip" onClick={cancel}>{firstRun ? 'Skip' : 'Cancel'}</Button>
    : <Button type="button" className="secondary" id="onboarding-back" onClick={() => go((step - 1) as Step)} disabled={saving}>Back</Button>
  const right = step === 1
    ? existing
      ? <Button type="button" id="onboarding-done" onClick={leaveStep1} disabled={saving}>{saving ? 'Saving…' : 'Done'}</Button>
      : <Button type="button" id="onboarding-next" onClick={leaveStep1}>Next</Button>
    : step === 2
      ? choice === 'import' ? null : <Button type="button" id="onboarding-next" onClick={() => (choice === 'presets' ? finish(false, onDone) : go(3))} disabled={saving}>{saving ? 'Saving…' : 'Next'}</Button>
      : step === 3
      ? <Button type="button" id="onboarding-done" onClick={() => finish(true, onDone)} disabled={saving}>{saving ? 'Saving…' : 'Done'}</Button>
      : null

  return (
    <Dialog id="onboarding" title="Let’s set up your budget" onClose={cancel} className="onboarding" suspended={suspended}
      buttons={<>
        <div className="actions">{left}{right}</div>
        <Button type="button" className="secondary" id="onboarding-advanced-options" onClick={() => finish(step === 3, onAdvanced)} disabled={saving}>Advanced options</Button>
      </>}>
      <div ref={body}>
        <div className="wizard-steps">
          <p id="onboarding-step" aria-hidden="true">Step {step} of {total}</p>
          <div className="wizard-bar" role="progressbar" aria-labelledby="onboarding-step" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
            <span style={{ width: `${step / total * 100}%` }} />
          </div>
        </div>

        {step === 1 && (
          <>
            <fieldset className="fieldset" role="radiogroup" aria-labelledby="sync_mode-legend" aria-describedby="sync_mode-help">
              <legend id="sync_mode-legend" className="legend">Keep your budget on this device only, or sync it?</legend>
              <p id="sync_mode-help" className="help">{MODE_HELP}</p>
              <ul className="plain-list choice-buttons">
                {MODE_OPTIONS.map(m => (
                  <li key={m.value}>
                    <label className="choice-button">
                      <input type="radio" className="sr-only" name="sync_mode" id={`sync_mode-${m.value}`} value={m.value}
                        checked={mode === m.value} onChange={() => chooseMode(m.value)} />
                      {m.label}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            {mode === 'google' && <WizardSync tab={syncTab} onTab={t => { setSyncTab(t); setError('') }} onSuspend={setSuspended} />}
          </>
        )}

        {step === 2 && (
          <>
            <Toggle stacked name={STEP2_NAME} hint={STEP2_HINT} value={choice} options={STEP2_OPTIONS} onChange={chooseStep2} />
            <p className="help">{PAY_HELP}</p>
            {choice === 'import' && <ImportSection onImported={imported} note={IMPORT_NOTE} />}
          </>
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
                    <div key={g.key}>
                      {/* Two separate controls, no nesting: the checkbox selects the group, the name button expands it. */}
                      <div className="wizard-group">
                        <label className="wizard-group-check">
                          <input type="checkbox" id={`group-${g.key}`} aria-label={`Select all in ${g.label}`} checked={n === g.items.length}
                            ref={el => { if (el) el.indeterminate = n > 0 && n < g.items.length }}
                            onChange={e => toggleGroup(g.items, e.target.checked)} />
                        </label>
                        <Expander open={isOpen(g.key, i)} onToggle={() => toggleOpen(g.key, i)} id={`group-expand-${g.key}`}>{g.label}</Expander>
                      </div>
                      {isOpen(g.key, i) && (
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
                      )}
                    </div>
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
