import { useState, type ReactNode } from 'react'
import { AmountField, DatePicker, Input, ItemSelector, type FieldError } from './ui'
import { childColor, isoDate, type CatNode } from '../budget/tree'
import { cleanDescription, cleanName, DESCRIPTION_MAX, dateBounds, moneyError, parseAmount } from '../budget/validate'
import type { addNewItem } from '../storage/repository'

const FIELDS = ['item', 'category', 'where', 'amount', 'description', 'date'] as const
export type PurchaseErrors = Partial<Record<typeof FIELDS[number], string>>

/** Color for a row under a new subcategory of `root` (0004 Colors). */
const itemColorUnder = (root: CatNode) =>
  childColor({ cat: { ...root.cat, id: -1, name: '' }, depth: 1, parent: root, children: [] })

/** What the form asks the caller to store: a purchase on an existing item, or a new item with its first purchase. */
export type PurchaseSave =
  | { kind: 'existing'; target: CatNode; amount: number; date: string; description?: string }
  | { kind: 'new'; name: string; args: Parameters<typeof addNewItem>[0] }

/**
 * The Add purchase form's fields, state and checks (0007 §4), shared by the Add purchase tab and
 * the Day table's purchase dialog so both ask the same things. `init` prepopulates it; `prefix`
 * keeps ids unique when two copies are on the page. A typed name that matches no item starts the
 * new-item flow: Category, Where? and Use in future.
 */
