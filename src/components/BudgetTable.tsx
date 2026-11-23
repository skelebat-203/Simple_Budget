import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BudgetItem, Range } from '../storage/db'
import { actualFor, ancestors, childColor, domId, flatten, estimateTotal, isoDate, formatAmount, isTotal, periodsFor, rangeHasEstimates, repeatedNames, scheduleText, spokenName, type Calendar, type CatNode, type Period } from '../budget/tree'
import { slug } from '../budget/validate'
import { addNewItem, budgetItemRepo, categoryRepo, NameTakenError, RowInUseError } from '../storage/repository'
import { PurchaseDialog } from './PurchaseDialog'
import type { PurchaseSave } from './PurchaseForm'
import { AmountDialog, Banner, Button, Dialog, RenameDialog, Tip, type SaveResult } from './ui'
import { useCollapsed } from './ui/useCollapsed'
import { useWide } from './ui/useWide'
import { useStickyHead } from './ui/useStickyHead'
import { fireReward } from '../rewards/rewards'
import { announce, useAnnounce } from './ui/announcer'
import { isSyncBusy } from '../storage/sync/controller'

/** While a sync runs the tables take no changes (0015 Q4). */
export const SYNC_BUSY ='Error: Sync is running. Try again in a moment.'
import { Chevron } from './ui/Expander'
import { ActionsMenu, type MenuAction } from './ui/ActionsMenu'

/** Note on an imported purchase whose date was not in the file (0013 §5). */
const UNDATED_NOTE = 'Date not in the imported file. It was placed on the first day of its week or month.'

/** Edit actions (0009 §4): each opens a dialog. 'new' is Day's New purchase, 'adjust' is Add/Subtract on an item's total, 'editPurchase' is a Day purchase's Edit dialog. */
type Act = 'rename' | 'new' | 'adjust' | 'editPurchase' | 'delete'
type Dlg = { act: Act; n: CatNode; purchase?: BudgetItem }

const GRID = '__grid__'

/** A negative Day purchase (refund or credit) is listed as a return, "(-$n.nn)" (v0.7 step 9). Totals still add the negative amount. */
const isReturn = (i: BudgetItem) => i.amount < 0
const purchaseAmount = (i: BudgetItem) => isReturn(i) ? `(-$${formatAmount(-i.amount)})` : formatAmount(i.amount) || '0.00'
const purchaseNoun = (i: BudgetItem) => isReturn(i) ? `return of $${formatAmount(-i.amount)}` : `purchase of ${formatAmount(i.amount) || '0.00'}`
const PENCIL_SIZE = 18

