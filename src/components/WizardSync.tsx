import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from './ui'
import { useAnnounce } from './ui/announcer'
import { useSyncState } from './useSyncState'
import { PopupError } from '../storage/sync/adapter'
import { isGoogleConfigured } from '../storage/sync/googleConfig'
import { clearRedirectResult, pickSpreadsheet } from '../storage/sync/googleSheets'
import { createAndLink, CREATED_TEXT, ensureSignedIn, LINKED_TEXT, linkSheet, redirectNotice, syncFailText, usePasscode } from './syncActions'
import { PasscodeField, RedirectSignIn } from './syncForms'

export type SyncTabId = 'new' | 'existing'
const TABS: { id: SyncTabId; label: string }[] = [
  { id: 'new', label: 'New Budget' },
  { id: 'existing', label: 'Existing Budget' },
]

/**
 * The wizard's "Sync with Google" content (RESUME-HERE v0.7 step 3b): ARIA tabs
 * (Left/Right wrap, Home/End) for a new budget (passcode, then sign in and create the
 * sheet) or an existing one (sign in, pick the sheet, passcode). `onSuspend` closes the
 * wizard while the Google Picker is open and reopens it after; this stays mounted.
 */
export function WizardSync({ tab, onTab, onSuspend }: { tab: SyncTabId; onTab: (t: SyncTabId) => void; onSuspend: (s: boolean) => void }) {
  const s = useSyncState()
  const p = usePasscode()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [arrival] = useState(() => redirectNotice('wizard'))
  const [status, setStatus] = useState(arrival.status)
  const [error, setError] = useState(arrival.error)
  const [working, setWorking] = useState(false)
  const [offerRedirect, setOfferRedirect] = useState(false)
  useEffect(clearRedirectResult, [])
  useAnnounce(status)
  useAnnounce(error)
  useAnnounce(p.error)
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const panel = useRef<HTMLDivElement>(null)

  function select(i: number) {
    const t = TABS[(i + TABS.length) % TABS.length]
    onTab(t.id); setError(''); p.clear()
    refs.current[t.id]?.focus()
  }
  function onKeyDown(e: KeyboardEvent, i: number) {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    select(to)
  }

  async function run(f: () => Promise<string>) {
    setError(''); setStatus(''); setOfferRedirect(false); setWorking(true)
    try { setStatus(await f()) } catch (e) { setError(syncFailText(e)); setOfferRedirect(e instanceof PopupError) } finally { setWorking(false) }
  }
  const create = () => { if (p.check(true)) void run(async () => { await ensureSignedIn(); await createAndLink(p.passcode); p.clear(); return CREATED_TEXT }) }
  const choose = () => run(async () => {
    await ensureSignedIn()
    onSuspend(true)
    let id: string | null = null
    try { id = await pickSpreadsheet() } finally { onSuspend(false) }
    if (id) setPickedId(id)
    // Back in the wizard: the passcode field next, or the button again when nothing was picked.
    requestAnimationFrame(() => (id ? panel.current?.querySelector<HTMLElement>('input') : document.getElementById('wizard-pick'))?.focus())
    return id ? 'Sheet chosen. Enter its passcode.' : ''
  })
  const link = () => { if (pickedId && p.check(false)) void run(async () => { await linkSheet(pickedId, p.passcode); p.clear(); return LINKED_TEXT }) }

  let content
  if (!isGoogleConfigured()) content = <p className="help">Sync isn’t set up in this version of the app yet. Choose Local only for now.</p>
  else if (s.linked) content = <p className="help">This device syncs with a Google Sheet. {tab === 'new' ? 'Select Next.' : 'Select Done.'}</p>
  else if (tab === 'new') content = (
    <>
      <p className="help">Start a budget in a new Google Sheet in your account.</p>
      <PasscodeField id="wizard-passcode" isNew p={p} />
      <div className="actions"><Button type="button" id="wizard-create" onClick={create} disabled={working}>Sign in and create sheet</Button></div>
    </>
  )
  else content = (
    <>
      <p className="help">Use a Simple Budget sheet you made, or one someone shared with your Google account. Its categories are used.</p>
      {pickedId && <PasscodeField id="wizard-passcode" isNew={false} p={p} />}
      <div className="actions">
        <Button type="button" id="wizard-pick" className={pickedId ? 'secondary' : undefined} onClick={() => void choose()} disabled={working}>
          {pickedId ? 'Choose another sheet' : 'Sign in and choose the sheet'}
        </Button>
        {pickedId && <Button type="button" id="wizard-link" onClick={link} disabled={working}>Link sheet</Button>}
      </div>
    </>
  )

  return (
    <div className="wizard-sync">
      <div role="tablist" aria-label="Budget to sync" className="tablist">
        {TABS.map((t, i) => (
          <button key={t.id} type="button" role="tab" id={`wizard-tab-${t.id}`} className="tab"
            ref={el => { refs.current[t.id] = el }}
            aria-selected={tab === t.id} aria-controls="wizard-tabpanel" tabIndex={tab === t.id ? 0 : -1}
            onClick={() => select(i)} onKeyDown={e => onKeyDown(e, i)}>
            {t.label}
          </button>
        ))}
      </div>
      <div ref={panel} id="wizard-tabpanel" role="tabpanel" aria-labelledby={`wizard-tab-${tab}`} className="wizard-tabpanel field">
        {content}
        {error && <p className="error">{error}</p>}
        {offerRedirect && <RedirectSignIn returnTo="wizard" onError={setError} />}
        <p className="status">{status}</p>
      </div>
    </div>
  )
}
