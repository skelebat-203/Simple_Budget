import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { BudgetItem, Range } from '../storage/db'
import { actualFor, ancestors, childColor, domId, flatten, estimateTotal, isoDate, formatAmount, isTotal, periodsFor, rangeHasEstimates, repeatedNames, scheduleText, spokenName, type Calendar, type CatNode, type Period } from '../budget/tree'
import { cleanName, NAME_MAX, slug } from '../budget/validate'
import { budgetItemRepo, categoryRepo, NameTakenError, RowInUseError } from '../storage/repository'
import { AmountDialog, Button, ConfirmDialog, DescriptionDialog, RenameDialog, type SaveResult } from './ui'
import { useCollapsed } from './ui/useCollapsed'
import { fireReward } from '../rewards/rewards'
import { useAnnounce } from './ui/announcer'
import { Expander } from './ui/Expander'
import { ActionsMenu, type MenuAction } from './ui/ActionsMenu'

/** Annual rename: the pencil button opens the name's inline form (§9.3, v0.4 step 8). */
type Kind = 'rename'

/** Edit-menu actions (0009 §4): each opens a dialog. 'new' is Day's New purchase, 'adjust' is Add/Subtract on an item's total, 'replace' is Add/Subtract on a purchase. */
type Act = 'rename' | 'new' | 'adjust' | 'replace' | 'description' | 'delete'
type Dlg = { act: Act; n: CatNode; purchase?: BudgetItem }

const GRID = '__grid__'

/**
 * Budget table per docs/design/0004-table-design.md: tree order, indents
 * 0/1/2, category colors, computed rows, only rows with an amount, and
 * expand/collapse state kept across range changes and restarts.
 */
