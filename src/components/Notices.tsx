import { Button } from './ui'

export interface NoticeState {
  loadError?: string
  skipped?: number
  notPersisted?: boolean
  dbBlocked?: boolean
  dbChanged?: boolean
}

/** App-wide messages about storage and data health. */
export function Notices({ state, onDismissPersist }: {
  state: NoticeState
  onDismissPersist: () => void
}) {
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
    </>
  )
}
