import { useState } from 'react'
import { useSyncState } from './useSyncState'
import { useAnnounce } from './ui/announcer'
import { Button, Dialog, Input } from './ui'
import * as sync from '../storage/sync/controller'
import { isGoogleConfigured } from '../storage/sync/googleConfig'
import { createSpreadsheet, isSignedIn, signIn } from '../storage/sync/googleSheets'

const syncedText = (skipped: number) => `Synced.${skipped ? ` ${skipped} row${skipped === 1 ? '' : 's'} from the sheet needed attention; see the list in Sync.` : ''}`
const plain = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Something went wrong.')

/**
 * Sync dialog (0015 §6), next to Backup: sign in with Google, create or link a sheet with
 * its passcode, then last sync time, Sync now and Unlink. One live region (useAnnounce).
 * `pickedId` is a sheet chosen in the Google Picker, which App opens with this dialog
 * closed (a modal dialog would keep the Picker from taking clicks).
 */
export function Sync({ onboarded, pickedId, onPick, onClose }: { onboarded: boolean; pickedId: string | null; onPick: () => void; onClose: () => void }) {
  const s = useSyncState()
  const [signedIn, setSignedIn] = useState(isSignedIn())
  const [passcode, setPasscode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  useAnnounce(status)
  useAnnounce(error || s.error || '')
  useAnnounce(fieldError)

  async function run(f: () => Promise<string>) {
    setError(''); setStatus(''); setWorking(true)
    try { setStatus(await f()) } catch (e) { setError(`Error: ${plain(e)} Your data on this device is safe.`) } finally { setWorking(false) }
  }

  const login = () => run(async () => { await signIn(); setSignedIn(true); void sync.requestSync(); return 'Signed in with Google.' })

  function checkPasscode(isNew: boolean) {
    if (!passcode) { setFieldError('Error: Passcode cannot be empty'); return false }
    if (isNew && passcode.length < sync.PASSCODE_MIN) { setFieldError(`Invalid: Passcode use at least ${sync.PASSCODE_MIN} characters`); return false }
    if (isNew && passcode !== confirm) { setFieldError('Invalid: Confirm passcode doesn’t match the passcode'); return false }
    setFieldError('')
    return true
  }
  const create = () => { if (checkPasscode(true)) void run(async () => { await sync.link(await createSpreadsheet(), passcode, true); setPasscode(''); setConfirm(''); return 'Sheet created and synced. Give the passcode to anyone you share the sheet with.' }) }
  const linkPicked = () => { if (pickedId && checkPasscode(false)) void run(async () => { await sync.link(pickedId, passcode, false); setPasscode(''); return 'Sheet linked and synced.' }) }
  const syncNow = () => run(async () => { const r = await sync.requestSync(); return r ? syncedText(r.notes.length) : '' })
  const unlink = () => run(async () => { await sync.unlink(); setUnlinking(false); return 'Sync stopped on this device. Your data here stays.' })

  const shownError = error || s.error
  const passcodeField = (isNew: boolean) => (
    <>
      <label htmlFor="sync-passcode" className="label">Passcode<span aria-hidden="true"> *</span></label>
      <p id="sync-passcode-help" className="help">{isNew
        ? `At least ${sync.PASSCODE_MIN} characters. It locks the sheet. If it is lost, the sheet can’t be read; data on your devices is safe.`
        : 'The passcode set when the sheet was created.'}</p>
      <Input id="sync-passcode" type="password" autoComplete={isNew ? 'new-password' : 'current-password'} value={passcode} aria-required="true"
        aria-invalid={!!fieldError || undefined} aria-describedby={fieldError ? 'sync-passcode-help sync-passcode-error_msg' : 'sync-passcode-help'}
        onChange={e => setPasscode(e.target.value)} />
      {isNew && <>
        <label htmlFor="sync-passcode-confirm" className="label">Confirm passcode<span aria-hidden="true"> *</span></label>
        <Input id="sync-passcode-confirm" type="password" autoComplete="new-password" value={confirm} aria-required="true" onChange={e => setConfirm(e.target.value)} />
      </>}
      {fieldError && <p id="sync-passcode-error_msg" className="error">{fieldError}</p>}
    </>
  )

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