export function BudgetTable({ roots, items, range, showEstimates: wantEstimates, calendar, date, idBase = 'budget', preview = false, onChanged }: {
  roots: CatNode[]
  /** A day in the range to show (0007 §9.5 date nav). Default: today. */
  date?: Date
  /** Data changed from a table action (0007 §9); reload. */
  onChanged?: () => void
  /** Prefix for this table's ids; the heading it's named by is `{idBase}-heading`. */
  idBase?: string
  /** Read-only preview (0007 §5.4): every row expanded, no expand/collapse buttons. */
  preview?: boolean
  calendar: Calendar
  items: BudgetItem[]
  range: Range
  showEstimates: boolean
}) {
  const showEstimates = wantEstimates && rangeHasEstimates(range)
  const [collapsed, toggle] = useCollapsed()
  const gridRef = useRef<HTMLTableElement>(null)
  const [today] = useState(() => new Date())
  const { columns, total, title } = periodsFor(range, date ?? today, calendar)
  const periods = total ? [...columns, total] : columns

  const actions = !preview && !!onChanged
  /** Annual edits names in the name cell, so it has no Actions column (0007 §10). */
  const actionCol = actions && range !== 'annual'
  const repeated = repeatedNames(roots)
  const say = (n: CatNode) => spokenName(n, repeated)
  const payWord = (n: CatNode) => (ancestors(n)[0] ?? n).cat.name === 'Income' ? 'Pay' : 'Due'
  /** Annual's inline rename (the only row form left; everything else is a dialog). */
  const [rowEdit, setRowEdit] = useState<{ id: number; kind: Kind } | null>(null)
  /** Open Edit-menu dialog (0009 §4). */
  const [dlg, setDlg] = useState<Dlg | null>(null)
  const [value, setValue] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  useAnnounce(status)
  useAnnounce(error)
  /** Rename waiting on the confirm dialog (all ranges, v0.4 step 8 + review). */
  const [pending, setPending] = useState<{ n: CatNode; name: string } | null>(null)
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
    `Purchase, ${new Date(i.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
  const editId = (n: CatNode, i: BudgetItem) => ['edit_purchase', n.parent && slug(n.parent.cat.name), slug(n.cat.name), i.id].filter(Boolean).join('-')

  async function removePurchase(n: CatNode, i: BudgetItem, next: string): Promise<SaveResult> {
    try {
      await budgetItemRepo.remove(i.id!)
    } catch {
      return `Error: The ${n.cat.name} purchase wasn’t deleted. Try again.`
    }
    setDlg(null)
    setStatus(`Deleted the ${say(n)} purchase of ${formatAmount(i.amount) || '0.00'}.`)
    focusAfter.current = next
    onChanged?.()
  }

  const span = total ?? columns[0]
  const todayIso = isoDate(today)
  /** Date for a value added from Week/Month: today if it's in range, else the range's last day. */
  const addDate = todayIso >= span.from && todayIso <= span.to ? todayIso : span.to

  function openRow(n: CatNode, kind: Kind) {
    setRowEdit({ id: n.cat.id, kind }); setValue(n.cat.name); setFieldError(''); setError('')
    focusAfter.current = domId('rename_value', n)
  }
  function closeRow(n: CatNode) {
    setRowEdit(null); setFieldError('')
    focusAfter.current = domId('rename', n)
  }

  /** Edit menu for a Day, Week or Month category row (0009 §4). Delete: Day and Week only. */
  function menuActions(n: CatNode): MenuAction<Act>[] {
    const list: MenuAction<Act>[] = []
    const item = (value: Act, label: string) => list.push({ value, label, id: domId(`edit_${value}`, n) })
    if (!isTotal(n) && n.cat.name !== 'Net Income') item(range === 'day' ? 'new' : 'adjust', range === 'day' ? 'New purchase' : 'Add/Subtract')
    if (n.parent) item('rename', 'Rename')
    if (n.parent && range !== 'month') item('delete', 'Delete')
    return list
  }
  /** Edit menu for a purchase row (Day): Description, Add/Subtract, Delete. */
  function purchaseActions(n: CatNode, i: BudgetItem): MenuAction<Act>[] {
    return (['description', 'replace', 'delete'] as const).map(value => ({
      value, label: value === 'description' ? 'Description' : value === 'replace' ? 'Add/Subtract' : 'Delete',
      id: [`edit_purchase_${value}`, n.parent && slug(n.parent.cat.name), slug(n.cat.name), i.id].filter(Boolean).join('-'),
    }))
  }
  function act(n: CatNode, a: Act, purchase?: BudgetItem) {
    if (a === 'delete' && !purchase) {
      const why = n.children.length ? 'delete its items first'
        : items.filter(i => i.categoryId === n.cat.id).length > 1 ? 'it has more than one purchase; delete them in the Day table first' : ''
      if (why) { setStatus(`${say(n)} can’t be deleted yet: ${why}.`); return }
    }
    setError('')
    setDlg({ act: a, n, purchase })
  }

  /** Where a row may be moved by Rename: its parent's level (0009 §4). Computed roots are left out. */
  function parentChoices(n: CatNode): { id: number; label: string }[] {
    const here = n.parent!
    if (n.depth === 1) return roots.filter(r => !r.cat.computed || r === here).map(r => ({ id: r.cat.id, label: r.cat.name }))
    return roots.filter(r => !r.cat.computed || r === here.parent)
      .flatMap(r => r.children.map(c => ({ id: c.cat.id, label: `${r.cat.name} › ${c.cat.name}` })))
  }

  /** Dialog rename, with a move when the Category select changed. */
  async function saveRename(n: CatNode, name: string, parentId: number): Promise<SaveResult> {
    let move: { parentId: number; recolor: { id: number; color: string }[] } | undefined
    const dest = flatten(roots).find(x => x.cat.id === parentId)!
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
    setStatus(`${move ? `Renamed ${say(n)} to ${name} and moved it to ${dest.cat.name}.` : `Renamed ${say(n)} to ${name}.`}${charity ? ` Your ${charity} Charity purchase${charity === 1 ? '' : 's'} moved to Charity › Miscellaneous.` : ''}`)
    focusAfter.current = ['edit', slug(dest.cat.name), slug(name), n.cat.id].join('-')
    onChanged?.()
  }

  async function rename(n: CatNode) {
    const name = cleanName(value)
    const fail = (msg: string) => { setFieldError(msg); focusAfter.current = domId('rename_value', n) }
    if (!name) return fail(`Error: Name for ${say(n)} cannot be empty`)
    if (n.parent!.children.some(c => c !== n && slug(c.cat.name) === slug(name))) return fail(`Invalid: Name “${name}” already exists in ${n.parent!.cat.name}`)
    if (name === n.cat.name) return closeRow(n)
    // Ask first: the name changes everywhere (v0.4 step 8; Annual too, v0.4 review).
    setPending({ n, name })
  }

  async function commitRename(n: CatNode, name: string) {
    setPending(null)
    try {
      await categoryRepo.rename(n.cat.id, name)
    } catch (err) {
      if (err instanceof NameTakenError) {
        // A sibling got this name after the check (another tab): keep the form open on the field.
        setFieldError(`Invalid: Name ${err.message}`)
        focusAfter.current = domId('rename_value', n)
      } else if (err instanceof RowInUseError) {
        setError(`Error: ${n.cat.name} wasn’t renamed because ${err.message}`)
        closeRow(n)
        onChanged?.()
      } else {
        setError(`Error: ${n.cat.name} wasn’t renamed. Try again.`)
        focusAfter.current = domId('rename_value', n)
      }
      return
    }
    setStatus(`Renamed ${say(n)} to ${name}.`)
    closeRow(n)
    // The row's ids carry its name: focus the control under the new name.
    focusAfter.current = domId('rename', n).replace(`-${slug(n.cat.name)}-${n.cat.id}`, `-${slug(name)}-${n.cat.id}`)
    onChanged?.()
  }

  /** Dialog Add/Subtract and New purchase (0009 §4.1). */
  async function saveAmount(d: Dlg, amount: number, description: string): Promise<SaveResult> {
    const { n, purchase } = d
    try {
      if (d.act === 'replace') await budgetItemRepo.update(purchase!.id!, { amount })
      else await budgetItemRepo.add({ categoryId: n.cat.id, amount, date: addDate, ...(description ? { description } : {}) })
    } catch {
      return `Error: The amount for ${n.cat.name} wasn’t saved. Try again.`
    }
    const text = formatAmount(amount) || '0.00'
    setDlg(null)
    setStatus(d.act === 'replace' ? `Changed the ${say(n)} purchase to ${text}.`
      : d.act === 'new' ? `Added a ${say(n)} purchase of ${text} on ${addDate}.` : `Added ${text} to ${say(n)} on ${addDate}.`)
    focusAfter.current = purchase ? editId(n, purchase) : domId('edit', n)
    onChanged?.()
    if (d.act !== 'replace') fireReward()
  }

  async function saveDescription(n: CatNode, i: BudgetItem, description: string): Promise<SaveResult> {
    try {
      await budgetItemRepo.update(i.id!, { description: description || undefined })
    } catch {
      return `Error: The description for the ${n.cat.name} purchase wasn’t saved. Try again.`
    }
    setDlg(null)
    setStatus(description ? `Saved the description for the ${say(n)} purchase.` : `Removed the description from the ${say(n)} purchase.`)
    focusAfter.current = editId(n, i)
    onChanged?.()
  }

  async function deleteRow(n: CatNode) {
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

  /** Name cell: the rename form, or (Annual) the name's pencil Rename button (0007 §9.3, §10; Week/Month: v0.4 step 8). */
  function renameControls(n: CatNode): ReactNode {
    if (!actions || range !== 'annual' || !n.parent) return null
    const id = domId('rename_value', n)
    if (rowEdit?.id !== n.cat.id || rowEdit.kind !== 'rename') {
      return (
        <Button type="button" className="secondary icon" id={domId('rename', n)} aria-label={`Rename ${say(n)}`}
          onClick={() => openRow(n, 'rename')}>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </Button>
      )
    }
    return (
      <>
        <span className="inline-form">
          <label className="sr-only" htmlFor={id}>New name for {say(n)}</label>
          <input id={id} className="input" maxLength={NAME_MAX} value={value} autoComplete="off"
            aria-invalid={!!fieldError || undefined} aria-describedby={fieldError ? `${id}-error_msg` : undefined}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); rename(n) } else if (e.key === 'Escape') closeRow(n) }} />
          <Button type="button" className="small" onClick={() => rename(n)}>Save</Button>
          <Button type="button" className="secondary small" onClick={() => closeRow(n)}>Cancel</Button>
        </span>
        {fieldError && <p id={`${id}-error_msg`} className="error">{fieldError}</p>}
      </>
    )
  }

  /** Edit cell for a Day, Week or Month category row (0009 §4); Annual edits names in the name cell. */
  function rowActions(n: CatNode): ReactNode {
    if (!actions || range === 'annual') return null
    const list = menuActions(n)
    return (
      <td className="row-actions">
        {list.length > 0 && <ActionsMenu id={domId('edit', n)} label={`Edit ${say(n)}`} buttonLabel="Edit" items={list} onSelect={k => act(n, k)} />}
      </td>
    )
  }

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
  /** A row expands when it has rows under it: child rows with amounts, or (Day) its purchases. */
  const expandable = (n: CatNode) => n.children.some(hasAmount) || purchasesOf(n).length > 0
  function addRow(n: CatNode) {
    if (!hasAmount(n)) return
    const kids = n.children.filter(hasAmount)
    const open = preview || !collapsed.has(n.cat.id)
    const label = n.cat.name
    rows.push(
      <tr key={n.cat.id} className={`row depth-${n.depth}${n.children.length ? ' group' : ''}`}
        {...(preview ? {} : { 'data-id': n.cat.id, 'aria-level': n.depth + 1, 'aria-expanded': expandable(n) ? open : undefined })}>
        <th scope="row" className={`name clr-${n.cat.color}`}>
          <span className="name-line">
            {(() => {
              const renaming = rowEdit?.id === n.cat.id && rowEdit.kind === 'rename'
              if (renaming) return null
              return expandable(n) && !preview
                ? <Expander open={open} onToggle={() => toggle(n.cat.id)} id={domId('expand', n)}>{label}</Expander>
                : <span>{label}</span>
            })()}
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
    const bought = purchasesOf(n)
    bought.forEach(i => {
      rows.push(
        <tr key={`p${i.id}`} className={`row purchase depth-${n.depth + 1}`} {...(preview ? {} : { "aria-level": n.depth + 2 })}>
          <th scope="row" className="name">
            {purchaseLabel(i)}
            {i.description && <span className="row-description">{i.description}</span>}
          </th>
          <td className={`num${i.amount < 0 ? ' neg' : ''}`}>{formatAmount(i.amount) || '0.00'}</td>
          {actionCol && (
            <td className="row-actions">
              <ActionsMenu id={editId(n, i)} label={`Edit ${say(n)} purchase of ${formatAmount(i.amount) || '0.00'}`} buttonLabel="Edit"
                items={purchaseActions(n, i)} onSelect={a => act(n, a, i)} />
            </td>
          )}
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

  /** The open Edit-menu dialog (0009 §4). */
  function editDialog(d: Dlg): ReactNode {
    const { n, purchase } = d
    const id = `${idBase}-edit_${d.act}`
    const close = () => setDlg(null)
    const spoken = purchase ? `${say(n)} purchase` : say(n)
    switch (d.act) {
      case 'rename':
        return <RenameDialog id={id} spoken={say(n)} name={n.cat.name} parentId={n.parent!.cat.id} parents={parentChoices(n)}
          level={n.depth === 1 ? 'Category' : 'Subcategory'} onSave={(name, parent) => saveRename(n, name, parent)} onCancel={close} />
      case 'new':
        return <AmountDialog id={id} title={`New purchase for ${say(n)}`} spoken={say(n)} withDescription
          intro={`Adds a purchase to ${say(n)}, dated ${addDate}. Use a minus sign for a refund, or type a sum, e.g. 12.50+3.`}
          onSave={(amount, description) => saveAmount(d, amount, description)} onCancel={close} />
      case 'adjust':
        return <AmountDialog id={id} title={`Add or subtract for ${say(n)}`} spoken={say(n)}
          intro={`Adds to or subtracts from the ${say(n)} total as a new amount dated ${addDate}. Use a minus sign to subtract, e.g. -12.50, or type a sum, e.g. 12.50+3.`}
          onSave={(amount, description) => saveAmount(d, amount, description)} onCancel={close} />
      case 'replace':
        return <AmountDialog id={id} title={`Change ${spoken}`} spoken={spoken} initial={String(purchase!.amount)}
          intro="The amount you enter replaces this purchase’s amount. The date stays the same. Type a sum to work it out, e.g. 12.50+3."
          onSave={(amount, description) => saveAmount(d, amount, description)} onCancel={close} />
      case 'description':
        return <DescriptionDialog id={id} spoken={spoken} initial={purchase!.description ?? ''}
          onSave={text => saveDescription(n, purchase!, text)} onCancel={close} />
      case 'delete': {
        const confirmDelete = purchase
          ? () => { const bought = purchasesOf(n); const k = bought.indexOf(purchase)
            removePurchase(n, purchase, bought[k + 1] ? editId(n, bought[k + 1]) : bought[k - 1] ? editId(n, bought[k - 1]) : GRID) }
          : () => deleteRow(n)
        return (
          <ConfirmDialog id={id} title={purchase ? `Delete the ${say(n)} purchase?` : `Delete ${say(n)}?`} confirmLabel="Delete"
            onConfirm={confirmDelete} onCancel={close}>
            {purchase ? `This deletes the purchase of ${formatAmount(purchase.amount) || '0.00'}.` : `This deletes ${n.cat.name}${withOne(n)}.`}
          </ConfirmDialog>
        )
      }
    }
  }

  const colSpan = showEstimates ? 2 : 1
  return (
    <div className="table-wrap">
      {/* Only the table scrolls sideways; the help text below stays in the page width (v0.4 review). */}
      <div className="table-box">
        <table className={`table budget-table${range === 'day' ? ' day-table' : ''}`} aria-labelledby={`${idBase}-heading ${idBase}-caption`}
          aria-describedby={`${idBase}-key`} ref={gridRef} role={preview ? undefined : 'treegrid'}>
          <caption id={`${idBase}-caption`}>{title}</caption>
          <thead>
            {range !== 'day' && range !== 'annual' && showEstimates && (
              <tr>
                <td />
                {periods.map(p => <th key={p.label} scope="colgroup" className={start.trim()} colSpan={colSpan} aria-label={p.fullLabel}>{p.label}</th>)}
                {actionCol && <td />}
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
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows : <tr aria-level={1}><td className="empty" colSpan={1 + periods.length * colSpan + (actionCol ? 1 : 0)}>Nothing recorded for this range yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p id={`${idBase}-key`} className="help">Only rows with an amount appear. Every row totals the rows under it.{range === 'day' && ' Each purchase is listed under its item.'}</p>
      {actions && (range === 'week' || range === 'month') && (
        <p id={`${idBase}-add-help`} className="help">Add/Subtract records a new amount on that item, dated {addDate}. A row can be deleted when it has no items and at most one purchase{range === 'month' ? '; Delete is in the Week table' : ''}.</p>
      )}
      {actions && <p className="status">{status}</p>}
      {pending && (
        <ConfirmDialog id={`${idBase}-rename_confirm`} title={`Rename ${pending.n.cat.name}?`}
          onConfirm={() => commitRename(pending.n, pending.name)}
          onCancel={() => { setPending(null); closeRow(pending.n) }}>
          This will change the name of all instances of {pending.n.cat.name} to {pending.name} across the application.
        </ConfirmDialog>
      )}
      {dlg && editDialog(dlg)}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
