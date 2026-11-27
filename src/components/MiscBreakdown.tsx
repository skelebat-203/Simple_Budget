import { useEffect, useRef, useState } from 'react'
import type { BudgetItem } from '../storage/db'
import { flatten, formatAmount, isoDate, periodsFor, type Calendar, type CatNode } from '../budget/tree'
import { cleanName, slug } from '../budget/validate'
import { miscKey, NameTakenError, RowInUseError, saveMiscForFuture } from '../storage/repository'
import { isSyncBusy } from '../storage/sync/controller'
import { useAnnounce } from './ui/announcer'
import { Button } from './ui'
import { SYNC_BUSY } from './BudgetTable'
import { useStickyHead } from './ui/useStickyHead'

/** A row bought in more than this many months is marked for review in December (0014 §3, M1, M4). */
export const REVIEW_MONTHS = 6
const NO_DESCRIPTION = 'No description'
const ICON_SIZE = 18
/** Index of December among the year's columns. */
const DECEMBER = 11

type Group = { key: string; label: string; byMonth: number[]; total: number; /** Months with at least one purchase (0014 M1). */ seen: Set<number> }

/**
 * Misc. Breakdown under the Annual table (0014, M5 option A): one row per distinct
 * description among the year's Incidentals › Miscellaneous purchases, Jan to Dec and Total.
 * Each row's "Save for future" makes it an item under Incidentals (M2).
 */
export function MiscBreakdown({ roots, items, calendar, date, onChanged }: {
  roots: CatNode[]
  items: BudgetItem[]
  calendar: Calendar
  /** A day in the year shown. */
  date: Date
  onChanged: () => void
}) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [todayIso] = useState(() => isoDate(new Date()))
  useAnnounce(status)
  useAnnounce(error)
  const tableRef = useRef<HTMLTableElement>(null)
  useStickyHead(tableRef, true)
  const focusAfter = useRef<string | null>(null)
  useEffect(() => {
    if (!focusAfter.current) return
    document.getElementById(focusAfter.current)?.focus()
    focusAfter.current = null
  })

  const misc = flatten(roots).find(n => n.cat.name === 'Miscellaneous' && n.parent?.cat.name === 'Incidentals' && n.parent.parent?.cat.name === 'Expenses')
  if (!misc) return null
  const { columns, total, title } = periodsFor('annual', date, calendar)
  const span = total ?? columns[0]
  /** The review shows once the year has reached December (0014 §3). */
  const review = todayIso >= columns[DECEMBER].from

  const groups = new Map<string, Group>()
  for (const i of items) {
    if (i.categoryId !== misc.cat.id || i.date < span.from || i.date > span.to) continue
    const key = miscKey(i.description)
    const g = groups.get(key) ?? { key, label: key ? i.description!.trim() : NO_DESCRIPTION, byMonth: columns.map(() => 0), total: 0, seen: new Set<number>() }
    const m = columns.findIndex(p => i.date >= p.from && i.date <= p.to)
    if (m >= 0) { g.byMonth[m] += i.amount; g.seen.add(m) }
    g.total += i.amount
    groups.set(key, g)
  }
  const rows = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))
  const rowId = (g: Group) => `misc-row-${slug(g.label) || 'none'}`
  const saveId = (g: Group) => `misc-save-${slug(g.label) || 'none'}`

  async function save(g: Group, k: number) {
    setStatus(''); setError('')
    if (isSyncBusy()) { setError(SYNC_BUSY); return }
    const name = cleanName(g.label)
    setBusy(true)
    try {
      const { moved, mergedInto } = await saveMiscForFuture(misc!.cat.id, name, g.key)
      const count = `${moved} purchase${moved === 1 ? '' : 's'}`
      setStatus(mergedInto ? `Moved ${count} to ${mergedInto}.` : `Saved ${name} for future as an item in Incidentals. ${count} moved from Miscellaneous.`)
      const next = rows[k + 1] ?? rows[k - 1]
      focusAfter.current = next && next.key ? saveId(next) : 'misc-heading'
      onChanged()
    } catch (err) {
      setError(err instanceof NameTakenError ? `Invalid: ${err.message}.`
        : err instanceof RowInUseError ? `Error: ${name} wasn’t saved because ${err.message}`
          : `Error: ${name} wasn’t saved. Try again.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="misc-breakdown" aria-labelledby="misc-heading">
      <h3 id="misc-heading" className="misc-heading" tabIndex={-1}>Misc. Breakdown</h3>
      <p className="help">Rows bought in more than {REVIEW_MONTHS} months of the year are marked Review in December. Consider adding them to the table.</p>
      <div className="table-box page-head">
        <table ref={tableRef} className="table budget-table misc-table" aria-labelledby="misc-heading misc-caption">
          <caption id="misc-caption">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="name">Description</th>
              {columns.map(p => <th key={p.label} scope="col" className="num period-start" aria-label={p.fullLabel}>{p.label}</th>)}
              {total && <th scope="col" className="num period-start">{total.label}</th>}
              <th scope="col" className="name">Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((g, k) => {
              const flag = review && g.seen.size > REVIEW_MONTHS
              return (
                <tr key={g.key} className={`row${flag ? ' review' : ''}`}>
                  <th scope="row" className="name" id={rowId(g)}>
                    <span className="name-line">
                      {flag && (
                        <svg className="review-icon" role="img" aria-label="Review" focusable="false" viewBox="0 0 24 24" width={ICON_SIZE} height={ICON_SIZE}>
                          <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                        </svg>
                      )}
                      {g.label}
                    </span>
                  </th>
                  {g.byMonth.map((v, m) => <td key={m} className={`num period-start${v < 0 ? ' neg' : ''}`}>{formatAmount(v)}</td>)}
                  <td className={`num period-start${g.total < 0 ? ' neg' : ''}`}>{formatAmount(g.total)}</td>
                  <td className="row-actions">
                    {g.key && (
                      <Button type="button" className="secondary small" id={saveId(g)} disabled={busy}
                        aria-label={`Save for future: ${g.label}`} aria-describedby={rowId(g)} onClick={() => save(g, k)}>Save for future</Button>
                    )}
                  </td>
                </tr>
              )
            }) : <tr><td className="empty" colSpan={columns.length + 3}>No Miscellaneous purchases in Incidentals this year.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="status">{status}</p>
      {error && <p className="error">{error}</p>}
    </section>
  )
}
