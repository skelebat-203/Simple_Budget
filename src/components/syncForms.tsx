import { Input } from './ui'
import * as sync from '../storage/sync/controller'
import type { usePasscode } from './syncActions'

/** Passcode field shared by the Sync dialog and the wizard's sync step. */
export function PasscodeField({ id, isNew, p }: { id: string; isNew: boolean; p: ReturnType<typeof usePasscode> }) {
  return (
    <>
      <label htmlFor={id} className="label">Passcode<span aria-hidden="true"> *</span></label>
      <p id={`${id}-help`} className="help">{isNew
        ? `At least ${sync.PASSCODE_MIN} characters. It locks the sheet. If it is lost, the sheet can’t be read; data on your devices is safe.`
        : 'The passcode set when the sheet was created.'}</p>
      <Input id={id} type="password" autoComplete={isNew ? 'new-password' : 'current-password'} value={p.passcode} aria-required="true"
        aria-invalid={!!p.error || undefined} aria-describedby={p.error ? `${id}-help ${id}-error_msg` : `${id}-help`}
        onChange={e => p.setPasscode(e.target.value)} />
      {isNew && <>
        <label htmlFor={`${id}-confirm`} className="label">Confirm passcode<span aria-hidden="true"> *</span></label>
        <Input id={`${id}-confirm`} type="password" autoComplete="new-password" value={p.confirm} aria-required="true" onChange={e => p.setConfirm(e.target.value)} />
      </>}
      {p.error && <p id={`${id}-error_msg`} className="error">{p.error}</p>}
    </>
  )
}
