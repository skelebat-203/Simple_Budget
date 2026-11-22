import { useState } from 'react'
import { useSyncState } from './useSyncState'
import { useAnnounce } from './ui/announcer'
import { Button, Dialog } from './ui'
import * as sync from '../storage/sync/controller'
import { isGoogleConfigured } from '../storage/sync/googleConfig'
import { isSignedIn, signIn } from '../storage/sync/googleSheets'
import { createAndLink, CREATED_TEXT, LINKED_TEXT, linkSheet, syncFailText, usePasscode } from './syncActions'
import { PasscodeField } from './syncForms'

const syncedText = (skipped: number) => `Synced.${skipped ? ` ${skipped} row${skipped === 1 ? '' : 's'} from the sheet needed attention; see the list in Sync.` : ''}`

/**
 * Sync dialog (0015 §6), opened from the Budget screen: sign in with Google, create or link a sheet with
 * its passcode, then last sync time, Sync now and Unlink. One live region (useAnnounce).
 * `pickedId` is a sheet chosen in the Google Picker, which App opens with this dialog
 * closed (a modal dialog would keep the Picker from taking clicks).
 */
export function Sync({ onboarded, pickedId, onPick, onClose }: { onboarded: boolean; pickedId: string | null; onPick: () => void; onClose: () => void }) {
  const s = useSyncState()
  const [signedIn, setSignedIn] = useState(isSignedIn())
  const p = usePasscode()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  useAnnounce(status)
  useAnnounce(error || s.error || '')
  useAnnounce(p.error)

  async function run(f: () => Promise<string>) {
    setError(''); setStatus(''); setWorking(true)
    try { setStatus(await f()) } catch (e) { setError(syncFailText(e)) } finally { setWorking(false) }
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
      <h3 id="sync-signin-heading" className="label">Sign in</h3>
      <p className="help">Sync keeps the same budget on several devices, using a Google Sheet in your own Google account. The app sees only sheets it created or you picked.</p>
      <div className="actions"><Button type="button" onClick={login} disabled={working}>Sign in with Google</Button></div>
    </section>
  )
  else if (!s.linked) body = pickedId ? (
    <section className="field" aria-labelledby="sync-link-heading">
      <h3 id="sync-link-heading" className="label">Link the sheet you picked</h3>
      {passcodeField(false)}
      <div className="actions">
        <Button type="button" className="secondary" onClick={onPick} disabled={working}>Pick another sheet</Button>
        <Button type="button" onClick={linkPicked} disabled={working}>Link sheet</Button>
      </div>
    </section>
  ) : (
    <>
      <section className="field" aria-labelledby="sync-create-heading">
        <h3 id="sync-create-heading" className="label">Create a new sheet</h3>
        {passcodeField(true)}
        <div className="actions"><Button type="button" onClick={create} disabled={working}>Create sheet</Button></div>
      </section>
      <section className="field" aria-labelledby="sync-pick-heading">
        <h3 id="sync-pick-heading" className="label">Link a sheet</h3>
        <p className="help">Use a sheet someone shared with you in Google Drive. You also need its passcode.</p>
        <div className="actions"><Button type="button" onClick={onPick} disabled={working}>Link a sheet</Button></div>
      </section>
    </>
  )
  else body = (
    <section className="field" aria-labelledby="sync-status-heading">
      <h3 id="sync-status-heading" className="label">Synced sheet</h3>
      <p className="help">{s.busy ? 'Syncing…' : s.lastSync ? `Last synced ${new Date(s.lastSync).toLocaleString()}.` : 'Not synced yet.'}</p>
      <div className="actions">
        <Button type="button" onClick={syncNow} disabled={working || s.busy}>Sync now</Button>
        <Button type="button" className="secondary" onClick={() => setUnlinking(true)} disabled={working}>Unlink</Button>
      </div>
      {unlinking && (
        <div className="banner banner-warn">
          <h3 className="banner-title">Stop syncing on this device?</h3>
          <p>The passcode is forgotten on this device. Your data here and the sheet stay as they are.</p>
          <div className="actions">
            <Button type="button" className="secondary" onClick={() => setUnlinking(false)}>Cancel</Button>
            <Button type="button" onClick={unlink}>Unlink</Button>
          </div>
        </div>
      )}
      {s.notes.length > 0 && <ul className="help">{s.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </section>
  )

  return (
    <Dialog id="sync-dialog" title="Sync" onClose={onClose} className="backup"
      buttons={<Button type="button" className="secondary" id="sync-close" onClick={onClose}>Close</Button>}>
      {body}
      {shownError && <p className="error">{shownError}</p>}
      <p className="status">{status}</p>
    </Dialog>
  )
}

