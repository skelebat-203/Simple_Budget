import { useRef, useState } from 'react'
import { Button, ErrorSummary, focusFirstError } from '../components/ui'
import { usePurchaseForm } from '../components/PurchaseForm'
import { addNewItem, budgetItemRepo, NameTakenError } from '../storage/repository'
import { displayName, formatAmount, type Calendar, type CatNode } from '../budget/tree'
import type { BudgetItem } from '../storage/db'
import { BudgetTable } from '../components/BudgetTable'
import { useAnnounce } from '../components/ui/announcer'
import { fireReward } from '../rewards/rewards'
import { charityMovedText } from '../budget/charity'
import { whenIdle } from '../storage/sync/controller'

/** Add purchase (0007 §4, §9): the shared purchase form (Item, Amount, Description, Date; a typed new item adds Category, Where? and Save for future). */
export function AddBudget({ roots, items, calendar, onSaved }: {
  roots: CatNode[]
  /** For the read-only Day table under the form (v0.7 step 12). */
  items: BudgetItem[]
  calendar: Calendar
  onSaved: () => void
}) {
  const form = usePurchaseForm(roots)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ what: string; extra: string; info?: string } | null>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const [saveError, setSaveError] = useState('')
  // The banner below is visual only; this is the one announcement (single live region).
  useAnnounce(saved ? `Saved ${saved.what} ${saved.extra} ${saved.info ?? ''}`.replace(/\s+/g, ' ').trim() : '')
  useAnnounce(saveError)

  async function save() {
    setSaved(null)
    setSaveError('')
    const list = form.validate()
    if (list.length) {
      // Wait for the banner to render before moving focus.
      requestAnimationFrame(() => focusFirstError(list, bannerRef.current))
      return
    }
    setSaving(true)
    const p = form.build()
    const shownAmount = (p.kind === 'existing' ? formatAmount(p.amount) : formatAmount(p.args.amount)) || '0.00'
    try {
      // A save made while a sync runs is held, then written when the sync completes or fails (0015 Q4).
      await whenIdle()
      if (p.kind === 'existing') {
        await budgetItemRepo.add({ categoryId: p.target.cat.id, amount: p.amount, date: p.date, description: p.description })
        setSaved({ what: `${displayName(p.target)}: ${shownAmount} on ${p.date}.`, extra: '' })
      } else {
        const { movedFrom: moved, charityMoved } = await addNewItem(p.args)
        setSaved({ what: `${p.name}: ${shownAmount} on ${p.args.date}.`, extra: moved ? `Your ${moved} estimate moved to ${moved} › Miscellaneous. ${moved} now totals its items.` : '', info: charityMoved ? charityMovedText(charityMoved) : undefined })
      }
      form.reset()
      onSaved()
      fireReward()
    } catch (err) {
      if (err instanceof NameTakenError) {
        const list = form.nameTaken(err.message)
        requestAnimationFrame(() => focusFirstError(list, bannerRef.current))
      } else {
        // Name and message only; never the record (security-v0.2 8.6).
        console.error('Save failed:', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown')
        setSaveError('Error: The item wasn’t saved. Check that your device has free storage space, then try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="add-heading">
      <h2 id="add-heading" className="sr-only">Add purchase</h2>
      <ErrorSummary ref={bannerRef} errors={form.errorList} />
      {saved && (
        <div className="banner banner-success">
          <p className="banner-title">Saved. Nice work keeping your budget up to date!</p>
          <p>{saved.what}{saved.extra && ` ${saved.extra}`}</p>
        </div>
      )}
      {saved?.info && (
        <div className="banner banner-info">
          <p className="banner-title">Charity purchases moved</p>
          <p>{saved.info}</p>
        </div>
      )}
      {form.fields}
      <div className="actions actions-end">
        {form.useInFutureField}
        <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
      {saveError && <p className="error">{saveError}</p>}
      {/* Today's Day table (v0.7 step 12): each purchase has an Update button (Item, Amount, Description, Date; Delete) (v0.7 step 15d). */}
      <h3 id="add-day-heading" className="add-day-heading">Today’s purchases</h3>
      <BudgetTable idBase="add-day" headingLevel={4} roots={roots} items={items} range="day" showEstimates={false} calendar={calendar} onChanged={onSaved} pageHead />
    </section>
  )
}
