import { useEffect, useRef, useState } from 'react'
import { Button, ErrorSummary, focusFirstError, type FieldError } from '../components/ui'
import { categoryRepo, saveSetup } from '../storage/repository'
import { cleanName, moneyError, NAME_MAX, parseMoney } from '../budget/validate'
import type { Frequency, Range } from '../storage/db'
import {
  autopayApplies, childColor, flatten, frequenciesFor, isTotal, recurrenceApplies, subtree, type CatNode,
} from '../budget/tree'

type Draft = { selected: boolean; estimate: string; frequency: Frequency; autopay: boolean }

interface Group { id: string; title: string; color: string; parent: CatNode | null; options: { node: CatNode; label: string }[] }

/** Checkbox groups: taxes, then each top-level group of items, then one group per subcategory. */
function buildGroups(roots: CatNode[]): Group[] {
  const groups: Group[] = []
  const plain = roots.filter(r => !r.cat.computed)
  if (plain.length) groups.push({ id: 'plain', title: plain.map(r => r.cat.name).join(', '), color: 'blue', parent: null, options: plain.map(node => ({ node, label: node.cat.name })) })
  for (const r of roots.filter(r => r.cat.computed && r.children.length)) {
    const allItems = r.children.every(c => !c.children.length)
    const parents = allItems ? [r] : r.children
    for (const g of parents) {
      const self = !isTotal(g) && g !== r ? [{ node: g, label: g.cat.name }]
        : g.cat.name === 'Charity' ? [{ node: g, label: 'Charity (general)' }] : []
      groups.push({ id: String(g.cat.id), title: g.cat.name, color: g.cat.color, parent: g, options: [...self, ...g.children.map(node => ({ node, label: node.cat.name }))] })
    }
  }
  return groups
}

const PRE_RANGES: Range[] = ['day', 'week', 'month']

