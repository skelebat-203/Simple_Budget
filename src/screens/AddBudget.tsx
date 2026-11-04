import { useRef, useState } from 'react'
import { Button, ErrorSummary, focusFirstError } from '../components/ui'
import { usePurchaseForm } from '../components/PurchaseForm'
import { addNewItem, budgetItemRepo, NameTakenError } from '../storage/repository'
import { displayName, formatAmount, type CatNode } from '../budget/tree'
import { useAnnounce } from '../components/ui/announcer'
import { fireReward } from '../rewards/rewards'
import { charityMovedText } from '../budget/charity'

/** Add purchase (0007 §4, §9): the shared purchase form (Item, Amount, Description, Date; a typed new item adds Category, Where? and Use in future). */
export function AddBudget({ roots, onSaved }: {
  roots: CatNode[]
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
    </section>
  )
}
