import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BudgetItem, Range } from '../storage/db'
import { actualFor, ancestors, childColor, domId, flatten, estimateTotal, isoDate, formatAmount, isTotal, periodsFor, rangeHasEstimates, repeatedNames, scheduleText, spokenName, type Calendar, type CatNode, type Period } from '../budget/tree'
import { slug } from '../budget/validate'
import { addNewItem, budgetItemRepo, categoryRepo, NameTakenError, RowInUseError } from '../storage/repository'
import { PurchaseDialog } from './PurchaseDialog'
import type { PurchaseSave } from './PurchaseForm'
import { AmountDialog, Banner, Button, Dialog, RenameDialog, UpdateDialog, type SaveResult, type UpdateChange } from './ui'
import { useCollapsed } from './ui/useCollapsed'
import { useWide } from './ui/useWide'
import { useStickyHead } from './ui/useStickyHead'
import { fireReward } from '../rewards/rewards'
import { useAnnounce } from './ui/announcer'
import { isSyncBusy } from '../storage/sync/controller'
import { Chevron } from './ui/Expander'
import { ActionsMenu, type MenuAction } from './ui/ActionsMenu'

/** While a sync runs the tables take no changes (0015 Q4). */
export const SYNC_BUSY = 'Error: Sync is running. Try again in a moment.'

/** Note on an imported purchase whose date was not in the file (0013 §5). */
const UNDATED_NOTE = 'Date not in the imported file. It was placed on the first day of its week or month.'

/**
 * Table actions, each opening a dialog: 'new' and 'update' from the Actions menu (Week, Month),
 * 'updatePurchase' from a Day purchase's Update button, 'rename' from Annual's pencil, 'delete' from an Update dialog.
 */
type Act = 'new' | 'update' | 'updatePurchase' | 'rename' | 'delete'
type Dlg = { act: Act; n: CatNode; purchase?: BudgetItem }

const GRID = '__grid__'

/** A negative Day purchase (refund or credit) is listed as a return, "(-$n.nn)" (v0.7 step 9). Totals still add the negative amount. */
const isReturn = (i: BudgetItem) => i.amount < 0
const purchaseAmount = (i: BudgetItem) => isReturn(i) ? `(-$${formatAmount(-i.amount)})` : formatAmount(i.amount) || '0.00'
const purchaseNoun = (i: BudgetItem) => isReturn(i) ? `return of $${formatAmount(-i.amount)}` : `purchase of ${formatAmount(i.amount) || '0.00'}`
const PENCIL_SIZE = 18
const charityText = (n: number) => n ? ` Your ${n} Charity purchase${n === 1 ? '' : 's'} moved to Charity › Miscellaneous.` : ''

/**
 * Budget table per docs/design/0004-table-design.md: tree order, indents
 * 0/1/2, category colors, computed rows, only rows with an amount, and
 * expand/collapse state kept across range changes and restarts.
 *
 * Week and Month have an Actions column (New purchase, Update); Annual renames with a pencil only
 * (0009 §4); the Day table (under Add purchase) lists today's purchases with an Update button each.
 */
