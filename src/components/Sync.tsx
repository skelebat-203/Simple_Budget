import { useEffect, useState } from 'react'
import { useSyncState } from './useSyncState'
import { useAnnounce } from './ui/announcer'
import { Button } from './ui'
import * as sync from '../storage/sync/controller'
import { PopupError } from '../storage/sync/adapter'
import { isGoogleConfigured } from '../storage/sync/googleConfig'
import { clearRedirectResult, isSignedIn, signIn } from '../storage/sync/googleSheets'
import { createAndLink, CREATED_TEXT, LINKED_TEXT, linkSheet, redirectNotice, syncFailText, usePasscode } from './syncActions'
import { PasscodeField, RedirectSignIn } from './syncForms'

/** Longest list of skipped-row notes shown; a damaged sheet can produce thousands. */
const MAX_NOTES_SHOWN = 20
const syncedText =(skipped: number) => `Synced.${skipped ? ` ${skipped} row${skipped === 1 ? '' : 's'} from the sheet needed attention; see the list in Sync.` : ''}`

/**
 * Sync section of the Backup dialog (0015 §6; moved there 2026-11-26): sign in with Google, create or link a sheet with
 * its passcode, then last sync time, Sync now and Unlink. One live region (useAnnounce).
 * `pickedId` is a sheet chosen in the Google Picker, which App opens with the Backup dialog
 * closed (a modal dialog would keep the Picker from taking clicks).
 */
export function Sync({ onboarded, pickedId, onPick }: { onboarded: boolean; pickedId: string | null; onPick: () => void }) {
  const s = useSyncState()
  const [signedIn, setSignedIn] = useState(isSignedIn())
  const p = usePasscode()
  const [arrival] = useState(() => redirectNotice('backup'))
  const [status, setStatus] = useState(arrival.status)
  const [error, setError] = useState(arrival.error)
  const [working, setWorking] = useState(false)
  const [offerRedirect, setOfferRedirect] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  useEffect(clearRedirectResult, [])
  useAnnounce(status)
  useAnnounce(error || s.error || '')
  useAnnounce(p.error)

  async function run(f: () => Promise<string>) {
    setError(''); setStatus(''); setOfferRedirect(false); setWorking(true)
    try { setStatus(await f()) } catch (e) { setError(syncFailText(e)); setOfferRedirect(e instanceof PopupError) } finally { setWorking(false) }
  }

  const login = () => run(async () => { await signIn(); setSignedIn(true); void sync.requestSync(); return 'Signed in with Google.' })
  const create = () => { if (p.check(true)) void run(async () => { await createAndLink(p.passcode); p.clear(); return CREATED_TEXT }) }
  const linkPicked = () => { if (pickedId && p.check(false)) void run(async () => { await linkSheet(pickedId, p.passcode); p.clear(); return LINKED_TEXT }) }
  const syncNow = () => run(async () => { const r = await sync.requestSync(); return r ? syncedText(r.notes.length) : '' })
  const unlink = () => run(async () => { await sync.unlink(); setUnlinking(false); return 'Sync stopped on this device. Your data here stays.' })

  const shownError = error || s.error
  const passcodeField = (isNew: boolean) => <PasscodeField id="sync-passcode" isNew={isNew} p={p} />

  let body
  if (!isGoogleConfigured()) body = <p className="help">Sync isn’t set up in this version of the app yet.</p>
  else if (!onboarded) body = <p className="help">Finish the setup questions first. Then you can sync your budget to a Google Sheet.</p>
  else if (!signedIn) body = (
    <section className="field" aria-labelledby="sync-signin-heading">
      <h4 id="sync-signin-heading" className="label">Sign in</h4>
      <p className="help">Sync keeps the same budget on several devices, using a Google Sheet in your own Google account. The app sees only sheets it created or you picked.</p>
      <div className="actions"><Button type="button" onClick={login} disabled={working}>Sign in with Google</Button></div>
      {offerRedirect && <RedirectSignIn returnTo="backup" onError={setError} />}
    </section>
  )
  else if (!s.linked) body = pickedId ? (
    <section className="field" aria-labelledby="sync-link-heading">
      <h4 id="sync-link-heading" className="label">Link the sheet you picked</h4>
      {passcodeField(false)}
      <div className="actions">
        <Button type="button" className="secondary" onClick={onPick} disabled={working}>Pick another sheet</Button>
        <Button type="button" onClick={linkPicked} disabled={working}>Link sheet</Button>
      </div>
    </section>
  ) : (
    <>
      <section className="field" aria-labelledby="sync-create-heading">
        <h4 id="sync-create-heading" className="label">Create a new sheet</h4>
        {passcodeField(true)}
        <div className="actions"><Button type="button" onClick={create} disabled={working}>Create sheet</Button></div>
      </section>
      <section className="field" aria-labelledby="sync-pick-heading">
        <h4 id="sync-pick-heading" className="label">Link a sheet</h4>
        <p className="help">Use a sheet someone shared with you in Google Drive. You also need its passcode.</p>
        <div className="actions"><Button type="button" onClick={onPick} disabled={working}>Link a sheet</Button></div>
      </section>
    </>
  )
  else body = (
    <section className="field" aria-labelledby="sync-status-heading">
      <h4 id="sync-status-heading" className="label">Synced sheet</h4>
      <p className="help">{s.busy ? 'Syncing…' : s.lastSync ? `Last synced ${new Date(s.lastSync).toLocaleString()}.` : 'Not synced yet.'}</p>
      <div className="actions">
        <Button type="button" onClick={syncNow} disabled={working || s.busy}>Sync now</Button>
        <Button type="button" className="secondary" onClick={() => setUnlinking(true)} disabled={working}>Unlink</Button>
      </div>
      {unlinking && (
        <div className="banner banner-warn">
          <h4 className="banner-title">Stop syncing on this device?</h4>
          <p>The passcode is forgotten on this device. Your data here and the sheet stay as they are.</p>
          <div className="actions">
            <Button type="button" className="secondary" onClick={() => setUnlinking(false)}>Cancel</Button>
            <Button type="button" onClick={unlink}>Unlink</Button>
          </div>
        </div>
      )}
      {s.notes.length > 0 && <ul className="help">{[...s.notes.slice(0, MAX_NOTES_SHOWN), ...(s.notes.length > MAX_NOTES_SHOWN ? [`…and ${s.notes.length - MAX_NOTES_SHOWN} more.`] : [])].map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </section>
  )

  return (
    <section className="field" aria-labelledby="sync-heading">
      <h3 id="sync-heading" className="label">Sync with Google</h3>
      {body}
      {shownError && <p className="error">{shownError}</p>}
      <p className="status">{status}</p>
    </section>
  )
}

