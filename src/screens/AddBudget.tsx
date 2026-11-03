import { useRef, useState } from 'react'
import { AmountInput, Button, DatePicker, ErrorSummary, focusFirstError, ItemSelector, type FieldError } from '../components/ui'
import { addNewItem, budgetItemRepo, NameTakenError } from '../storage/repository'
import { childColor, isoDate, type CatNode } from '../budget/tree'
import { cleanName, dateBounds, moneyError, parseMoney } from '../budget/validate'

const FIELDS = ['item', 'category', 'where', 'amount', 'date'] as const
type Errors = Partial<Record<typeof FIELDS[number], string>>

const toList = (e: Errors): FieldError[] => FIELDS.filter(k => e[k]).map(k => ({ fieldId: k, message: e[k]! }))

/** Color for a row under a new subcategory of `root` (0004 Colors). */
const itemColorUnder = (root: CatNode) =>
  childColor({ cat: { ...root.cat, id: -1, name: '' }, depth: 1, parent: root, children: [] })

/** Add purchase (0007 §4, §9): Item, Amount, Date; a typed new item adds Category, Where? and Use in future. */
export function AddBudget({ roots, onSaved }: {
  roots: CatNode[]
  onSaved: () => void
}) {
  const [target, setTarget] = useState<CatNode | null>(null)
  const [itemText, setItemText] = useState({ text: '', matches: 0 })
  const [category, setCategory] = useState<CatNode | null>(null)
  const [categoryText, setCategoryText] = useState({ text: '', matches: 0 })
  const [where, setWhere] = useState('')
  const [useInFuture, setUseInFuture] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => isoDate(new Date()))
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [formKey, setFormKey] = useState(0)
  const bannerRef = useRef<HTMLDivElement>(null)
  const [saveError, setSaveError] = useState('')
  const [bounds] = useState(() => dateBounds(new Date()))

  // A typed name that matches no item starts the new-item flow (§4.2).
  const isNew = !target && itemText.text.trim() !== '' && itemText.matches === 0
  const isNewSub = isNew && !category && categoryText.text.trim() !== '' && categoryText.matches === 0
  const groups = roots.filter(r => r.cat.computed && r.cat.name !== 'Net Income')

  function validate(): Errors {
    const e: Errors = {}
    if (!itemText.text.trim()) e.item = 'Error: Item cannot be empty'
    else if (!target && itemText.matches > 1) e.item = 'Invalid: Item pick one from the list; that name is used in more than one place'
    if (isNew && !category && !categoryText.text.trim()) e.category = 'Error: Category cannot be empty'
    if (isNewSub && !where) e.where = 'Error: Where? cannot be empty'
    // A number input reports '' for text it can't parse; tell that apart from empty (security-v0.2 3.3).
    const amountEl = document.getElementById('amount') as HTMLInputElement | null
    const amt = amountEl?.validity.badInput ? { ok: false as const, reason: 'format' as const } : parseMoney(amount, { allowNegative: true })
    if (!amt.ok) e.amount = moneyError('Amount', amt, '12.50 or -12.50')
    if (date === '') e.date = 'Error: Date cannot be empty'
    else if (date < bounds.min || date > bounds.max) e.date = `Invalid: Date use a date from ${bounds.min} to ${bounds.max}`
    return e
  }

  function reset() {
    setTarget(null); setItemText({ text: '', matches: 0 })
    setCategory(null); setCategoryText({ text: '', matches: 0 })
    setWhere(''); setUseInFuture(false); setAmount('')
    setFormKey(k => k + 1) // clears the Item and Category controls
  }

  async function save() {
    setStatus('')
    setSaveError('')
    const e = validate()
    setErrors(e)
    const list = toList(e)
    if (list.length) {
      // Wait for the banner to render before moving focus.
      requestAnimationFrame(() => focusFirstError(list, bannerRef.current))
      return
    }
    setSaving(true)
    const amt = parseMoney(amount, { allowNegative: true })
    const value = amt.ok ? amt.value : 0
    try {
      if (target) {
        await budgetItemRepo.add({ categoryId: target.cat.id, amount: value, date })
        setStatus(`Saved ${target.cat.name}.`)
      } else {
        const name = cleanName(itemText.text)
        const root = groups.find(g => g.cat.name === where)
        const moved = await addNewItem({
          name,
          parent: category
            ? { id: category.cat.id, name: category.cat.name }
            : { newSub: categoryText.text, root: { id: root!.cat.id, name: root!.cat.name }, color: childColor(root!) },
          color: category ? childColor(category) : itemColorUnder(root!),
          selected: useInFuture,
          amount: value,
          date,
        })
        setStatus(`Saved ${name}.` + (moved ? ` Your ${moved} estimate moved to ${moved} › Miscellaneous. ${moved} now totals its items.` : ''))
      }
      reset()
      onSaved()
    } catch (err) {
      if (err instanceof NameTakenError) {
        const field = category || !isNewSub ? 'item' : 'category'
        const next = { [field]: `Invalid: ${field === 'item' ? 'Item' : 'Category'} ${err.message}` }
        setErrors(next)
        requestAnimationFrame(() => focusFirstError(toList(next), bannerRef.current))
      } else {
        // Name and message only; never the record (security-v0.2 8.6).
        console.error('Save failed:', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown')
        setSaveError('Error: The item wasn’t saved. Check that your device has free storage space, then try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const describe = (id: keyof Errors, help?: string) =>
    [errors[id] && `${id}-error_msg`, help].filter(Boolean).join(' ') || undefined

  return (
    <section className="panel" aria-labelledby="add-heading">
      <h2 id="add-heading" className="section-title">Add purchase</h2>
      <ErrorSummary ref={bannerRef} errors={toList(errors)} />
      <div className="field">
        <label className="label" htmlFor="item">Item <span aria-hidden="true">*</span></label>
        <p id="item-help" className="help">Shows your selected items. Type to search every item, or type a new name to add it.</p>
        <ItemSelector key={`item-${formKey}`} id="item" label="Items" roots={roots}
          initial={n => !!n.cat.selected}
          onChange={setTarget} onText={(text, matches) => setItemText({ text, matches })}
          invalid={!!errors.item} describedBy={describe('item', 'item-help')} />
        {errors.item && <p id="item-error_msg" className="error">{errors.item}</p>}
      </div>
      {isNew && (
        <div className="field">
          <label className="label" htmlFor="category">Category <span aria-hidden="true">*</span></label>
          <p id="category-help" className="help">Where “{itemText.text.trim()}” belongs. Pick a subcategory, or type a new one.</p>
          <ItemSelector key={`category-${formKey}`} id="category" label="Categories" mode="category" roots={roots}
            onChange={setCategory} onText={(text, matches) => setCategoryText({ text, matches })}
            invalid={!!errors.category} describedBy={describe('category', 'category-help')} />
          {errors.category && <p id="category-error_msg" className="error">{errors.category}</p>}
        </div>
      )}
      {isNewSub && (
        <div className="field">
          <label className="label" htmlFor="where">Where? <span aria-hidden="true">*</span></label>
          <select id="where" className="input" value={where} aria-required="true" aria-invalid={!!errors.where || undefined}
            aria-describedby={describe('where')} onChange={e => setWhere(e.target.value)}>
            <option value="">Choose where “{categoryText.text.trim()}” goes</option>
            {groups.map(g => <option key={g.cat.id} value={g.cat.name}>{g.cat.name}</option>)}
          </select>
          {errors.where && <p id="where-error_msg" className="error">{errors.where}</p>}
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="amount">Amount <span aria-hidden="true">*</span></label>
        <p id="amount-help" className="help">Use a minus sign for a credit or refund, e.g. -12.50.</p>
        <AmountInput id="amount" value={amount} onChange={e => setAmount(e.target.value)} aria-required="true"
          aria-invalid={!!errors.amount || undefined} aria-describedby={describe('amount', 'amount-help')} />
        {errors.amount && <p id="amount-error_msg" className="error">{errors.amount}</p>}
      </div>
      <div className="field">
        <label className="label" htmlFor="date">Date</label>
        <DatePicker id="date" value={date} min={bounds.min} max={bounds.max} aria-invalid={!!errors.date || undefined}
          aria-describedby={describe('date')} onChange={e => setDate(e.target.value)} />
        {errors.date && <p id="date-error_msg" className="error">{errors.date}</p>}
      </div>
      <div className="actions actions-end">
        <p className="status" role="status">{status}</p>
        {isNew && (
          <label className="check">
            <input type="checkbox" id="use_in_future" checked={useInFuture} onChange={e => setUseInFuture(e.target.checked)} />
            Use in future
          </label>
        )}
        <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
      {saveError && <p className="error" role="alert">{saveError}</p>}
    </section>
  )
}