export function BudgetTable({ roots, items, range, showEstimates: wantEstimates, calendar, date, idBase = 'budget', preview = false, highlight = false, allRoots, onChanged, onMoved, pageHead = false }: {
  /** Highlight dialog: a row moved under these rows; the main table opens them (v0.7 step 11). */
  onMoved?: (ids: number[]) => void
  roots: CatNode[]
  /** On the page (not in a dialog): no fixed-height box; the header row stays in view while the page scrolls (v0.7 step 6). */
  pageHead?: boolean
  /** A day in the range to show (0007 §9.5 date nav). Default: today. */
  date?: Date
  /** Data changed from a table action (0007 §9); reload. */
  onChanged?: () => void
  /** Prefix for this table's ids; the heading it's named by is `{idBase}-heading`. */
  idBase?: string
  /** Read-only preview (0007 §5.4): every row expanded, no buttons. */
  preview?: boolean
  /** Inside a highlight dialog (0009 §3): every row open, names are plain text, ids are prefixed so they stay unique. */
  highlight?: boolean
  /** The whole tree, when `roots` is only part of it (highlight dialog): where Move to may put a row. */
  allRoots?: CatNode[]
  calendar: Calendar
  items: BudgetItem[]
  range: Range
  showEstimates: boolean
}) {
  const tree = allRoots ?? roots
  const did = (field: string, n: CatNode) => domId(highlight ? `hl_${field}` : field, n)
  const day = range === 'day'
  /** Plain rows: every row open, no expand or name buttons (preview, highlight dialog, Day table). */
  const plain = preview || highlight || day
  const showEstimates = wantEstimates && rangeHasEstimates(range)
  const wide = useWide()
  // Below 640px the categories start closed until the user opens or closes a row (v0.7 step 6).
  const [collapsed, toggle, openRows] = useCollapsed(wide ? [] : roots.map(r => r.cat.id))
  const gridRef = useRef<HTMLTableElement>(null)
  useStickyHead(gridRef, pageHead)
  const [today] = useState(() => new Date())
  const { columns, total, title } = periodsFor(range, date ?? today, calendar)
  const periods = total ? [...columns, total] : columns

  const actions = !preview && !!onChanged
  /** The Actions column (v0.7 step 15d): every table but Annual, which renames with a pencil in the name cell (0009 §4). */
  const actionCol = actions && range !== 'annual'
  const repeated = repeatedNames(tree)
  const say = (n: CatNode) => spokenName(n, repeated)
  const payWord = (n: CatNode) => (ancestors(n)[0] ?? n).cat.name === 'Income' ? 'Pay' : 'Due'
  /** Open action dialog. */
  const [dlg, setDlg] = useState<Dlg | null>(null)
  /** Open highlight dialog (0009 §3): a row with its children. */
  const [hl, setHl] = useState<{ id: number } | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  /** A refusal: nothing failed, so an info banner, not the green status (0012 G12). */
  const [notice, setNotice] = useState('')
  useAnnounce(status)
  useAnnounce(error)
  useAnnounce(notice)
  const focusAfter = useRef<string | null>(null)
  const focusTries = useRef(0)
  useEffect(() => {
    if (!focusAfter.current) return
    // GRID: focus the table's first control (e.g. after the last purchase in a list is deleted).
    const el = focusAfter.current === GRID ? gridRef.current?.querySelector<HTMLElement>('tbody button, tbody input, tbody select') : document.getElementById(focusAfter.current)
    // A renamed row gets a new id only after the reload renders it, so wait a few renders for it.
    if (!el && ++focusTries.current < 4) return
    el?.focus()
    focusAfter.current = null
    focusTries.current = 0
  })

  // Day: each purchase is its own row under its item, by time (0007 §9.1).
  const purchasesOf = (n: CatNode) => day
    ? items.filter(i => i.categoryId === n.cat.id && i.date === periods[0].from).sort((a, b) => a.createdAt - b.createdAt)
    : []
  const purchaseTime = (i: BudgetItem) => new Date(i.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const purchaseLabel = (i: BudgetItem) => `${isReturn(i) ? 'Return' : 'Purchase'}, ${purchaseTime(i)}`
  const purchaseId = (n: CatNode, i: BudgetItem) => ['update_purchase', n.parent && slug(n.parent.cat.name), slug(n.cat.name), i.id].filter(Boolean).join('-')
  /** Row header ids: every control in a row is described by its row header (digital_accessibility.md, Tables). */
  const rowId = (n: CatNode) => did(`${idBase}_row`, n)
  const purchaseRowId = (n: CatNode, i: BudgetItem) => purchaseId(n, i).replace('update_purchase', `${idBase}_row_purchase`)
  /** The Actions button id of row `n` once it is named `name` under `parent` (after an Update reloads the tree). */
  const actionsIdAfter = (n: CatNode, name: string, parent: CatNode | null) =>
    [highlight ? 'hl_actions' : 'actions', parent && slug(parent.cat.name), slug(name), n.cat.id].filter(Boolean).join('-')

  async function removePurchase(n: CatNode, i: BudgetItem, next: string): Promise<SaveResult> {
    if (isSyncBusy()) return SYNC_BUSY
    try {
      await budgetItemRepo.remove(i.id!)
    } catch {
      return `Error: The ${n.cat.name} purchase wasn’t deleted. Try again.`
    }
    setDlg(null)
    setStatus(`Deleted the ${say(n)} ${purchaseNoun(i)}.`)
    focusAfter.current = next
    onChanged?.()
  }

  const span = total ?? columns[0]
  const todayIso = isoDate(today)
  /** Date for an amount added from Week/Month: today if it's in range, else the range's last day. */
  const addDate = todayIso >= span.from && todayIso <= span.to ? todayIso : span.to

  /** A row takes purchases itself: not a total row (0007 §2.1). */
  const takesAmounts = (n: CatNode) => !isTotal(n) && n.cat.name !== 'Net Income'
  /** Actions menu for a Week or Month row (v0.7 step 15d): New purchase and Update. */
  function menuActions(n: CatNode): MenuAction<Act>[] {
    const list: MenuAction<Act>[] = []
    const item = (value: Act, label: string) => list.push({ value, label, id: did(`actions_${value}`, n) })
    if (takesAmounts(n)) item('new', 'New purchase')
    if (n.parent || takesAmounts(n)) item('update', 'Update')
    return list
  }
  function act(n: CatNode, a: Act, purchase?: BudgetItem) {
    if (a === 'delete' && !purchase) {
      const why = n.children.length ? 'delete its items first'
        : items.filter(i => i.categoryId === n.cat.id).length > 1 ? 'it has more than one purchase; delete them under Add purchase first' : ''
      if (why) { setDlg(null); setNotice(`${say(n)} can’t be deleted yet: ${why}.`); return }
    }
    setError(''); setNotice('')
    setDlg({ act: a, n, purchase })
  }

  /** Annual's pencil: a name change only (0009 §4). */
  async function saveRename(n: CatNode, name: string): Promise<SaveResult> {
    if (isSyncBusy()) return SYNC_BUSY
    try {
      await categoryRepo.rename(n.cat.id, name)
    } catch (err) {
      if (err instanceof NameTakenError) return `Invalid: Name ${err.message}`
      if (err instanceof RowInUseError) { setDlg(null); setError(`Error: ${n.cat.name} wasn’t renamed because ${err.message}`); onChanged?.(); return }
      return `Error: ${n.cat.name} wasn’t renamed. Try again.`
    }
    setDlg(null)
    setStatus(`Renamed ${say(n)} to ${name}.`)
    focusAfter.current = [highlight ? 'hl_rename' : 'rename', n.parent && slug(n.parent.cat.name), slug(name), n.cat.id].filter(Boolean).join('-')
    onChanged?.()
  }

  /** New purchase from the Actions menu (0009 §4.1). */
  async function saveNew(n: CatNode, amount: number, description: string, date: string): Promise<SaveResult> {
    if (isSyncBusy()) return SYNC_BUSY
    try {
      await budgetItemRepo.add({ categoryId: n.cat.id, amount, date, ...(description ? { description } : {}) })
    } catch {
      return `Error: The purchase for ${n.cat.name} wasn’t saved. Try again.`
    }
    setDlg(null)
    setStatus(`Added a ${say(n)} purchase of ${formatAmount(amount) || '0.00'} on ${date}.`)
    focusAfter.current = did('actions', n)
    onChanged?.()
    fireReward()
  }

  const pathLabel = (d: CatNode) => d.parent ? `${d.parent.cat.name} › ${d.cat.name}` : d.cat.name
  /** Where Move to may put a row: any category or subcategory but its own parent, itself and its subcategories (v0.7 step 11). */
  const moveChoices = (n: CatNode) => flatten(tree)
    .filter(d => d.depth <= 1 && d.cat.name !== 'Net Income' && d.cat.id !== n.cat.id && d.cat.id !== n.parent?.cat.id && d.parent?.cat.id !== n.cat.id)

  /**
   * Update's Save (v0.7 step 15d): rename, then move, then add the difference to the period total.
   * The name and the move are checked against the tree first, so a refusal changes nothing;
   * each write is still checked again inside its own transaction.
   */
  async function saveUpdate(n: CatNode, c: UpdateChange): Promise<SaveResult> {
    if (isSyncBusy()) return SYNC_BUSY
    const dest = c.moveTo ? flatten(tree).find(x => x.cat.id === c.moveTo) : undefined
    const name = c.name ?? n.cat.name
    const parent = dest ?? n.parent
    if (dest && dest.depth === 1 && n.children.length) {
      return `Error: ${say(n)} has ${n.children.length} item${n.children.length === 1 ? '' : 's'}, so it cannot go inside another subcategory. Move its items out first.`
    }
    if ((c.name || dest) && parent?.children.some(s => s.cat.id !== n.cat.id && slug(s.cat.name) === slug(name))) {
      return `Invalid: Name “${name}” already exists in ${parent.cat.name}`
    }
    const done: string[] = []
    let charity = 0, movedFrom: string | undefined
    try {
      if (c.name) { await categoryRepo.rename(n.cat.id, c.name); done.push(`renamed it ${c.name}`) }
      if (dest) {
        const moved = { ...n, parent: dest }
        const recolor = [{ id: n.cat.id, color: childColor(dest) }, ...n.children.map(k => ({ id: k.cat.id, color: childColor(moved) }))]
        ;({ charity, movedFrom } = await categoryRepo.moveTo(n.cat.id, dest.cat.id, recolor))
        done.push(`moved it to ${pathLabel(dest)} as ${dest.depth === 0 ? 'a subcategory' : 'an item'}`)
      }
      if (c.amount !== undefined) {
        const diff = Math.round((c.amount - actualFor(n, span, items)) * 100) / 100
        if (diff) await budgetItemRepo.add({ categoryId: n.cat.id, amount: diff, date: addDate })
        done.push(`set the total for ${title} to ${formatAmount(c.amount) || '0.00'}`)
      }
    } catch (err) {
      const soFar = done.length ? ` Already saved: ${done.join(', ')}.` : ''
      if (done.length) onChanged?.()
      if (err instanceof NameTakenError) return `Invalid: Name ${err.message}.${soFar}`
      if (err instanceof RowInUseError) return `Error: ${n.cat.name} wasn’t updated because ${err.message}${soFar}`
      return `Error: ${n.cat.name} wasn’t updated. Try again.${soFar}`
    }
    setDlg(null)
    setStatus(`Updated ${say(n)}: ${done.join(', ')}.${movedFrom ? ` ${movedFrom}’s own amounts moved to ${movedFrom} › Miscellaneous.` : ''}${charityText(charity)}`)
    if (dest) {
      // Open the rows above the moved row so it shows (here, and in the main table behind a highlight).
      const open = [...ancestors(dest).map(a => a.cat.id), dest.cat.id]
      openRows(open)
      onMoved?.(open)
    }
    // Focus the row's Actions button; in a highlight a row that moved out of it hands focus to the highlighted row's.
    const top = roots[0]
    const stays = !highlight || !dest || top.cat.id === n.cat.id || flatten([top]).some(x => x.cat.id === dest.cat.id)
    focusAfter.current = stays ? actionsIdAfter(n, name, parent) : top.parent ? did('actions', top) : GRID
    onChanged?.()
  }

  /** A Day purchase's Update dialog Save: the old record is removed and a new one added (all or nothing). A name clash is thrown to the dialog. */
  async function savePurchase(old: BudgetItem, n: CatNode, p: PurchaseSave): Promise<SaveResult> {
    if (isSyncBusy()) return SYNC_BUSY
    let charity = 0
    let target = n
    try {
      if (p.kind === 'existing') {
        target = p.target
        await budgetItemRepo.replace(old.id!, { categoryId: p.target.cat.id, amount: p.amount, date: p.date, ...(p.description ? { description: p.description } : {}) })
      } else {
        charity = (await addNewItem({ ...p.args, replaceId: old.id })).charityMoved
      }
    } catch (err) {
      if (err instanceof NameTakenError) throw err
      return `Error: The ${n.cat.name} purchase wasn’t saved. Try again.`
    }
    setDlg(null)
    const text = formatAmount(p.kind === 'existing' ? p.amount : p.args.amount) || '0.00'
    setStatus(`Saved the ${p.kind === 'existing' ? say(target) : p.name} purchase of ${text}.${charityText(charity)}`)
    // The purchase is a new record, maybe under another item or day: focus the table.
    focusAfter.current = GRID
    onChanged?.()
  }

  async function deleteRow(n: CatNode) {
    if (isSyncBusy()) { setDlg(null); setError(SYNC_BUSY); return }
    try {
      await categoryRepo.removeEmpty(n.cat.id)
    } catch (err) {
      // Name the reason when the row changed since it was shown (e.g. a purchase added in another tab).
      setError(err instanceof RowInUseError ? `Error: ${n.cat.name} wasn’t deleted because ${err.message}` : `Error: ${n.cat.name} wasn’t deleted. Try again.`)
      setDlg(null)
      onChanged?.()
      return
    }
    setDlg(null)
    setStatus(`Deleted ${say(n)}.`)
    focusAfter.current = GRID
    onChanged?.()
  }

  const withOne = (n: CatNode) => {
    const p = items.find(i => i.categoryId === n.cat.id)
    return p ? ` and its purchase of ${formatAmount(p.amount) || '0.00'}` : ''
  }

  /** Annual: the name's pencil opens Rename, a name change only (0009 §4, 0012 G9). */
  function renameControls(n: CatNode): ReactNode {
    if (!actions || range !== 'annual' || !n.parent) return null
    return (
      <Button type="button" className="secondary icon" id={did('rename', n)} aria-label={`Rename ${say(n)}`} aria-describedby={rowId(n)} aria-haspopup="dialog"
        onClick={() => act(n, 'rename')}>
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width={PENCIL_SIZE} height={PENCIL_SIZE}>
          <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
      </Button>
    )
  }

  /** Actions cell of a category row: the Actions menu in Week and Month; nothing in Day (its purchases have Update). */
  function rowActions(n: CatNode): ReactNode {
    if (!actionCol) return null
    const list = day ? [] : menuActions(n)
    return (
      <td className="row-actions">
        {list.length > 0 && <ActionsMenu id={did('actions', n)} label={`Actions for ${say(n)}`} describedBy={rowId(n)} items={list} onSelect={k => act(n, k)} />}
      </td>
    )
  }
  const purchaseUpdate = (n: CatNode, i: BudgetItem) => (
    <Button type="button" className="secondary small" id={purchaseId(n, i)} aria-haspopup="dialog"
      aria-label={`Update ${say(n)} ${purchaseNoun(i)}, ${purchaseTime(i)}${i.description ? `, ${i.description}` : ''}`} aria-describedby={purchaseRowId(n, i)}
      onClick={() => act(n, 'updatePurchase', i)}>Update</Button>
  )

  const values = (n: CatNode, p: Period) => ({ est: estimateTotal(n, p), act: actualFor(n, p, items) })
  const hasAmount = (n: CatNode) =>
    periods.some(p => { const v = values(n, p); return v.act !== 0 || (showEstimates && v.est !== 0) })

  /** Week, Month and Annual: a solid border starts each period, Total included (0008 §4). */
  const start = day ? '' : ' period-start'
  const cells = (get: (p: Period) => { est: number; act: number }) => periods.map(p => {
    const v = get(p)
    return (
      <Fragment key={p.from + p.label}>
        {showEstimates && <td className={`num${start}`}>{formatAmount(v.est)}</td>}
        <td className={`num${showEstimates ? '' : start}${v.act < 0 ? ' neg' : ''}`}>{formatAmount(v.act)}</td>
      </Fragment>
    )
  })

  const byName = (name: string) => roots.find(r => r.cat.name === name)
  const netIncome = (p: Period) => {
    const sum = (name: string) => { const n = byName(name); return n ? values(n, p) : { est: 0, act: 0 } }
    const [income, tax] = [sum('Income'), sum('Taxes')]
    return { est: income.est - tax.est, act: income.act - tax.act }
  }

  const rows: ReactNode[] = []
  /** A highlight shows its row at the left edge. */
  const base = highlight ? roots[0]?.depth ?? 0 : 0
  /** A row expands when it has child rows with amounts. */
  const expandable = (n: CatNode) => n.children.some(hasAmount)
  function addRow(n: CatNode) {
    if (!hasAmount(n)) return
    const kids = n.children.filter(hasAmount)
    const open = plain || !collapsed.has(n.cat.id)
    const label = n.cat.name
    rows.push(
      <tr key={n.cat.id} className={`row depth-${n.depth - base}${n.children.length ? ' group' : ''}`}
        {...(plain ? {} : { 'data-id': n.cat.id, 'aria-level': n.depth + 1, 'aria-expanded': expandable(n) ? open : undefined })}>
        <th scope="row" id={rowId(n)} className={`name clr-${n.cat.color}`}>
          <span className="name-line">
            {plain ? <span>{label}</span> : <>
              {expandable(n) && <Chevron open={open} onToggle={() => toggle(n.cat.id)} id={did('expand', n)} label={say(n)} describedBy={rowId(n)} />}
              <button type="button" className="name-link" id={did('name', n)} aria-haspopup="dialog"
                aria-label={say(n) === label ? undefined : say(n)} aria-describedby={rowId(n)}
                onClick={() => setHl({ id: n.cat.id })}>{label}</button>
            </>}
            {renameControls(n)}
          </span>
          {(range === 'week' || range === 'month') && !isTotal(n) && (scheduleText(n.cat, payWord(n)) || n.cat.autopay) && (
            <span className="row-meta">
              {[scheduleText(n.cat, payWord(n)), n.cat.autopay && 'autopay'].filter(Boolean).join(', ')}
            </span>
          )}
        </th>
        {cells(p => values(n, p))}
        {rowActions(n)}
      </tr>,
    )
    if (!open) return
    purchasesOf(n).forEach(i => {
      rows.push(
        <tr key={`p${i.id}`} className={`row purchase depth-${n.depth + 1 - base}`}>
          <th scope="row" id={purchaseRowId(n, i)} className="name">
            <span className="name-line">{purchaseLabel(i)}</span>
            {i.description && <span className="row-description">{i.description}</span>}
            {i.undated && <span className="row-description">{UNDATED_NOTE}</span>}
          </th>
          <td className={`num${isReturn(i) ? ' neg' : ''}`}>{purchaseAmount(i)}</td>
          {actionCol && <td className="row-actions">{purchaseUpdate(n, i)}</td>}
        </tr>,
      )
    })
    kids.forEach(addRow)
  }
  for (const r of roots) {
    if (r.cat.name !== 'Net Income') { addRow(r); continue }
    if (periods.some(p => { const v = netIncome(p); return v.act !== 0 || (showEstimates && v.est !== 0) })) {
      rows.push(
        <tr key={r.cat.id} className="row depth-0 net" {...(plain ? {} : { 'aria-level': 1 })}>
          <th scope="row" className={`name clr-${r.cat.color}`}>Net Income</th>
          {cells(netIncome)}
          {actionCol && <td />}
        </tr>,
      )
    }
  }

  const hlNode = hl ? flatten(roots).find(x => x.cat.id === hl.id) : undefined

  /** The highlight dialog (0009 §3): the row as this table shows it, with the same Actions. */
  function highlightDialog(): ReactNode {
    if (!hlNode) return null
    const close = () => setHl(null)
    return (
      <Dialog id={`${idBase}-highlight`} title={hlNode.cat.name} className="highlight-dialog" onClose={close}
        buttons={<><span /><Button type="button" className="secondary" onClick={close}>Close</Button></>}>
        <p className="help">{hlNode.children.length ? `${say(hlNode)} and the rows under it.` : `${say(hlNode)} has nothing under it.`}</p>
        <BudgetTable roots={[hlNode]} items={items} range={range} showEstimates={wantEstimates} calendar={calendar} date={date}
          idBase={`${idBase}-hl`} highlight allRoots={tree} onChanged={onChanged} onMoved={openRows} />
      </Dialog>
    )
  }

  /** The open action dialog. */
  function actionDialog(d: Dlg): ReactNode {
    const { n, purchase } = d
    const id = `${idBase}-${d.act}`
    const close = () => setDlg(null)
    switch (d.act) {
      case 'rename':
        return <RenameDialog id={id} spoken={say(n)} name={n.cat.name} onSave={name => saveRename(n, name)} onCancel={close} />
      case 'new':
        return <AmountDialog id={id} title={`New purchase for ${say(n)}`} spoken={say(n)} dateField={{ initial: addDate, min: span.from, max: span.to }}
          intro={`Adds a purchase to ${say(n)}. Use a minus sign for a refund, or type a sum, e.g. 12.50+3.`}
          onSave={(amount, description, date) => saveNew(n, amount, description, date)} onCancel={close} />
      case 'update': {
        const moves = n.parent ? [{ value: '', label: `Keep in ${pathLabel(n.parent)}` }, ...moveChoices(n).map(x => ({ value: String(x.cat.id), label: pathLabel(x) }))] : undefined
        return <UpdateDialog id={id} spoken={say(n)} name={n.parent ? n.cat.name : undefined} moves={moves}
          amount={takesAmounts(n) ? { label: `Total for ${title}`, current: actualFor(n, span, items), help: `Changing it adds the difference as a new amount on ${addDate}. Use a minus sign to subtract, or type a sum, e.g. 100+20.` } : undefined}
          onSave={c => saveUpdate(n, c)} onDelete={n.parent ? () => act(n, 'delete') : undefined} onCancel={close} />
      }
      case 'updatePurchase':
        return <PurchaseDialog id={id} title={`Update ${purchaseLabel(purchase!)}, ${say(n)}`} roots={tree} node={n} purchase={purchase!}
          onSave={p => savePurchase(purchase!, n, p) as Promise<string | void>}
          onDelete={() => setDlg({ act: 'delete', n, purchase })} onCancel={close} />
      case 'delete': {
        const confirmDelete = purchase
          ? () => { const bought = purchasesOf(n); const k = bought.indexOf(purchase)
            removePurchase(n, purchase, bought[k + 1] ? purchaseId(n, bought[k + 1]) : bought[k - 1] ? purchaseId(n, bought[k - 1]) : GRID) }
          : () => deleteRow(n)
        return (
          <Dialog id={id} title={purchase ? `Delete the ${say(n)} purchase?` : `Delete ${say(n)}?`}
            confirm={{ label: 'Delete', danger: true, onConfirm: confirmDelete }} onClose={close}>
            {purchase ? `This deletes the ${purchaseNoun(purchase)}.` : `This deletes ${n.cat.name}${withOne(n)}.`}
          </Dialog>
        )
      }
    }
  }

  const colSpan = showEstimates ? 2 : 1
  return (
    <div className="table-wrap">
      {/* Only the table scrolls sideways (v0.4 review); no help text under it (v0.7 step 8). */}
      {/* A read-only table has no controls, so its scroll box takes focus to scroll by keyboard in every browser (v0.7 step 12). */}
      <div className={`table-box${pageHead ? ' page-head' : ''}`} {...(preview ? { tabIndex: 0, role: 'region', 'aria-labelledby': `${idBase}-heading` } : {})}>
        <table className={`table budget-table${day ? ' day-table' : ''}`} aria-labelledby={highlight ? `${idBase}-caption` : `${idBase}-heading ${idBase}-caption`}
          ref={gridRef} role={plain ? undefined : 'treegrid'}>
          <caption id={`${idBase}-caption`}>{title}</caption>
          <thead>
            {!day && range !== 'annual' && showEstimates && (
              <tr>
                <td />
                {periods.map(p => <th key={p.label} scope="colgroup" className={start.trim()} colSpan={colSpan} aria-label={p.fullLabel}>{p.label}</th>)}
                {actionCol && <td />}
              </tr>
            )}
            <tr>
              <th scope="col" className="name">Item</th>
              {range === 'annual' || (!day && !showEstimates)
                // One value per period (Annual, or estimates hidden): each period heads its own column (0007 §10).
                ? periods.map(p => <th key={p.label} scope="col" className={`num${start}`} aria-label={p.fullLabel}>{p.label}</th>)
                : periods.map(p => (
                  <Fragment key={p.label}>
                    {showEstimates && <th scope="col" className={`num${start}`}><span aria-hidden="true">Est.</span><span className="sr-only">Estimated</span></th>}
                    <th scope="col" className={`num${showEstimates ? '' : start}`}><span aria-hidden="true">Act.</span><span className="sr-only">Actual</span></th>
                  </Fragment>
                ))}
              {actionCol && <th scope="col" className="name">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows : <tr><td className="empty" colSpan={1 + periods.length * colSpan + (actionCol ? 1 : 0)}>Nothing recorded for this range yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {notice && <Banner kind="info" title={notice} />}
      {actions && <p className="status">{status}</p>}
      {highlightDialog()}
      {dlg && actionDialog(dlg)}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