/**
 * Budget table per docs/design/0004-table-design.md: tree order, indents
 * 0/1/2, category colors, computed rows, only rows with an amount, and
 * expand/collapse state kept across range changes and restarts.
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
  /** Read-only preview (0007 §5.4): every row expanded, no expand/collapse buttons. */
  preview?: boolean
  /** Inside a highlight dialog (0009 §3): every row open, names are plain text, ids are prefixed so they stay unique. */
  highlight?: boolean
  /** The whole tree, when `roots` is only part of it (highlight dialog): where Rename may move a row. */
  allRoots?: CatNode[]
  calendar: Calendar
  items: BudgetItem[]
  range: Range
  showEstimates: boolean
}) {
  const tree = allRoots ?? roots
  const did = (field: string, n: CatNode) => domId(highlight ? `hl_${field}` : field, n)
  /** Plain rows: no expand or name buttons (preview and highlight dialog). */
  const plain = preview || highlight
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
  /** Edit menus and buttons: Annual edits names in the name cell (0007 §10); the highlight dialog puts Edit next to the name (0012 G15). Otherwise an Edit column. */
  const hasEdit = actions && range !== 'annual'
  const editInName = hasEdit && highlight
  const actionCol = hasEdit && !highlight
  /** The highlight dialog's Move column (v0.7 step 11): Up, Down and Move to. */
  const moveCol = actions && highlight
  const repeated = repeatedNames(roots)
  const say = (n: CatNode) => spokenName(n, repeated)
  const payWord = (n: CatNode) => (ancestors(n)[0] ?? n).cat.name === 'Income' ? 'Pay' : 'Due'
  /** Open Edit-menu dialog (0009 §4). */
  const [dlg, setDlg] = useState<Dlg | null>(null)
  /** Open highlight dialog (0009 §3): a row with its children, or one Day purchase. */
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
    // GRID: focus the table's first cell (e.g. after the last purchase in a list is deleted).
    const el = focusAfter.current === GRID ? gridRef.current?.querySelector<HTMLElement>('tbody button, tbody input, tbody select') : document.getElementById(focusAfter.current)
    // A renamed row gets a new id only after the reload renders it, so wait a few renders for it.
    if (!el && ++focusTries.current < 4) return
    el?.focus()
    focusAfter.current = null
    focusTries.current = 0
  })

  // Day: each purchase is its own row under its item (0007 §9.1).
  const purchasesOf = (n: CatNode) => range === 'day'
    ? items.filter(i => i.categoryId === n.cat.id && i.date === periods[0].from).sort((a, b) => a.createdAt - b.createdAt)
    : []
  const purchaseLabel = (i: BudgetItem) =>
    `${isReturn(i) ? 'Return' : 'Purchase'}, ${new Date(i.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  /** A Day purchase's name opens its Edit dialog; an imported undated one also carries a tooltip (`describedBy`). */
  const nameButton = (n: CatNode, i: BudgetItem, describedBy?: string) => (
    <button type="button" className="name-link" id={`${editId(n, i)}-name`.replace('edit_purchase', 'name_purchase')} aria-haspopup="dialog"
      aria-label={`${purchaseLabel(i)}, ${say(n)}, ${purchaseAmount(i)}${i.description ? `, ${i.description}` : ''}`}
      aria-describedby={[purchaseRowId(n, i), describedBy].filter(Boolean).join(' ')} onClick={() => act(n, 'editPurchase', i)}>
      {purchaseLabel(i)}{describedBy && <span className="tip-mark" aria-hidden="true">i</span>}
    </button>
  )
  const editId = (n: CatNode, i: BudgetItem) => [highlight ? 'hl_edit_purchase' : 'edit_purchase', n.parent && slug(n.parent.cat.name), slug(n.cat.name), i.id].filter(Boolean).join('-')
  /** Row header ids: every control in a row is described by its row header (digital_accessibility.md, Tables). */
  const rowId = (n: CatNode) => did(`${idBase}_row`, n)
  const purchaseRowId = (n: CatNode, i: BudgetItem) => editId(n, i).replace('edit_purchase', `${idBase}_row_purchase`)

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
  /** Date for a value added from Week/Month: today if it's in range, else the range's last day. */
  const addDate = todayIso >= span.from && todayIso <= span.to ? todayIso : span.to

  /** Edit menu for a Day, Week or Month category row (0009 §4). Delete: Day and Week only. */
  function menuActions(n: CatNode): MenuAction<Act>[] {
    const list: MenuAction<Act>[] = []
    const item = (value: Act, label: string) => list.push({ value, label, id: did(`edit_${value}`, n) })
    if (!isTotal(n) && n.cat.name !== 'Net Income') item(range === 'day' ? 'new' : 'adjust', range === 'day' ? 'New purchase' : 'Add/Subtract')
    if (n.parent) item('rename', 'Rename')
    if (n.parent && range !== 'month') item('delete', 'Delete')
    return list
  }
  function act(n: CatNode, a: Act, purchase?: BudgetItem) {
    if (a === 'delete' && !purchase) {
      const why = n.children.length ? 'delete its items first'
        : items.filter(i => i.categoryId === n.cat.id).length > 1 ? 'it has more than one purchase; delete them in the Day table first' : ''
      if (why) { setNotice(`${say(n)} can’t be deleted yet: ${why}.`); return }
    }
    setError(''); setNotice('')
    setDlg({ act: a, n, purchase })
  }

  /** Where a row may be moved by Rename: its parent's level (0009 §4). Computed roots are left out. */
  function parentChoices(n: CatNode): { id: number; label: string }[] {
    const here = n.parent!
    const roots = tree
    if (n.depth === 1) return roots.filter(r => !r.cat.computed || r === here).map(r => ({ id: r.cat.id, label: r.cat.name }))
    return roots.filter(r => !r.cat.computed || r === here.parent)
      .flatMap(r => r.children.map(c => ({ id: c.cat.id, label: `${r.cat.name} › ${c.cat.name}` })))
  }

  /** Dialog rename, with a move when the Category select changed. */
  async function saveRename(n: CatNode, name: string, parentId: number): Promise<SaveResult> {
    if (isSyncBusy()) return SYNC_BUSY
    let move: { parentId: number; recolor: { id: number; color: string }[] } | undefined
    const dest = flatten(tree).find(x => x.cat.id === parentId)!
    if (parentId !== n.parent!.cat.id) {
      const moved = { ...n, parent: dest }
      move = { parentId, recolor: [{ id: n.cat.id, color: childColor(dest) }, ...n.children.map(c => ({ id: c.cat.id, color: childColor(moved) }))] }
    }
    let charity = 0
    try {
      charity = await categoryRepo.rename(n.cat.id, name, move)
    } catch (err) {
      if (err instanceof NameTakenError) return `Invalid: Name ${err.message}`
      if (err instanceof RowInUseError) { setDlg(null); setError(`Error: ${n.cat.name} wasn’t renamed because ${err.message}`); onChanged?.(); return }
      return `Error: ${n.cat.name} wasn’t renamed. Try again.`
    }
    setDlg(null)
    // Open the rows above the moved item so it shows (and can take focus).
    if (move) openRows([...ancestors(dest).map(a => a.cat.id), dest.cat.id])
    setStatus(`${move ? `Renamed ${say(n)} to ${name} and moved it to ${dest.cat.name}.` : `Renamed ${say(n)} to ${name}.`}${charity ? ` Your ${charity} Charity purchase${charity === 1 ? '' : 's'} moved to Charity › Miscellaneous.` : ''}`)
    const field = range === 'annual' ? 'rename' : 'edit'
    focusAfter.current = [highlight ? `hl_${field}` : field, slug(dest.cat.name), slug(name), n.cat.id].join('-')
    onChanged?.()
  }

  /** Dialog Add/Subtract, New purchase and a purchase's Edit (0009 §4.1). */
  async function saveAmount(d: Dlg, amount: number, description: string, date: string): Promise<SaveResult> {
    const { n } = d
    if (isSyncBusy()) return SYNC_BUSY
    try {
      await budgetItemRepo.add({ categoryId: n.cat.id, amount, date, ...(description ? { description } : {}) })
    } catch {
      return `Error: The amount for ${n.cat.name} wasn’t saved. Try again.`
    }
    const text = formatAmount(amount) || '0.00'
    setDlg(null)
    setStatus(d.act === 'new' ? `Added a ${say(n)} purchase of ${text} on ${date}.` : `Added ${text} to ${say(n)} on ${date}.`)
    focusAfter.current = did('edit', n)
    onChanged?.()
    fireReward()
  }

  /** Day purchase dialog Save: the old record is removed and a new one added (all or nothing). A name clash is thrown to the dialog. */
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
    setStatus(`Saved the ${p.kind === 'existing' ? say(target) : p.name} purchase of ${text}.${charity ? ` Your ${charity} Charity purchase${charity === 1 ? '' : 's'} moved to Charity › Miscellaneous.` : ''}`)
    // The purchase is a new record, maybe under another item: focus the item it was on.
    focusAfter.current = did('edit', n)
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

  /** Annual: the name's pencil button opens the same Rename dialog as the other tables (0012 G9). */
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

  /** Edit cell for a Day, Week or Month category row (0009 §4); Annual edits names in the name cell. */
  function editMenu(n: CatNode): ReactNode {
    const list = menuActions(n)
    return list.length > 0 && <ActionsMenu id={did('edit', n)} label={`Edit ${say(n)}`} describedBy={rowId(n)} buttonLabel="Edit" items={list} onSelect={k => act(n, k)} />
  }
  function rowActions(n: CatNode): ReactNode {
    return <>{actionCol && <td className="row-actions">{editMenu(n)}</td>}{moveCol && moveCell(n)}</>
  }

  const pathLabel = (d: CatNode) => d.parent ? `${d.parent.cat.name} › ${d.cat.name}` : d.cat.name
  /** Where Move to may put a row: any category or subcategory but its own parent, itself and its subcategories (v0.7 step 11). */
  function moveChoices(n: CatNode): MenuAction[] {
    return flatten(tree)
      .filter(d => d.depth <= 1 && d.cat.name !== 'Net Income' && d.cat.id !== n.cat.id && d.cat.id !== n.parent?.cat.id && d.parent?.cat.id !== n.cat.id)
      .map(d => ({ value: String(d.cat.id), label: pathLabel(d), id: `${did('move_to', n)}-${d.cat.id}` }))
  }
  /** Shown rows a row can swap with: its siblings in this highlight (none for the highlighted row itself). */
  const shownSiblings = (n: CatNode) => n.parent && n.depth > base ? n.parent.children.filter(hasAmount) : []
  function report(msg: string) { setStatus(msg); announce(msg) }
  function moveFailed(n: CatNode, err: unknown) {
    setStatus('')
    setError(err instanceof RowInUseError ? `Error: ${n.cat.name} wasn’t moved because ${err.message}` : `Error: ${n.cat.name} wasn’t moved. Try again.`)
    onChanged?.()
  }

  /** Up or Down: swap with the next shown sibling; saved at once (v0.7 step 11). */
  async function reorder(n: CatNode, delta: -1 | 1) {
    const sibs = shownSiblings(n)
    const j = sibs.indexOf(n) + delta
    if (j < 0 || j >= sibs.length) return
    setError(''); setNotice('')
    if (isSyncBusy()) { setError(SYNC_BUSY); return }
    try {
      await categoryRepo.reorder(n.cat.id, sibs[j].cat.id, delta > 0)
    } catch (err) { moveFailed(n, err); return }
    report(`Moved ${say(n)} ${delta < 0 ? 'up' : 'down'}.`)
    focusAfter.current = did(delta < 0 ? 'move_up' : 'move_down', n)
    onChanged?.()
  }

  /** Move to: the row becomes the last child of the chosen category (a subcategory) or subcategory (an item); saved at once (v0.7 step 11). */
  async function moveTo(n: CatNode, destId: number) {
    const dest = flatten(tree).find(x => x.cat.id === destId)
    if (!dest) return
    setError(''); setNotice('')
    if (isSyncBusy()) { setError(SYNC_BUSY); return }
    const kids = n.children.length
    if (dest.depth === 1 && kids) {
      setStatus('')
      setError(`Error: ${say(n)} has ${kids} item${kids === 1 ? '' : 's'}, so it cannot go inside another subcategory. Move its items out first.`)
      return
    }
    const moved = { ...n, parent: dest }
    const recolor = [{ id: n.cat.id, color: childColor(dest) }, ...n.children.map(c => ({ id: c.cat.id, color: childColor(moved) }))]
    let charity = 0, movedFrom: string | undefined
    try {
      ;({ charity, movedFrom } = await categoryRepo.moveTo(n.cat.id, destId, recolor))
    } catch (err) {
      if (err instanceof NameTakenError) { setStatus(''); setError(`Invalid: Move to for ${say(n)}: ${err.message}. Rename one of them first.`); return }
      moveFailed(n, err); return
    }
    report(`Moved ${say(n)} to ${pathLabel(dest)} as ${dest.depth === 0 ? 'a subcategory' : 'an item'}.${movedFrom ? ` ${movedFrom}’s own amounts moved to ${movedFrom} › Miscellaneous.` : ''}${charity ? ` Your ${charity} Charity purchase${charity === 1 ? '' : 's'} moved to Charity › Miscellaneous.` : ''}`)
    // The main table opens the rows above the moved row so it shows when the highlight closes (saved expand state).
    onMoved?.([...ancestors(dest).map(a => a.cat.id), dest.cat.id])
    // Focus stays on the moved row's Move to button when it is still in this highlight; otherwise on the highlighted row's.
    const top = roots[0]
    const stays = top.cat.id === n.cat.id || flatten([top]).some(x => x.cat.id === destId)
    focusAfter.current = stays ? ['hl_move_to', slug(dest.cat.name), slug(n.cat.name), n.cat.id].join('-') : top.parent ? did('move_to', top) : GRID
    onChanged?.()
  }

  /** The Move cell: Up and Down (rows under the highlighted one), then Move to (v0.7 step 11). */
  function moveCell(n: CatNode): ReactNode {
    if (!n.parent) return <td className="row-actions" />
    const sibs = shownSiblings(n)
    const i = sibs.indexOf(n)
    const choices = moveChoices(n)
    return (
      <td className="row-actions">
        <span className="reorder move-controls">
          {sibs.length > 0 && <>
            <Button type="button" className="secondary small" id={did('move_up', n)} aria-label={`Move ${say(n)} up`} aria-describedby={rowId(n)}
              aria-disabled={i === 0 || undefined} onClick={() => reorder(n, -1)}><span aria-hidden="true">↑</span></Button>
            <Button type="button" className="secondary small" id={did('move_down', n)} aria-label={`Move ${say(n)} down`} aria-describedby={rowId(n)}
              aria-disabled={i === sibs.length - 1 || undefined} onClick={() => reorder(n, 1)}><span aria-hidden="true">↓</span></Button>
          </>}
          {choices.length > 0 && <span className="move-menu"><ActionsMenu id={did('move_to', n)} label={`Move ${say(n)} to`} describedBy={rowId(n)} buttonLabel="Move to" floating
            items={choices} onSelect={k => moveTo(n, Number(k))} /></span>}
        </span>
      </td>
    )
  }
  const purchaseEdit = (n: CatNode, i: BudgetItem) => (
    <Button type="button" className="secondary small" id={editId(n, i)}
      aria-label={`Edit ${say(n)} ${purchaseNoun(i)}, ${purchaseLabel(i).split(', ')[1]}${i.description ? `, ${i.description}` : ''}`} aria-describedby={purchaseRowId(n, i)} onClick={() => act(n, 'editPurchase', i)}>Edit</Button>
  )

  const values = (n: CatNode, p: Period) => ({ est: estimateTotal(n, p), act: actualFor(n, p, items) })
  const hasAmount = (n: CatNode) =>
    periods.some(p => { const v = values(n, p); return v.act !== 0 || (showEstimates && v.est !== 0) })

  /** Week, Month and Annual: a solid border starts each period, Total included (0008 §4). */
  const start = range === 'day' ? '' : ' period-start'
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
  /** A row expands when it has rows under it: child rows with amounts, or (Day) its purchases. */
  const expandable = (n: CatNode) => n.children.some(hasAmount) || purchasesOf(n).length > 0
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
            {(() => {
              if (plain) return <span>{label}</span>
              return (
                <>
                  {expandable(n) && <Chevron open={open} onToggle={() => toggle(n.cat.id)} id={did('expand', n)} label={say(n)} describedBy={rowId(n)} />}
                  <button type="button" className="name-link" id={did('name', n)} aria-haspopup="dialog"
                    aria-label={say(n) === label ? undefined : say(n)} aria-describedby={rowId(n)}
                    onClick={() => setHl({ id: n.cat.id })}>{label}</button>
                </>
              )
            })()}
            {renameControls(n)}
            {editInName && editMenu(n)}
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
    const bought = purchasesOf(n)
    bought.forEach(i => {
      rows.push(
        <tr key={`p${i.id}`} className={`row purchase depth-${n.depth + 1 - base}`} {...(plain ? {} : { "aria-level": n.depth + 2 })}>
          <th scope="row" id={purchaseRowId(n, i)} className="name">
            <span className="name-line">
              {plain ? purchaseLabel(i) : i.undated
                ? <Tip text={UNDATED_NOTE}>{tip => nameButton(n, i, tip)}</Tip>
                : nameButton(n, i)}
              {editInName && purchaseEdit(n, i)}
            </span>
            {i.description && <span className="row-description">{i.description}</span>}
            {plain && i.undated && <span className="row-description">{UNDATED_NOTE}</span>}
          </th>
          <td className={`num${isReturn(i) ? ' neg' : ''}`}>{purchaseAmount(i)}</td>
          {actionCol && (
            <td className="row-actions">{purchaseEdit(n, i)}</td>
          )}
          {moveCol && <td />}
        </tr>,
      )
    })
    kids.forEach(addRow)
  }
  for (const r of roots) {
    if (r.cat.name !== 'Net Income') { addRow(r); continue }
    if (periods.some(p => { const v = netIncome(p); return v.act !== 0 || (showEstimates && v.est !== 0) })) {
      rows.push(
        <tr key={r.cat.id} className="row depth-0 net" {...(preview ? {} : { 'aria-level': 1 })}>
          <th scope="row" className={`name clr-${r.cat.color}`}>Net Income</th>
          {cells(netIncome)}
          {actionCol && <td />}
        </tr>,
      )
    }
  }

  const hlNode = hl ? flatten(roots).find(x => x.cat.id === hl.id) : undefined

  /** The highlight dialog (0009 §3): the row as this table shows it, with the same functions. A Day purchase opens its own dialog (Edit). */
  function highlightDialog(): ReactNode {
    if (!hlNode) return null
    const close = () => setHl(null)
    return (
      <Dialog id={`${idBase}-highlight`} title={hlNode.cat.name} className="highlight-dialog" onClose={close}
        buttons={<><span /><Button type="button" className="secondary" onClick={close}>Close</Button></>}>
        <p className="help">{hlNode.children.length || (range === 'day' && purchasesOf(hlNode).length) ? `${say(hlNode)} and the rows under it.` : `${say(hlNode)} has nothing under it.`}</p>
        <BudgetTable roots={[hlNode]} items={items} range={range} showEstimates={wantEstimates} calendar={calendar} date={date}
          idBase={`${idBase}-hl`} highlight allRoots={tree} onChanged={onChanged} onMoved={openRows} />
      </Dialog>
    )
  }

  /** The open Edit-menu dialog (0009 §4). */
  function editDialog(d: Dlg): ReactNode {
    const { n, purchase } = d
    const id = `${idBase}-edit_${d.act}`
    const close = () => setDlg(null)
    switch (d.act) {
      case 'rename':
        return <RenameDialog id={id} spoken={say(n)} name={n.cat.name} parentId={n.parent!.cat.id} parents={parentChoices(n)}
          level={n.depth === 1 ? 'Category' : 'Subcategory'} onSave={(name, parent) => saveRename(n, name, parent)} onCancel={close} />
      case 'new':
        return <AmountDialog id={id} title={`New purchase for ${say(n)}`} spoken={say(n)} withDescription dateField={{ initial: addDate, min: span.from, max: span.to }}
          intro={`Adds a purchase to ${say(n)}. Use a minus sign for a refund, or type a sum, e.g. 12.50+3.`}
          onSave={(amount, description, date) => saveAmount(d, amount, description, date || addDate)} onCancel={close} />
      case 'adjust':
        return <AmountDialog id={id} title={`Add or subtract for ${say(n)}`} spoken={say(n)} dateField={{ initial: addDate, min: span.from, max: span.to }}
          intro={`Adds to or subtracts from the ${say(n)} total as a new amount on the date below, within ${title}. Use a minus sign to subtract, e.g. -12.50, or type a sum, e.g. 12.50+3.`}
          onSave={(amount, description, date) => saveAmount(d, amount, description, date || addDate)} onCancel={close} />
      case 'editPurchase':
        return <PurchaseDialog id={id} title={`${purchaseLabel(purchase!)}, ${say(n)}`} roots={tree} node={n} purchase={purchase!}
          onSave={p => savePurchase(purchase!, n, p) as Promise<string | void>}
          onDelete={() => setDlg({ act: 'delete', n, purchase })} onCancel={close} />
      case 'delete': {
        const confirmDelete = purchase
          ? () => { const bought = purchasesOf(n); const k = bought.indexOf(purchase)
            removePurchase(n, purchase, bought[k + 1] ? editId(n, bought[k + 1]) : bought[k - 1] ? editId(n, bought[k - 1]) : GRID) }
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
        <table className={`table budget-table${range === 'day' ? ' day-table' : ''}`} aria-labelledby={highlight ? `${idBase}-caption` : `${idBase}-heading ${idBase}-caption`}
          ref={gridRef} role={plain ? undefined : 'treegrid'}>
          <caption id={`${idBase}-caption`}>{title}</caption>
          <thead>
            {range !== 'day' && range !== 'annual' && showEstimates && (
              <tr>
                <td />
                {periods.map(p => <th key={p.label} scope="colgroup" className={start.trim()} colSpan={colSpan} aria-label={p.fullLabel}>{p.label}</th>)}
                {actionCol && <td />}
                {moveCol && <td />}
              </tr>
            )}
            <tr>
              <th scope="col" className="name">Item</th>
              {range === 'annual' || (range !== 'day' && !showEstimates)
                // One value per period (Annual, or estimates hidden): each period heads its own column (0007 §10).
                ? periods.map(p => <th key={p.label} scope="col" className={`num${start}`} aria-label={p.fullLabel}>{p.label}</th>)
                : periods.map(p => (
                  <Fragment key={p.label}>
                    {showEstimates && <th scope="col" className={`num${start}`}><span aria-hidden="true">Est.</span><span className="sr-only">Estimated</span></th>}
                    <th scope="col" className={`num${showEstimates ? '' : start}`}><span aria-hidden="true">Act.</span><span className="sr-only">Actual</span></th>
                  </Fragment>
                ))}
              {actionCol && <th scope="col" className="name">Edit</th>}
              {moveCol && <th scope="col" className="name">Move</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows : <tr aria-level={1}><td className="empty" colSpan={1 + periods.length * colSpan + (actionCol ? 1 : 0) + (moveCol ? 1 : 0)}>Nothing recorded for this range yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {notice && <Banner kind="info" title={notice} />}
      {actions && <p className="status">{status}</p>}
      {highlightDialog()}
      {dlg && editDialog(dlg)}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