export function usePurchaseForm(roots: CatNode[], init: { target?: CatNode; amount?: string; description?: string; date?: string } = {}, prefix = '') {
  const [target, setTarget] = useState<CatNode | null>(init.target ?? null)
  const [itemText, setItemText] = useState({ text: init.target ? init.target.cat.name : '', matches: init.target ? 1 : 0 })
  const [category, setCategory] = useState<CatNode | null>(null)
  const [categoryText, setCategoryText] = useState({ text: '', matches: 0 })
  const [where, setWhere] = useState('')
  const [useInFuture, setUseInFuture] = useState(false)
  const [amount, setAmount] = useState(init.amount ?? '')
  const [description, setDescription] = useState(init.description ?? '')
  const [date, setDate] = useState(() => init.date ?? isoDate(new Date()))
  const [errors, setErrors] = useState<PurchaseErrors>({})
  const [formKey, setFormKey] = useState(0)
  const [bounds] = useState(() => dateBounds(new Date()))
  const id = (name: string) => `${prefix}${name}`

  const isNew = !target && itemText.text.trim() !== '' && itemText.matches === 0
  const isNewSub = isNew && !category && categoryText.text.trim() !== '' && categoryText.matches === 0
  const groups = roots.filter(r => r.cat.computed && r.cat.name !== 'Net Income')

  const toList = (e: PurchaseErrors): FieldError[] => FIELDS.filter(k => e[k]).map(k => ({ fieldId: id(k), message: e[k]! }))

  function check(): PurchaseErrors {
    const e: PurchaseErrors = {}
    if (!itemText.text.trim()) e.item = 'Error: Item cannot be empty'
    else if (!target && itemText.matches > 1) e.item = 'Invalid: Item pick one from the list; that name is used in more than one place'
    if (isNew && !category && !categoryText.text.trim()) e.category = 'Error: Category cannot be empty'
    if (isNewSub && !where) e.where = 'Error: Where? cannot be empty'
    const amt = parseAmount(amount, { allowNegative: true })
    if (!amt.ok) e.amount = moneyError('Amount', amt, '12.50, 12.50+3 or -12.50')
    if (date === '') e.date = 'Error: Date cannot be empty'
    else if (date < bounds.min || date > bounds.max) e.date = `Invalid: Date use a date from ${bounds.min} to ${bounds.max}`
    return e
  }

  /** Run the checks, show the errors, and return them (empty when the form is good). */
  function validate(): FieldError[] {
    const e = check()
    setErrors(e)
    return toList(e)
  }

  /** The values to store. Call after validate() found no errors. */
  function build(): PurchaseSave {
    const amt = parseAmount(amount, { allowNegative: true })
    const value = amt.ok ? amt.value : 0
    const note = cleanDescription(description) || undefined
    if (target) return { kind: 'existing', target, amount: value, date, description: note }
    const name = cleanName(itemText.text)
    const root = groups.find(g => g.cat.name === where)
    return {
      kind: 'new', name,
      args: {
        name,
        parent: category
          ? { id: category.cat.id, name: category.cat.name }
          : { newSub: categoryText.text, root: { id: root!.cat.id, name: root!.cat.name }, color: childColor(root!) },
        color: category ? childColor(category) : itemColorUnder(root!),
        selected: useInFuture,
        amount: value, date, description: note,
      },
    }
  }

  /** A name clash found while storing: show it on the field it belongs to; returns the errors for focusing. */
  function nameTaken(message: string): FieldError[] {
    const field = category || !isNewSub ? 'item' : 'category'
    const next = { [field]: `Invalid: ${field === 'item' ? 'Item' : 'Category'} ${message}` }
    setErrors(next)
    return toList(next)
  }

  function reset() {
    setTarget(null); setItemText({ text: '', matches: 0 })
    setCategory(null); setCategoryText({ text: '', matches: 0 })
    setWhere(''); setUseInFuture(false); setAmount(''); setDescription('')
    setFormKey(k => k + 1) // clears the Item and Category controls
  }

  const describe = (name: keyof PurchaseErrors, help?: string) =>
    [errors[name] && `${id(name)}-error_msg`, help].filter(Boolean).join(' ') || undefined

  const fields: ReactNode = (
    // Two columns from 1280px; fields keep their DOM (reading and tab) order (0007 §10).
    <div className="form-grid">
      <div className="field">
        <label className="label" htmlFor={id('item')}>Item <span aria-hidden="true">*</span></label>
        <p id={id('item-help')} className="help">Shows your selected items. Type to search every item, or type a new name to add it.</p>
        <ItemSelector key={`item-${formKey}`} id={id('item')} label="Items" roots={roots}
          initial={n => !!n.cat.selected} defaultTarget={init.target}
          onChange={setTarget} onText={(text, matches) => setItemText({ text, matches })}
          invalid={!!errors.item} describedBy={describe('item', id('item-help'))} />
        {errors.item && <p id={id('item-error_msg')} className="error">{errors.item}</p>}
      </div>
      {isNew && (
        <div className="field">
          <label className="label" htmlFor={id('category')}>Category <span aria-hidden="true">*</span></label>
          <p id={id('category-help')} className="help">Where “{itemText.text.trim()}” belongs. Pick a subcategory, or type a new one.</p>
          <ItemSelector key={`category-${formKey}`} id={id('category')} label="Categories" mode="category" roots={roots}
            onChange={setCategory} onText={(text, matches) => setCategoryText({ text, matches })}
            invalid={!!errors.category} describedBy={describe('category', id('category-help'))} />
          {errors.category && <p id={id('category-error_msg')} className="error">{errors.category}</p>}
        </div>
      )}
      {isNewSub && (
        <div className="field">
          <label className="label" htmlFor={id('where')}>Where? <span aria-hidden="true">*</span></label>
          <select id={id('where')} className="input" value={where} aria-required="true" aria-invalid={!!errors.where || undefined}
            aria-describedby={describe('where')} onChange={e => setWhere(e.target.value)}>
            <option value="">Choose where “{categoryText.text.trim()}” goes</option>
            {groups.map(g => <option key={g.cat.id} value={g.cat.name}>{g.cat.name}</option>)}
          </select>
          {errors.where && <p id={id('where-error_msg')} className="error">{errors.where}</p>}
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor={id('amount')}>Amount <span aria-hidden="true">*</span></label>
        <p id={id('amount-help')} className="help">Use a minus sign for a credit or refund, e.g. -12.50. You can add or subtract, e.g. 12.50+3.</p>
        <AmountField id={id('amount')} allowNegative value={amount} onChange={e => setAmount(e.target.value)} aria-required="true"
          aria-invalid={!!errors.amount || undefined} aria-describedby={describe('amount', id('amount-help'))} />
        {errors.amount && <p id={id('amount-error_msg')} className="error">{errors.amount}</p>}
      </div>
      <div className="field">
        <label className="label" htmlFor={id('description')}>Description</label>
        <p id={id('description-help')} className="help">Optional. Up to {DESCRIPTION_MAX} characters.</p>
        <Input id={id('description')} maxLength={DESCRIPTION_MAX} autoComplete="off" value={description}
          onChange={e => setDescription(e.target.value)} aria-describedby={id('description-help')} />
      </div>
      <div className="field">
        <label className="label" htmlFor={id('date')}>Date</label>
        <DatePicker id={id('date')} value={date} min={bounds.min} max={bounds.max} aria-invalid={!!errors.date || undefined}
          aria-describedby={describe('date')} onChange={e => setDate(e.target.value)} />
        {errors.date && <p id={id('date-error_msg')} className="error">{errors.date}</p>}
      </div>
    </div>
  )

  /** "Use in future" shows only when the typed item is new. */
  const useInFutureField: ReactNode = isNew && (
    <label className="check">
      <input type="checkbox" id={id('use_in_future')} checked={useInFuture} onChange={e => setUseInFuture(e.target.checked)} />
      Use in future
    </label>
  )

  return { fields, useInFutureField, errors, errorList: toList(errors), validate, build, nameTaken, reset }
}
