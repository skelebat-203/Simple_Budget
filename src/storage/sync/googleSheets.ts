import type { SyncTab } from '../db'
import { AuthError, RateLimitError, RemoteError, type CellWrite, type RemoteSheet, type StorageAdapter } from './adapter'
import { TABS } from './cells'
import { DRIVE_FILE_SCOPE, GAPI_SCRIPT, GOOGLE_CONFIG, GSI_SCRIPT, SHEETS_API } from './googleConfig'

/** Title of a sheet the app creates. */
export const NEW_SHEET_TITLE = 'Simple Budget sync'
const PROTECTION_NOTE = 'Simple Budget sync data. Edits here sync to every device.'
/** Columns A to D: id, updatedAt, deleted, content. */
const COLS = 'A:D'
const TOKEN_MARGIN_MS = 60_000
const MS_PER_S = 1000

// ---------- the parts of Google's browser libraries used here ----------

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; scope?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string }): void }
interface PickerDoc { id: string }
interface PickerData { action: string; docs?: PickerDoc[] }
interface PickerBuilder {
  addView(v: unknown): PickerBuilder
  setOAuthToken(t: string): PickerBuilder
  setDeveloperKey(k: string): PickerBuilder
  setAppId(id: string): PickerBuilder
  setCallback(cb: (d: PickerData) => void): PickerBuilder
  build(): { setVisible(v: boolean): void }
}
interface GoogleNs {
  accounts: { oauth2: {
    initTokenClient(o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string }) => void }): TokenClient
    revoke(token: string, done?: () => void): void
  } }
  picker: {
    DocsView: new (viewId: unknown) => { setMode(m: unknown): unknown }
    ViewId: { SPREADSHEETS: unknown }
    DocsViewMode: { LIST: unknown }
    PickerBuilder: new () => PickerBuilder
    Action: { PICKED: string; CANCEL: string }
  }
}
type GoogleWindow = Window & { google?: GoogleNs; gapi?: { load(lib: string, cb: () => void): void } }
const win = () => window as GoogleWindow

const loaded = new Map<string, Promise<void>>()
function loadScript(src: string): Promise<void> {
  let p = loaded.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { loaded.delete(src); reject(new RemoteError('Google sign-in couldn’t load. Check your connection and try again.')) }
      document.head.appendChild(s)
    })
    loaded.set(src, p)
  }
  return p
}

// ---------- sign-in: the token lives in memory only (0015 §7.1) ----------

let token: { value: string; expires: number } | null = null

export const isSignedIn = () => !!token && token.expires > Date.now()
export const accessToken = () => (isSignedIn() ? token!.value : null)

/** Our message for each sign-in failure; Google's own text is never shown (0015 §7.1). Known codes only. */
function signInMessage(code?: string): string {
  switch (code) {
    case 'popup_failed_to_open': return 'Google’s sign-in window was blocked. Allow pop-ups for this site and try again.'
    case 'popup_closed': return 'The Google sign-in window closed before sign-in finished. Try again; if it keeps closing, allow pop-ups and third-party sign-in for this site.'
    case 'access_denied': return 'Google access wasn’t granted. Sync needs it to reach your sheet.'
    case 'scope_missing': return 'The permission to see and edit files used with this app was left unticked. Try again and tick it.'
    default: return `Google sign-in didn’t finish (${code && /^[a-z_]{1,40}$/.test(code) ? code : 'unknown'}).`
  }
}

/** Google Identity Services token flow; must run from a click (it opens Google's window). */
export async function signIn(): Promise<void> {
  await loadScript(GSI_SCRIPT)
  const g = win().google
  if (!g) throw new RemoteError('Google sign-in couldn’t load. Check your connection and try again.')
  await new Promise<void>((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CONFIG.clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: r => {
        if (!r.access_token || r.error) { reject(new AuthError(signInMessage(r.error))); return }
        // Granular consent: the user can untick the one permission sync needs.
        if (r.scope && !r.scope.split(' ').includes(DRIVE_FILE_SCOPE)) { reject(new AuthError(signInMessage('scope_missing'))); return }
        token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 0) * MS_PER_S - TOKEN_MARGIN_MS }
        resolve()
      },
      error_callback: e => reject(new AuthError(signInMessage(e?.type))),
    })
    client.requestAccessToken()
  })
}

