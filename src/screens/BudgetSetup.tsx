import { useState, useEffect } from 'react'
import { Button, AmountInput } from '../components/ui'
import { categoryRepo, budgetItemRepo } from '../storage/repository'
import { buildOptions, type ItemOption } from '../components/ui/ItemSelector'
import { FREQUENCIES, RECURRENCE_TYPES, RECURRENCE_CATEGORIES, AUTOPAY_CATEGORIES } from '../components/ui/frequencies'
import type { BudgetType, Frequency } from '../storage/db'

const PRESELECTED = ['Pay', 'Taxes', 'Emergency', 'Charity', 'Mortgage', 'Power', 'Netflix']

type SetupItem = {
  name: string
  category: string
  type: BudgetType
  level: 'category' | 'subcategory' | 'item'
  parent?: string
  color: string
  estimate: string
  frequency: Frequency | ''
  autopay: boolean
}

export function BudgetSetup({ onClose, defaultRange, onDefaultRangeChange, onSaved }: {
  onClose: () => void
  defaultRange: 'day' | 'week' | 'month'
  onDefaultRangeChange: (v: 'day' | 'week' | 'month') => void
  onSaved: () => void
}) {
  const [tree, setTree] = useState<ItemOption[]>([])
  const [setup, setSetup] = useState<SetupItem[]>([])
  const [saved, setSaved] = useState(false)
  const [creating, setCreating] = useState<Record<string, string>>({})
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day')
  const [expanded, setExpanded] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    categoryRepo.list().then(cats => {
      const options = buildOptions(cats)
      setTree(options)
      const preselected = PRESELECTED.filter(n => options.some(o => o.name === n))
      setSetup(preselected.map(name => {
        const o = options.find(x => x.name === name)!
        return { name: o.name, category: o.category, type: o.type, level: o.level, parent: o.parent, color: o.color, estimate: '', frequency: '', autopay: false }
      }))
    })
  }, [])

  useEffect(() => setRange(defaultRange), [defaultRange])

  const selectedNames = new Set(setup.map(s => s.name))

  function hasControls(s: SetupItem): boolean {
    if (s.level === 'item') return true
    if (s.level === 'subcategory' && s.name === 'Charity') {
      const siblings = setup.filter(x => x.level === 'item' && (x.parent === 'Charity' || x.category === 'Charity'))
      return siblings.length === 0
    }
    return false
  }

  function recurrenceApplies(s: SetupItem): boolean {
    return RECURRENCE_TYPES.has(s.type) || RECURRENCE_CATEGORIES.has(s.category)
  }

  function autopayApplies(s: SetupItem): boolean {
    return AUTOPAY_CATEGORIES.has(s.category)
  }

  function toggle(name: string, category: string, type: BudgetType, level: ItemOption['level'], parent?: string) {
    if (selectedNames.has(name)) {
      setSetup(setup.filter(s => s.name !== name))
      return
    }
    setSetup([...setup, { name, category, type, level, parent, color: '', estimate: '', frequency: '', autopay: false }])
  }

  function setCreateValue(key: string, value: string) {
    setCreating(c => ({ ...c, [key]: value }))
  }

  function addCreated(key: string) {
    const value = creating[key]?.trim()
    if (!value) return
    const node = tree.find(o => o.name === key)
    if (!node) return
    setSetup([...setup, { name: value, category: node.category, type: node.type, level: 'item', parent: node.name, color: '', estimate: '', frequency: '', autopay: false }])
    setCreating(c => { const n = { ...c }; delete n[key]; return n })
  }

  async function save() {
    setError(null)
    const bad = setup.find(s => s.estimate !== '' && !Number.isFinite(Number(s.estimate)))
    if (bad) {
      setError('Estimated spend must be a number')
      return
    }
    for (const s of setup) {
      const existing = await budgetItemRepo.findByName(s.name)
      const payload = {
        name: s.name,
        category: s.category,
        type: s.type,
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        estimate: s.estimate !== '' ? Number(s.estimate) : undefined,
        frequency: s.frequency || undefined,
        autopay: s.autopay || undefined,
      }
      if (existing.length > 0) {
        await budgetItemRepo.update(existing[0]!.id!, { estimate: payload.estimate, frequency: payload.frequency, autopay: payload.autopay, updatedAt: Date.now() })
      } else {
        await budgetItemRepo.add(payload)
      }
    }
    setSaved(true)
    onSaved()
  }

  return (
    <div className="setup-backdrop" onClick={onClose}>
      <div className="setup-panel" onClick={e => e.stopPropagation()}>
        <button className="setup-close" onClick={onClose}>Close</button>
        <h2 className="setup-title">Budget setup</h2>
        <p className="setup-support">If you'd like to skip ahead just select "Save". Income, Tax, Emergency fund, Charity, and a few other items are preselected for you.</p>

        <section className={`setup-section ${saved ? 'collapsed' : ''}`}>
          <fieldset role="group" aria-required="false">
            <legend className="setup-section-title">Select the items you think you'll use regularly.</legend>
            <ul>
              {tree.map(node => {
                if (node.parent) return null
                return (
                  <li key={node.name}>
                    <label className="checkbox-item">
                      <input type="checkbox" className="checkbox" checked={selectedNames.has(node.name)} onChange={() => toggle(node.name, node.category, node.type, 'category')} id={`sel-${node.name}`} />
                      <span className={`setup-cat-name clr-${node.color}`}>{node.name}</span>
                    </label>
                    {renderChildren(node.name)}
                    <div className="create-row">
                      <input id={`create-${node.name}`} className="create-input input" placeholder="Create item…" value={creating[`cat-${node.name}`] ?? ''} onChange={e => setCreateValue(`cat-${node.name}`, e.target.value)} aria-labelledby={`create-${node.name}-lbl`} />
                      <span id={`create-${node.name}-lbl`} className="sr-only">Create item in {node.name}</span>
                      <button className="btn add-btn" id={`add-${node.name}`} disabled={!creating[`cat-${node.name}`]?.trim()} aria-describedby={`create-${node.name}`} onClick={() => addCreated(`cat-${node.name}`)}>Add</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        </section>

        {saved && error && <div className="banner" role="alert" aria-live="assertive">{error}</div>}

        <section className="setup-section">
          <button className="expandable" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} id="setup-expander">
            Selected items ({setup.length})
          </button>
          {expanded && (
            <table className="table" aria-labelledby="setup-expander setup-col-estimate">
              <caption className="sr-only">Estimated spending per selected item</caption>
              <thead>
                <tr>
                  <th scope="col" id="setup-col-item">Item name</th>
                  <th scope="col" id="setup-col-estimate">Estimated spending</th>
                  <th scope="col">Recurrence</th>
                  <th scope="col">Autopay</th>
                </tr>
              </thead>
              <tbody>
                {setup.map((s, index) => {
                  const controls = hasControls(s)
                  const nameId = `setup-item-${index}`
                  return (
                    <tr key={`${s.name}-${index}`} className={s.level === 'item' ? 'row-item' : 'row-subcategory'}>
                      <td id={nameId} className={s.level !== 'item' ? `clr-${s.color}` : ''}>{s.name}</td>
                      <td>
                        {controls ? (
                          <div className="setup-controls">
                            {recurrenceApplies(s) ? (
                              <select id={`rec-${index}`} className="input" value={s.frequency} onChange={e => setFreq(index, e.target.value as Frequency | '')}>
                                <option value="">—</option>
                                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </select>
                            ) : null}
                            <AmountInput id={`est-${index}`} value={s.estimate} onChange={e => setEst(index, e.target.value)} aria-labelledby={`setup-col-estimate ${nameId}`} />
                          </div>
                        ) : null}
                      </td>
                      <td></td>
                      <td>
                        {controls && autopayApplies(s) ? (
                          <label className="checkbox-item">
                            <input type="checkbox" className="checkbox" checked={s.autopay} onChange={e => setAutopay(index, e.target.checked)} id={`ap-${index}`} />
                          </label>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        <div className="range-toggle">
          <span className="muted">Default display range:</span>
          {(['day', 'week', 'month'] as const).map(r => (
            <button key={r} className={`btn ${range === r ? '' : 'secondary'}`} aria-pressed={range === r} onClick={() => { setRange(r); onDefaultRangeChange(r) }}>{r[0].toUpperCase() + r.slice(1)}</button>
          ))}
        </div>

        <div className="setup-footer">
          {saved ? (
            <button className="btn secondary" onClick={() => setSaved(false)}>Edit selections</button>
          ) : (
            <Button onClick={save}>Save</Button>
          )}
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )

  function renderChildren(parentName: string) {
    const direct = tree.filter(o => o.parent === parentName)
    const items = direct.filter(o => o.level === 'item')
    const subs = direct.filter(o => o.level === 'subcategory')
    return (
      <>
        {items.map(o => (
          <li key={o.name} className="setup-item-row">
            <label className="checkbox-item">
              <input type="checkbox" className="checkbox" checked={selectedNames.has(o.name)} onChange={() => toggle(o.name, o.category, o.type, 'item', o.parent)} id={`sel-${o.name}`} />
              <span className={`setup-item-name clr-${o.color}`}>{o.name}</span>
            </label>
          </li>
        ))}
        {subs.map(o => (
          <li key={o.name} className="setup-subcat-row">
            <label className="checkbox-item">
              <input type="checkbox" className="checkbox" checked={selectedNames.has(o.name)} onChange={() => toggle(o.name, o.category, o.type, 'subcategory', o.parent)} id={`sel-${o.name}`} />
              <span className={`setup-subcat-name clr-${o.color}`}>{o.name}</span>
            </label>
            {tree.filter(x => x.parent === o.name && x.level === 'item').map(i => (
              <li key={i.name} className="setup-item-row">
                <label className="checkbox-item">
                  <input type="checkbox" className="checkbox" checked={selectedNames.has(i.name)} onChange={() => toggle(i.name, i.category, i.type, 'item', i.parent)} id={`sel-${i.name}`} />
                  <span className={`setup-item-name clr-${i.color}`}>{i.name}</span>
                </label>
              </li>
            ))}
            <div className="create-row">
              <input id={`create-${o.name}`} className="create-input input" placeholder="Create item…" value={creating[`sub-${o.name}`] ?? ''} onChange={e => setCreateValue(`sub-${o.name}`, e.target.value)} aria-labelledby={`create-${o.name}-lbl`} />
              <span id={`create-${o.name}-lbl`} className="sr-only">Create item in {o.name}</span>
              <button className="btn add-btn" id={`add-${o.name}`} disabled={!creating[`sub-${o.name}`]?.trim()} aria-describedby={`create-${o.name}`} onClick={() => addCreated(`sub-${o.name}`)}>Add</button>
            </div>
          </li>
        ))}
      </>
    )
  }

  function setEst(index: number, value: string) {
    setSetup(setup.map((s, i) => i === index ? { ...s, estimate: value } : s))
  }

  function setFreq(index: number, value: Frequency | '') {
    setSetup(setup.map((s, i) => i === index ? { ...s, frequency: value } : s))
  }

  function setAutopay(index: number, checked: boolean) {
    setSetup(setup.map((s, i) => i === index ? { ...s, autopay: checked } : s))
  }
}
