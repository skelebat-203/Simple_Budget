import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui'
import { categoryRepo, settingsRepo } from '../storage/repository'
import type { Frequency, Range } from '../storage/db'
import {
  autopayApplies, childColor, flatten, FREQUENCIES, recurrenceApplies, subtree, type CatNode,
} from '../budget/tree'

type Draft = { selected: boolean; estimate: string; frequency: Frequency; autopay: boolean }

interface Group { id: string; title: string; color: string; parent: CatNode | null; options: { node: CatNode; label: string }[] }

/** Checkbox groups: income and taxes, savings items, then one group per expense subcategory. */
function buildGroups(roots: CatNode[]): Group[] {
  const groups: Group[] = []
  const plain = roots.filter(r => !r.cat.computed)
  if (plain.length) groups.push({ id: 'income', title: 'Income and taxes', color: 'blue', parent: null, options: plain.map(node => ({ node, label: node.cat.name })) })
  for (const r of roots.filter(r => r.cat.computed && r.children.length)) {
    const allItems = r.children.every(c => !c.children.length && !c.cat.computed)
    const parents = allItems ? [r] : r.children
    for (const g of parents) {
      const self = !g.cat.computed && g !== r ? [{ node: g, label: g.cat.name }]
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

  // Mounted only while open (see App), so open the modal once on mount.
  useEffect(() => { ref.current?.showModal() }, [])

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
    const name = (create[g.id] ?? '').trim()
    if (!name || !g.parent) return
    if (g.parent.children.some(c => c.cat.name.toLowerCase() === name.toLowerCase())) {
      setErrors(e => ({ ...e, [`create-${g.id}`]: `${g.title} already has “${name}”.` }))
      return
    }
    await categoryRepo.add({ name, parentId: g.parent.cat.id, color: childColor(g.parent), computed: false, selected: true })
    setCreate(c => ({ ...c, [g.id]: '' }))
    setErrors(e => { const rest = { ...e }; delete rest[`create-${g.id}`]; return rest })
    onChanged()
  }

  // Charity shows its own controls only when it's the only Charity choice selected.
  const charityAlone = (n: CatNode) => isSelected(n) && !n.children.some(isSelected)
  const hasControls = (n: CatNode) => isSelected(n) && (n.cat.name === 'Charity' && n.cat.computed ? charityAlone(n) : !n.cat.computed)
  const estimateRows = flatten(roots).filter(n => n.cat.name !== 'Net Income' && subtree(n).some(isSelected))

  async function save() {
    const errs: Record<string, string> = {}
    for (const n of estimateRows) {
      const v = d(n).estimate.trim()
      if (hasControls(n) && v && !Number.isFinite(Number(v))) errs[`est-${n.cat.id}`] = `Enter the estimate for ${n.cat.name} as a number.`
    }
    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) { document.getElementById(first)?.focus(); return }
    await categoryRepo.updateMany(flatten(roots).filter(n => draft[n.cat.id]).map(n => {
      const x = d(n)
      return { id: n.cat.id, patch: {
        selected: x.selected,
        estimate: x.estimate.trim() === '' ? undefined : Number(x.estimate),
        frequency: recurrenceApplies(n) ? x.frequency : undefined,
        autopay: autopayApplies(n) ? x.autopay : undefined,
      } }
    }))
    await settingsRepo.update({ defaultRange: range })
    setListCollapsed(true)
    setStatus('Estimates saved.')
    onChanged(range)
  }

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="setup-heading" onClose={onClose}>
      <div className="dialog-body">
        <div className="panel-head">
          <h2 id="setup-heading" className="section-title">Budget setup</h2>
          <Button type="button" className="secondary" onClick={onClose}>Close</Button>
        </div>

        <fieldset className="fieldset">
          <legend className="legend">Select the items you think you’ll use regularly.</legend>
          <p className="help">If you’d like to skip ahead just select “Save”. Income, Tax, Emergency fund, Charity, and a few other items are preselected for you.</p>
          <Button type="button" className="secondary" aria-expanded={!listCollapsed} aria-controls="setup-list" onClick={() => setListCollapsed(c => !c)}>
            {listCollapsed ? 'Show item list' : 'Hide item list'}
          </Button>
          <div id="setup-list" className="setup-groups" hidden={listCollapsed}>
            {groups.map(g => (
              <div key={g.id} className="setup-group">
                <p className={`group-title clr-${g.color}`}>{g.title}</p>
                {g.options.map(o => (
                  <label key={o.node.cat.id} className="check">
                    <input type="checkbox" checked={isSelected(o.node)} onChange={e => patch(o.node, { selected: e.target.checked })} />
                    {o.label}
                  </label>
                ))}
                {g.parent && (
                  <div className="create-row">
                    <label className="sr-only" htmlFor={`create-${g.id}`}>Create item in {g.title}</label>
                    <input id={`create-${g.id}`} className="input" placeholder="Create" value={create[g.id] ?? ''}
                      aria-invalid={!!errors[`create-${g.id}`] || undefined}
                      aria-describedby={errors[`create-${g.id}`] ? `create-${g.id}-error` : undefined}
                      onChange={e => setCreate(c => ({ ...c, [g.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(g) } }} />
                    <Button type="button" className="secondary" disabled={!(create[g.id] ?? '').trim()} aria-describedby={`create-${g.id}`} onClick={() => addItem(g)}>Add</Button>
                    {errors[`create-${g.id}`] && <p id={`create-${g.id}-error`} className="error">{errors[`create-${g.id}`]}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </fieldset>

        <details className="details" open>
          <summary>Estimates for selected items</summary>
          <p className="help">Estimates without a recurrence are monthly.</p>
          <div className="table-box">
            <table className="table setup-table">
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
                              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </span>
                        )}
                      </td>
                      <td>
                        {controls && autopayApplies(n) && (
                          <input type="checkbox" className="checkbox" aria-label={`Autopay for ${n.cat.name}`} checked={x.autopay}
                            onChange={e => patch(n, { autopay: e.target.checked })} />
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
      </div>
    </dialog>
  )
}