export function signOut() {
  const t = token?.value
  token = null
  if (t) win().google?.accounts.oauth2.revoke(t)
}

// ---------- Sheets API calls ----------

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const t = accessToken()
  if (!t) throw new AuthError('Sign in with Google to sync.')
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } })
  } catch {
    throw new RemoteError('Google couldn’t be reached. Check your connection.')
  }
  // Plain messages only; the response body is never shown or logged (CWE-209).
  if (res.status === 429) throw new RateLimitError('Google asked the app to slow down.')
  if (res.status === 401) { token = null; throw new AuthError('Your Google sign-in expired. Sign in again to sync.') }
  if (res.status === 403 || res.status === 404) throw new RemoteError('The sheet can’t be opened. It may have been deleted or unshared.')
  if (!res.ok) throw new RemoteError('Google had a problem with the request.')
  return res.json() as Promise<T>
}

const range = (tab: SyncTab, a1: string) => encodeURIComponent(`${tab}!${a1}`)

/** The Google Sheets adapter: one batched read and at most one write call per tab group. */
export class GoogleSheetsAdapter implements StorageAdapter {
  private spreadsheetId: string
  constructor(spreadsheetId: string) { this.spreadsheetId = spreadsheetId }

  async read(): Promise<RemoteSheet> {
    const q = TABS.map(t => `ranges=${range(t, COLS)}`).join('&')
    const res = await call<{ valueRanges?: { values?: unknown[][] }[] }>(
      `${SHEETS_API}/${encodeURIComponent(this.spreadsheetId)}/values:batchGet?${q}&valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`)
    const out = {} as RemoteSheet
    TABS.forEach((t, i) => { out[t] = (res.valueRanges?.[i]?.values ?? []).map((cells, r) => ({ row: r + 1, cells })) })
    return out
  }

  async write(cells: CellWrite[]): Promise<void> {
    const id = encodeURIComponent(this.spreadsheetId)
    const set = cells.filter(c => c.row != null)
    if (set.length) {
      await call(`${SHEETS_API}/${id}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({
        valueInputOption: 'RAW',
        data: set.map(c => ({ range: `${c.tab}!A${c.row}:D${c.row}`, values: [c.cells] })),
      }) })
    }
    for (const tab of TABS) {
      const rows = cells.filter(c => c.row == null && c.tab === tab).map(c => c.cells)
      if (!rows.length) continue
      await call(`${SHEETS_API}/${id}/values/${range(tab, COLS)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: JSON.stringify({ values: rows }) })
    }
  }
}

/** Create the sync sheet with its tabs, each with "warning only" protection (0015 Q4). */
export async function createSpreadsheet(): Promise<string> {
  const made = await call<{ spreadsheetId: string; sheets: { properties: { sheetId: number } }[] }>(SHEETS_API, {
    method: 'POST',
    body: JSON.stringify({ properties: { title: NEW_SHEET_TITLE }, sheets: TABS.map(title => ({ properties: { title } })) }),
  })
  await call(`${SHEETS_API}/${encodeURIComponent(made.spreadsheetId)}:batchUpdate`, { method: 'POST', body: JSON.stringify({
    requests: made.sheets.map(s => ({ addProtectedRange: { protectedRange: { range: { sheetId: s.properties.sheetId }, warningOnly: true, description: PROTECTION_NOTE } } })),
  }) })
  return made.spreadsheetId
}

/** Google Picker for "Link a sheet": resolves with the picked sheet's id, or null when cancelled. */
export async function pickSpreadsheet(): Promise<string | null> {
  const t = accessToken()
  if (!t) throw new AuthError('Sign in with Google to link a sheet.')
  await loadScript(GAPI_SCRIPT)
  const w = win()
  await new Promise<void>(resolve => w.gapi!.load('picker', resolve))
  const p = w.google!.picker
  return new Promise(resolve => {
    const view = new p.DocsView(p.ViewId.SPREADSHEETS)
    view.setMode(p.DocsViewMode.LIST)
    new p.PickerBuilder().addView(view).setOAuthToken(t).setDeveloperKey(GOOGLE_CONFIG.apiKey).setAppId(GOOGLE_CONFIG.appId)
      .setCallback(d => {
        if (d.action === p.Action.PICKED) resolve(d.docs?.[0]?.id ?? null)
        else if (d.action === p.Action.CANCEL) resolve(null)
      })
      .build().setVisible(true)
  })
}
