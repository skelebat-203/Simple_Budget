import { Button } from './ui'
import type { BudgetItem } from '../storage/db'
import { displayName, flatten, formatAmount, type CatNode } from '../budget/tree'

export interface NoticeState {
  loadError?: string
  skipped?: number
  notPersisted?: boolean
  dbBlocked?: boolean
  dbChanged?: boolean
}

/** App-wide messages about storage and data health. */
export function Notices({ state, roots, items, onDismissPersist, onReviewed }: {
  state: NoticeState
  roots: CatNode[]
  items: BudgetItem[]
  onDismissPersist: () => void
  onReviewed: () => void
}) {
  const flagged = items.filter(i => i.needsReview)
  const byId = new Map(flatten(roots).map(n => [n.cat.id, n]))
  return (
    <>
      {state.dbChanged && (
        <div className="banner" role="alert">
          <h2 className="banner-title">Error: The app was updated in another tab</h2>
          <p>Reload this page before making more changes. Changes made here now won’t be saved.</p>
        </div>
      )}
      {state.dbBlocked && (
        <div className="banner" role="alert">
          <h2 className="banner-title">Error: Another tab is blocking an update</h2>
          <p>Close every other Simple Budget tab or window. The app will continue once they are closed.</p>
        </div>
      )}
      {state.loadError && (
        <div className="banner" role="alert">
          <h2 className="banner-title">Error: Your budget couldn’t be loaded</h2>
          <p>{state.loadError}</p>
        </div>
      )}
      {!!state.skipped && (
        <div className="banner banner-warn" role="status">
          <h2 className="banner-title">Some saved records couldn’t be read</h2>
          <p>{state.skipped} damaged {state.skipped === 1 ? 'record was' : 'records were'} left out of your totals. Your other data is fine.</p>
        </div>
      )}
      {state.notPersisted && (
        <div className="banner banner-warn" role="status">
          <h2 className="banner-title">Your browser may clear this budget</h2>
          <p>The browser didn’t agree to keep this app’s data permanently, so it could delete it if space runs low. Install the app to your home screen, and export a backup regularly.</p>
          <div className="actions"><Button type="button" className="secondary" onClick={onDismissPersist}>Got it</Button></div>
        </div>
      )}
      {flagged.length > 0 && (
        <div className="banner banner-warn" role="status">
          <h2 className="banner-title">Check {flagged.length === 1 ? 'this amount' : `these ${flagged.length} amounts`}</h2>
          <p>An app update couldn’t tell which category these older amounts belong to, because the name is used in more than one place. Each total still includes them. Note any that are filed under the wrong item; moving amounts arrives with editing in a later update.</p>
          <ul>
            {flagged.map(i => {
              const n = byId.get(i.categoryId)
              return <li key={i.id}>{n ? displayName(n) : 'Unknown item'}: {formatAmount(i.amount) || '0.00'} on {i.date}</li>
            })}
          </ul>
          <div className="actions"><Button type="button" className="secondary" onClick={onReviewed}>I’ve checked these</Button></div>
        </div>
      )}
    </>
  )
}
