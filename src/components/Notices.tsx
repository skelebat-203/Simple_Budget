import { Button } from './ui'
import { useAnnounce } from './ui/announcer'

export interface NoticeState {
  loadError?: string
  skipped?: number
  notPersisted?: boolean
  dbBlocked?: boolean
  dbChanged?: boolean
  /** Set when a Budget setup save moved Charity purchases to Miscellaneous (0009 §6). */
  charityMoved?: string
}

/** App-wide messages about storage and data health. */
export function Notices({ state, onDismissPersist, onDismissInfo }: {
  state: NoticeState
  onDismissPersist: () => void
  onDismissInfo: () => void
}) {
  useAnnounce([
    state.dbChanged && 'Error: The app was updated in another tab. Reload this page before making more changes.',
    state.dbBlocked && 'Error: Another tab is blocking an update. Close every other Simple Budget tab or window.',
    state.loadError && `Error: Your budget couldn’t be loaded. ${state.loadError}`,
    !!state.skipped && 'Some saved records couldn’t be read.',
    state.notPersisted && 'Your browser may clear this budget. Export a backup regularly.',
    state.charityMoved,
  ].filter(Boolean).join(' '))
  return (
    <>
      {state.dbChanged && (
        <div className="banner">
          <h2 className="banner-title">Error: The app was updated in another tab</h2>
          <p>Reload this page before making more changes. Changes made here now won’t be saved.</p>
        </div>
      )}
      {state.dbBlocked && (
        <div className="banner">
          <h2 className="banner-title">Error: Another tab is blocking an update</h2>
          <p>Close every other Simple Budget tab or window. The app will continue once they are closed.</p>
        </div>
      )}
      {state.loadError && (
        <div className="banner">
          <h2 className="banner-title">Error: Your budget couldn’t be loaded</h2>
          <p>{state.loadError}</p>
        </div>
      )}
      {!!state.skipped && (
        <div className="banner banner-warn">
          <h2 className="banner-title">Some saved records couldn’t be read</h2>
          <p>{state.skipped} damaged {state.skipped === 1 ? 'record was' : 'records were'} left out of your totals. Your other data is fine.</p>
        </div>
      )}
      {state.charityMoved && (
        <div className="banner banner-info">
          <h2 className="banner-title">Charity purchases moved</h2>
          <p>{state.charityMoved}</p>
          <div className="actions"><Button type="button" className="secondary" onClick={onDismissInfo}>Got it</Button></div>
        </div>
      )}
      {state.notPersisted && (
        <div className="banner banner-warn">
          <h2 className="banner-title">Your browser may clear this budget</h2>
          <p>The browser didn’t agree to keep this app’s data permanently, so it could delete it if space runs low. Install the app to your home screen, and export a backup regularly.</p>
          <div className="actions"><Button type="button" className="secondary" onClick={onDismissPersist}>Got it</Button></div>
        </div>
      )}
    </>
  )
}
