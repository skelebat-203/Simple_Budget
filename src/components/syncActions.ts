import { useState } from 'react'
import * as sync from '../storage/sync/controller'
import { createSpreadsheet, isSignedIn, redirectResult, signIn, type SignInReturn } from '../storage/sync/googleSheets'

/** Shared by the Sync dialog and the wizard's sync step (0015 §6). */
export const plainError = (e: unknown) => (e instanceof Error && e.message ? e.message : 'Something went wrong.')
export const syncFailText = (e: unknown) => `Error: ${plainError(e)} Your data on this device is safe.`
/** What to tell the user when the page was reached by the redirect sign-in (D004); blank otherwise. */
export function redirectNotice(where: SignInReturn) {
  const r = redirectResult()
  if (r?.returnTo !== where) return { status: '', error: '' }
  return r.error ? { status: '', error: syncFailText(new Error(r.error)) } : { status: 'Signed in with Google.', error: '' }
}
export const CREATED_TEXT = 'Sheet created and synced. Give the passcode to anyone you share the sheet with.'
export const LINKED_TEXT = 'Sheet linked and synced.'

/** Signs in only when needed (runs from a click: Google opens its window). */
export async function ensureSignedIn() { if (!isSignedIn()) await signIn() }
export async function createAndLink(passcode: string) { await sync.link(await createSpreadsheet(), passcode, true) }
export const linkSheet = (id: string, passcode: string) => sync.link(id, passcode, false)

/** Passcode (and Confirm for a new sheet) with the field checks. */
export function usePasscode() {
  const [passcode, setPasscode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  function check(isNew: boolean) {
    if (!passcode) { setError('Error: Passcode cannot be empty'); return false }
    if (isNew && passcode.length < sync.PASSCODE_MIN) { setError(`Invalid: Passcode use at least ${sync.PASSCODE_MIN} characters`); return false }
    if (isNew && passcode !== confirm) { setError('Invalid: Confirm passcode doesn’t match the passcode'); return false }
    setError('')
    return true
  }
  const clear = () => { setPasscode(''); setConfirm('') }
  return { passcode, setPasscode, confirm, setConfirm, error, check, clear }
}
