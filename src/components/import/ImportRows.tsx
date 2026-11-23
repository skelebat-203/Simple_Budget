import { useMemo } from 'react'
import { money, type ImportOptions, type PlanRow } from '../../import'
import type { ComboOption } from '../ui'
import { choiceValue } from './choices'
import { slug } from '../../budget/validate'

const HOW_NOTE: Partial<Record<NonNullable<PlanRow['target']>['how'], (name: string) => string>> = {
  misc: name => `The app has no item with this name, and the row has no estimate. It becomes a Miscellaneous purchase described “${name}”.`,
  description: name => `Its name “${name}” is used as the purchase description.`,
}

/** Rows with nothing to import are hidden unless `all`: totals, computed rows and blank rows. */
const rowShown = (r: PlanRow, all: boolean) => all || (r.role === 'item' && (r.purchases > 0 || r.needsPlace || !!r.skipped || r.warnings.length > 0))

/** One sheet's rows: where each goes, with a select to change it (0013 §9). Narrow screens show one card per row. */
export function ImportRows({ sheetName, rows, targets, existing, showAll, onTarget }: {
  sheetName: string
  rows: PlanRow[]
  targets: NonNullable<ImportOptions['targets']>
  existing: ComboOption[]
  showAll: boolean
  onTarget: (key: string, value: string) => void
}) {
  const shown = useMemo(() => rows.filter(r => rowShown(r, showAll)), [rows, showAll])
  /** Row header id ({field}-{sheet}-{name}-{row}): the row's select is described by it (digital_accessibility.md, Tables). */
  const rowId = (r: PlanRow) => ['review_row', slug(sheetName), slug(r.name), r.row].filter(Boolean).join('-')
  return (
    <div className="table-box">
      <table className="table review-table">
        <caption className="sr-only">Rows in the {sheetName} sheet</caption>
        <thead><tr><th scope="col" className="name">Row in the file</th><th scope="col" className="name">Goes to</th><th scope="col">Purchases</th><th scope="col">Total</th></tr></thead>
        <tbody>
          {shown.map(r => {
            const choice = targets[r.key]
            const canChange = !r.needsPlace && (!!r.target || choice === 'skip') && r.role === 'item'
            const note = r.target && !r.skipped ? HOW_NOTE[r.target.how]?.(r.name) : undefined
            const label = r.target ? `${r.target.path}${r.target.isNew ? ' (new row)' : ''}` : 'Not imported'
            return (
              <tr key={r.key} className={`depth-${Math.min(r.level, 2)}${r.skipped ? ' is-skipped' : ''}`}>
                <th scope="row" className="name" id={rowId(r)}>
                  <span className="row-name">{r.name}</span>
                  {r.target?.isNew && <span className="badge new">New row</span>}
                  {r.target?.how === 'misc' && <span className="badge">Miscellaneous</span>}
                  <span className="row-where">Row {r.row}</span>
                </th>
                <td className="target" data-label="Goes to">
                  <span className="target-path">{r.skipped && !r.target ? 'Not imported' : label}</span>
                  {canChange && (
                    <select className="input" aria-label={`Change where ${r.name} goes, ${sheetName} row ${r.row}`} aria-describedby={rowId(r)} value={choiceValue(choice)} onChange={e => onTarget(r.key, e.target.value)}>
                      <option value="auto">Automatic</option>
                      <option value="skip">Skip</option>
                      <option value="misc">Miscellaneous</option>
                      <optgroup label="Put it on an existing row">
                        {existing.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </optgroup>
                    </select>
                  )}
                  {r.needsPlace && <p className="help">Change this in “Rows that need a place”.</p>}
                  <ul className="row-notes">
                    {r.skipped && <li className="is-skip">{r.skipped}.</li>}
                    {note && <li className="is-info">{note}</li>}
                    {r.warnings.map(w => <li key={w}>{w}</li>)}
                  </ul>
                </td>
                <td className="num" data-label="Purchases">{r.purchases}</td>
                <td className="num" data-label="Total">{money(r.total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {shown.length === 0 && <p className="help table-foot">Nothing from this sheet will be imported.</p>}
    </div>
  )
}