/** "Budget setup" overlay (stuff.md #4). */
export function BudgetSetup({ roots, defaultRange, onClose, onChanged }: {
  roots: CatNode[]
  defaultRange: Range
  onClose: () => void
  /** Categories or settings changed; reload them. */
  onChanged: (range?: Range) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<Record<number, Draft>>({})
  const [range, setRange] = useState<Range>(defaultRange)
  const [listCollapsed, setListCollapsed] = useState(false)
  const [create, setCreate] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [saveError, setSaveError] = useState('')

  const headingRef = useRef<HTMLHeadingElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)

  // Mounted only while open (see App): open the modal, focus its heading, and
  // return focus to whatever opened it when it unmounts.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.showModal()
    headingRef.current?.focus()
    return () => opener?.focus()
  }, [])

  const groups = buildGroups(roots)
  // Unedited nodes (including ones created while open) read straight from the category.
  const d = (n: CatNode): Draft => draft[n.cat.id] ?? {
    selected: !!n.cat.selected,
    estimate: n.cat.estimate != null ? String(n.cat.estimate) : '',
    frequency: n.cat.frequency ?? 'month',
    autopay: !!n.cat.autopay,
  }
  const patch = (n: CatNode, p: Partial<Draft>) => setDraft(x => ({ ...x, [n.cat.id]: { ...d(n), ...p } }))
  const isSelected = (n: CatNode) => d(n).selected

  async function addItem(g: Group) {
    const key = `create-${g.id}`
    const name = cleanName(create[g.id] ?? '')
    if (!name || !g.parent) return
    if (g.parent.children.some(c => cleanName(c.cat.name).toLowerCase() === name.toLowerCase())) {
      setErrors(e => ({ ...e, [key]: `Invalid: Create item in ${g.title} “${name}” already exists` }))
      return
    }
    try {
      const r = await categoryRepo.add({ name, parentId: g.parent.cat.id, color: childColor(g.parent), selected: true })
      if (r.movedFrom) setStatus(`Your ${r.movedFrom} estimate moved to ${r.movedFrom} › Miscellaneous. ${r.movedFrom} now totals its items.`)
    } catch {
      setErrors(e => ({ ...e, [key]: `Error: Create item in ${g.title} wasn’t saved. Try again.` }))
      return
    }
    setCreate(c => ({ ...c, [g.id]: '' }))
    setErrors(e => { const rest = { ...e }; delete rest[key]; return rest })
    onChanged()
  }

  // Charity shows its own controls only when it's the only Charity choice selected.
  const charityAlone = (n: CatNode) => isSelected(n) && !n.children.some(isSelected)
  const hasControls = (n: CatNode) => isSelected(n) && (n.cat.name === 'Charity' && isTotal(n) ? charityAlone(n) : !isTotal(n))
  const estimateRows = flatten(roots).filter(n => n.cat.name !== 'Net Income' && subtree(n).some(isSelected))

  async function save() {
    setSaveError('')
    const errs: Record<string, string> = {}
    const values = new Map<number, number | undefined>()
    for (const n of flatten(roots)) {
      const v = d(n).estimate.trim()
      if (v === '') { values.set(n.cat.id, undefined); continue }
      const r = parseMoney(v, { allowNegative: false })
      if (r.ok) values.set(n.cat.id, r.value)
      else if (hasControls(n)) errs[`est-${n.cat.id}`] = moneyError(`Estimated spending for ${n.cat.name}`, r, '40 or 1,200.00')
    }
    setErrors(errs)
    const list: FieldError[] = Object.entries(errs).map(([fieldId, message]) => ({ fieldId, message }))
    if (list.length) { requestAnimationFrame(() => focusFirstError(list, bannerRef.current)); return }
    try {
      await saveSetup(flatten(roots).filter(n => draft[n.cat.id]).map(n => {
        const x = d(n)
        return { id: n.cat.id, patch: {
          selected: x.selected,
          estimate: values.get(n.cat.id),
          frequency: recurrenceApplies(n) && frequenciesFor(n).some(f => f.value === x.frequency) ? x.frequency : undefined,
          autopay: autopayApplies(n) ? x.autopay : undefined,
        } }
      }), range)
    } catch {
      setSaveError('Error: Your estimates weren’t saved, and nothing was changed. Check that your device has free storage space, then try again.')
      return
    }
    setListCollapsed(true)
    setStatus('Estimates saved.')
    onChanged(range)
  }

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="setup-heading" onClose={onClose}>
      <div className="dialog-body">
        <div className="panel-head">
          <h2 id="setup-heading" ref={headingRef} tabIndex={-1} className="section-title">Budget setup</h2>
          <Button type="button" className="secondary" onClick={onClose}>Close</Button>
        </div>

        <ErrorSummary ref={bannerRef} errors={Object.entries(errors).filter(([k]) => k.startsWith('est-')).map(([fieldId, message]) => ({ fieldId, message }))} />

        <fieldset className="fieldset">
          <legend className="legend">Select the items you think you’ll use regularly.</legend>
          <p className="help">If you’d like to skip ahead just select “Save”. Income, Tax, Emergency fund, Charity, and a few other items are preselected for you.</p>
          <Button type="button" className="secondary" aria-expanded={!listCollapsed} aria-controls="setup-list" onClick={() => setListCollapsed(c => !c)}>
            {listCollapsed ? 'Show item list' : 'Hide item list'}
          </Button>
          <div id="setup-list" className="setup-groups" hidden={listCollapsed}>
            {groups.map(g => (
              <div key={g.id} className="setup-group" role="group" aria-labelledby={`group-${g.id}`}>
                <p id={`group-${g.id}`} className={`group-title clr-${g.color}`}>{g.title}</p>
                <ul className="plain-list">
                  {g.options.map(o => (
                    <li key={o.node.cat.id}>
                      <label className="check">
                        <input type="checkbox" checked={isSelected(o.node)} onChange={e => patch(o.node, { selected: e.target.checked })} />
                        {o.label}
                      </label>
                    </li>
                  ))}
                </ul>
                {g.parent && (
                  <div className="create-row">
                    <label className="sr-only" htmlFor={`create-${g.id}`}>Create item in {g.title}</label>
                    <input id={`create-${g.id}`} className="input" placeholder="Create" maxLength={NAME_MAX} value={create[g.id] ?? ''}
                      aria-invalid={!!errors[`create-${g.id}`] || undefined}
                      aria-describedby={errors[`create-${g.id}`] ? `create-${g.id}-error` : undefined}
                      onChange={e => setCreate(c => ({ ...c, [g.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(g) } }} />
                    <Button type="button" className="secondary" aria-disabled={!(create[g.id] ?? '').trim()} aria-describedby={`create-${g.id}`} onClick={() => addItem(g)}>Add</Button>
                    {errors[`create-${g.id}`] && <p id={`create-${g.id}-error`} className="error">{errors[`create-${g.id}`]}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </fieldset>

        <details className="details" open>
          <summary id="est-heading">Estimates for selected items</summary>
          <p id="est-help" className="help">Estimates without a recurrence are monthly.</p>
          <div className="table-box">
            <table className="table setup-table" aria-labelledby="est-heading" aria-describedby="est-help">
              <thead>
                <tr>
                  <th scope="col" className="name">Item name</th>
                  <th scope="col" id="est-col">Estimated spending</th>
                  <th scope="col">Recurrence</th>
                  <th scope="col">Autopay</th>
                </tr>
              </thead>
              <tbody>
                {estimateRows.map(n => {
                  const x = d(n)
                  const nameId = `name-${n.cat.id}`
                  const errId = `est-${n.cat.id}`
                  const controls = hasControls(n)
                  return (
                    <tr key={n.cat.id} className={`row depth-${n.depth}${n.children.length ? ' group' : ''}`}>
                      <th scope="row" id={nameId} className={`name clr-${n.cat.color}`}>{n.cat.name}</th>
                      <td>
                        {controls && <>
                          <input id={errId} className="input amount" inputMode="decimal" value={x.estimate}
                            aria-labelledby="est-col" aria-describedby={errors[errId] ? `${nameId} ${errId}-msg` : nameId}
                            aria-invalid={!!errors[errId] || undefined}
                            onChange={e => patch(n, { estimate: e.target.value })} />
                          {errors[errId] && <p id={`${errId}-msg`} className="error">{errors[errId]}</p>}
                        </>}
                      </td>
                      <td>
                        {controls && recurrenceApplies(n) && (
                          <span className="pre">
                            <span aria-hidden="true">per</span>
                            <select className="input" aria-label={`Recurrence for ${n.cat.name}`} value={x.frequency}
                              onChange={e => patch(n, { frequency: e.target.value as Frequency })}>
                              {frequenciesFor(n).map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </span>
                        )}
                      </td>
                      <td>
                        {controls && autopayApplies(n) && (
                          <label className="check">
                            <input type="checkbox" className="checkbox" checked={x.autopay}
                              onChange={e => patch(n, { autopay: e.target.checked })} />
                            <span className="sr-only">Autopay for {n.cat.name}</span>
                          </label>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </details>

        <fieldset className="fieldset">
          <legend className="legend">Default display range</legend>
          <div className="toggle-group">
            {PRE_RANGES.map(r => (
              <Button key={r} type="button" className="toggle" aria-pressed={range === r} onClick={() => setRange(r)}>
                {r[0].toUpperCase() + r.slice(1)}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="actions">
          <Button type="button" onClick={save}>Save</Button>
          <p className="status" role="status">{status}</p>
        </div>
        {saveError && <p className="error" role="alert">{saveError}</p>}
      </div>
    </dialog>
  )
}
