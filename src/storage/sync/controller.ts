import { db } from '../db'
import { AuthError, RateLimitError, RemoteError, type StorageAdapter } from './adapter'
import { deriveKey, fromBase64, newSalt, toBase64 } from './crypto'
import { initSheet, PasscodeError, readSalt, syncOnce, type SyncResult } from './engine'

/** Sync timing (0015 Q6): every minute while the app is visible. */
export const SYNC_INTERVAL_MS = 60_000
/** Back-off after a quota error (HTTP 429) doubles up to this cap (0015 §7.1). */
export const MAX_BACKOFF_MS = 16 * 60_000
/** Shortest passcode accepted when a sheet is created. */
export const PASSCODE_MIN = 8

export interface SyncState {
  linked: boolean
  busy: boolean
  lastSync?: number
  /** Plain message for the last failure; local data is never touched by one. */
  error?: string
  /** Notes from the last run (skipped or renamed rows). */
  notes: string[]
}

/** Makes the adapter for a linked sheet (Google in the app, a fake sheet in tests). */
export type AdapterFactory = (spreadsheetId: string) => StorageAdapter

let state: SyncState = { linked: false, busy: false, notes: [] }
const listeners = new Set<(s: SyncState) => void>()
let idleWaiters: (() => void)[] = []
let makeAdapter: AdapterFactory | null = null
let canSync: () => boolean = () => true
let again = false
let backoff = 0
let nextAllowed = 0
let clock = Date.now

function set(p: Partial<SyncState>) {
  state = { ...state, ...p }
  if (!state.busy) { const w = idleWaiters; idleWaiters = []; w.forEach(f => f()) }
  listeners.forEach(l => l(state))
}

export const syncState = () => state
export function subscribe(l: (s: SyncState) => void) { listeners.add(l); return () => { listeners.delete(l) } }
export const isSyncBusy = () => state.busy

/**
 * Resolves once no sync is running. Add purchase saves wait on this, so a save is held
 * and written when the sync completes or fails, never during it (0015 Q4).
 */
export function whenIdle(): Promise<void> {
  return state.busy ? new Promise(r => idleWaiters.push(r)) : Promise.resolve()
}

/** Set up once: the adapter factory, a guard (signed in and visible), and a clock for tests. */
export async function configure(o: { adapter: AdapterFactory; canSync?: () => boolean; clock?: () => number }) {
  makeAdapter = o.adapter
  canSync = o.canSync ?? (() => true)
  clock = o.clock ?? Date.now
  const link = await db.syncConfig.get('link')
  set({ linked: !!link?.spreadsheetId, lastSync: link?.lastSync })
}

const message = (e: unknown) =>
  e instanceof PasscodeError || e instanceof AuthError || e instanceof RemoteError ? e.message
  : e instanceof RateLimitError ? 'Google is busy. Sync will try again in a few minutes.'
  : 'Something went wrong.'

/** One sync run if linked, signed in and visible; a request during a run queues one more run. */
export async function requestSync(): Promise<SyncResult | null> {
  if (!state.linked || !makeAdapter || !canSync()) return null
  if (state.busy) { again = true; return null }
  if (clock() < nextAllowed) return null
  const [link, key] = await Promise.all([db.syncConfig.get('link'), db.syncConfig.get('cryptoKey')])
  if (!link?.spreadsheetId || !key?.cryptoKey) { set({ linked: false }); return null }
  set({ busy: true, error: undefined })
  let result: SyncResult | null = null
  try {
    result = await syncOnce(makeAdapter(link.spreadsheetId), key.cryptoKey, clock)
    const lastSync = clock()
    await db.syncConfig.update('link', { lastSync })
    backoff = 0
    set({ busy: false, lastSync, notes: result.notes })
  } catch (e) {
    if (e instanceof RateLimitError) {
      backoff = Math.min(MAX_BACKOFF_MS, backoff ? backoff * 2 : SYNC_INTERVAL_MS)
      nextAllowed = clock() + backoff
    }
    // Never the raw error or response (security-v0.2 8.6, CWE-209).
    set({ busy: false, error: `Sync failed: ${message(e)} Your data on this device is safe.` })
  }
  if (again) { again = false; void requestSync() }
  return result
}

/** Create a new sheet's sync data, or link an existing one, and remember the key (0015 §5). */
export async function link(spreadsheetId: string, passcode: string, isNew: boolean) {
  if (!makeAdapter) throw new RemoteError('Sync isn’t available.')
  const adapter = makeAdapter(spreadsheetId)
  let salt: string | null
  if (isNew) salt = toBase64(newSalt())
  else {
    salt = await readSalt(adapter, clock())
    if (!salt) throw new PasscodeError('This sheet isn’t set up for Simple Budget. Choose a sheet the app created.')
  }
  const key = await deriveKey(passcode, fromBase64(salt))
  if (isNew) await initSheet(adapter, key, salt, clock())
  await db.transaction('rw', db.syncConfig, db.syncRecords, async () => {
    await db.syncRecords.clear()
    await db.syncConfig.put({ key: 'cryptoKey', cryptoKey: key })
    await db.syncConfig.put({ key: 'link', spreadsheetId })
  })
  set({ linked: true, lastSync: undefined, error: undefined, notes: [] })
  const r = await requestSync()
  // A wrong passcode for a linked sheet: forget it again, so nothing half-linked stays.
  if (!r && state.error && !isNew) { const why = state.error; await unlink(); throw new PasscodeError(why) }
}

/** Stop syncing on this device: the key and link are removed; local data stays (0015 §5). */
export async function unlink() {
  await db.transaction('rw', db.syncConfig, db.syncRecords, async () => {
    await db.syncConfig.clear()
    await db.syncRecords.clear()
  })
  set({ linked: false, lastSync: undefined, error: undefined, notes: [] })
}

/** Sync on open, every minute while visible, and when the app becomes visible again (0015 Q6). */
export function startSchedule(): () => void {
  void requestSync()
  const timer = setInterval(() => { if (document.visibilityState === 'visible') void requestSync() }, SYNC_INTERVAL_MS)
  const onVisible = () => { if (document.visibilityState === 'visible') void requestSync() }
  document.addEventListener('visibilitychange', onVisible)
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
}

/** Test hook: reset the module state. */
export function resetForTests() {
  state = { linked: false, busy: false, notes: [] }
  again = false; backoff = 0; nextAllowed = 0
}
