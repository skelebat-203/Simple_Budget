// Sync checks against the database and an in-memory sheet (0015 §8). IndexedDB is
// fake-indexeddb, installed by run.mjs before Dexie loads.
import { db, markTx, type SyncTab } from '../../src/storage/db'
import { badTreeRows, budgetItemRepo, categoryRepo, checkBackup, exportBackup, settingsRepo } from '../../src/storage/repository'
import { seedCategories } from '../../src/storage/seed'
import { RateLimitError } from '../../src/storage/sync/adapter'
import { OAUTH_URL, REDIRECT_PENDING_KEY } from '../../src/storage/sync/googleConfig'
import { accessToken, isSignedIn, readRedirect, signInRedirect, signOut } from '../../src/storage/sync/googleSheets'
import { neutralize, toCells, unneutralize } from '../../src/storage/sync/cells'
import { aadOf, decrypt, deriveKey, encrypt, newSalt } from '../../src/storage/sync/crypto'
import { MAX_ROWS_PER_TAB, TOMBSTONE_MS } from '../../src/storage/sync/engine'
import * as sync from '../../src/storage/sync/controller'
import { FakeSheet } from './fakeSheet'
import { buildTree } from '../../src/budget/tree'

type Check = (ok: boolean, msg: string) => void
const PASSCODE = 'correct horse battery'
const DAY_MS = 24 * 60 * 60 * 1000

/** The sync clock runs ahead of the real one when a test jumps time (tombstone purge, back-off). */
let offset = 0
const now = () => Date.now() + offset
const TICK_MS = 2
const WAIT_LIMIT_MS = 5000
/** Wait until the millisecond clock has moved on, so the next local write is strictly newer than anything before it.
    A timer can fire before Date.now() moves on, so a plain setTimeout isn't enough. */
const tick = async () => {
  const start = Date.now()
  do await new Promise(res => setTimeout(res, TICK_MS)); while (Date.now() <= start)
}
/** Wait (on real time, not a tick count) until `ok()` is true or the limit passes. */
const waitFor = async (ok: () => boolean) => {
  const end = Date.now() + WAIT_LIMIT_MS
  while (!ok() && Date.now() < end) await new Promise(res => setTimeout(res, TICK_MS))
}
const sheets = new Map<string, FakeSheet>()
const sheet = () => sheets.get('s1')!
const key = async () => (await db.syncConfig.get('cryptoKey'))!.cryptoKey!

async function wipe() {
  await db.transaction('rw', [db.categories, db.budgetItems, db.settings, db.syncRecords, db.syncConfig], async () => {
    await Promise.all([db.categories.clear(), db.budgetItems.clear(), db.settings.clear(), db.syncRecords.clear(), db.syncConfig.clear()])
  })
}
/** Read a sheet row's record as another device would. */
async function remoteRecord(tab: SyncTab, id: string) {
  const r = sheet().tabs[tab][sheet().rowOf(tab, id)]
  return { updatedAt: r[1] as number, deleted: r[2] as boolean, data: r[3] ? JSON.parse(await decrypt(await key(), aadOf(tab, id), unneutralize(String(r[3])))) : null }
}
/** Write a row as another device would (or a hand edit, with `raw`). */
async function remoteWrite(tab: SyncTab, id: string, updatedAt: number, deleted: boolean, data: unknown, raw?: string) {
  const content = raw ?? (deleted ? '' : await encrypt(await key(), aadOf(tab, id), JSON.stringify(data)))
  const cells = toCells(id, updatedAt, deleted, content)
  const i = sheet().rowOf(tab, id)
  await sheet().write([{ tab, row: i < 0 ? undefined : i + 1, cells }])
}
const syncNow = async () => { await tick(); return sync.requestSync() }
const catByName = async (name: string, parent?: string) => {
  const cats = await categoryRepo.list()
  const p = parent ? cats.find(c => c.name === parent) : undefined
  return cats.find(c => c.name === name && (!parent || c.parentId === p?.id))
}

export async function run(check: Check) {
  sync.resetForTests()
  await sync.configure({ adapter: id => { if (!sheets.has(id)) sheets.set(id, new FakeSheet()); return sheets.get(id)! }, clock: now })

  // ----- encryption -----
  const k = await deriveKey(PASSCODE, newSalt(), 1000)
  const sealed = await encrypt(k, aadOf('Purchases', 'a'), 'hello')
  check(await decrypt(k, aadOf('Purchases', 'a'), sealed) === 'hello', 'encryption round trip')
  const flipped = sealed.slice(0, 20) + (sealed[20] === 'A' ? 'B' : 'A') + sealed.slice(21)
  const rejects = async (f: () => Promise<unknown>) => { try { await f(); return false } catch { return true } }
  check(await rejects(() => decrypt(k, aadOf('Purchases', 'a'), flipped)), 'tampered ciphertext is rejected')
  check(await rejects(() => decrypt(k, aadOf('Purchases', 'b'), sealed)), 'content moved to another row is rejected')
  check(await rejects(async () => decrypt(await deriveKey('wrong passcode', newSalt(), 1000), aadOf('Purchases', 'a'), sealed)), 'wrong passcode is rejected')
  check(await rejects(() => crypto.subtle.exportKey('raw', k)), 'derived key is non-extractable')

  // ----- formula neutralizing (security-v0.2 2.3) -----
  check(['=1+1', '+abc', '-2', '@x'].every(s => neutralize(s) === `'${s}` && unneutralize(neutralize(s)) === s), 'cells starting with = + - @ get a leading apostrophe and read back unchanged')
  check(neutralize('abc') === 'abc' && unneutralize("'abc") === "'abc", 'other cells are written as they are')

  // ----- create a sheet and the first push -----
  await wipe()
  await seedCategories()
  await settingsRepo.get()
  const groceries = (await catByName('Groceries'))!
  await budgetItemRepo.add({ categoryId: groceries.id!, amount: 12.5, date: '2026-11-01', description: 'Milk' })
  await sync.link('s1', PASSCODE, true)
  const cats = await categoryRepo.list()
  check(sync.syncState().linked && !sync.syncState().error, 'new sheet linked without errors')
  check(sheet().data('Categories').length === cats.length && sheet().data('Purchases').length === 1 && sheet().data('Settings').length === 1,
    `first push: ${sheet().data('Categories').length} categories, ${sheet().data('Purchases').length} purchase, settings row`)
  const allCells = Object.values(sheet().tabs).flat(2).map(String)
  check(!allCells.some(c => c.includes('Groceries') || c.includes('Milk')), 'no names or descriptions in plain text in the sheet')
  check(allCells.every(c => !/^[=+\-@]/.test(c)), 'no cell starts with = + - or @')
  check(sheet().tabs.Settings.some(r => r[0] === '_salt') && sheet().tabs.Settings.some(r => r[0] === '_check'), 'Settings tab holds the salt and passcode check')
  check((await key()).extractable === false, 'stored key is a non-extractable CryptoKey in IndexedDB')
  check(sheet().reads === 1, `one batched read per sync (${sheet().reads})`)

  // ----- last-write-wins -----
  const gUid = groceries.uid!
  const g = await remoteRecord('Categories', gUid)
  await remoteWrite('Categories', gUid, now(), false, { ...g.data, name: 'Food' })
  await syncNow()
  check(!!(await catByName('Food')) && !(await catByName('Groceries')), 'newer remote edit is pulled')

  await tick()
  await categoryRepo.update((await catByName('Food'))!.id!, { name: 'Groceries' })
  await syncNow()
  check((await remoteRecord('Categories', gUid)).data.name === 'Groceries', 'newer local edit is pushed')

  // ----- moves (v0.7 step 11) -----
  await tick()
  const savings = (await catByName('Savings'))!
  const ins = (await catByName('Insurance'))!
  const ira = (await catByName('IRA', 'Savings'))!
  await categoryRepo.moveTo(groceries.id!, savings.id!, [])
  await categoryRepo.moveTo(ira.id!, ins.id!, [])
  const insKids = (await categoryRepo.list()).filter(c => c.parentId === ins.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  check(insKids.at(-1)?.id === ira.id, 'a moved row becomes its new parent’s last child')
  // Tables sort subcategories and items by name, whatever their stored order (v0.7 step 15d).
  const shown = buildTree(await categoryRepo.list()).flatMap(r => r.children).find(n => n.cat.id === ins.id)!.children.map(n => n.cat.name)
  check(shown.join() === [...shown].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })).join() && shown.includes('IRA'), `the tree lists items alphabetically (${shown.join(', ')})`)
  check((await budgetItemRepo.list()).every(i => i.categoryId === groceries.id), 'purchases stay with the moved row')
  const refuse = async (f: () => Promise<unknown>) => { try { await f(); return '' } catch (e) { return String((e as Error).message) } }
  const utilities = (await catByName('Utilities'))!, insCar = (await catByName('Car', 'Insurance'))!, maint = (await catByName('Maintenance'))!
  check((await refuse(() => categoryRepo.moveTo(ins.id!, utilities.id!, []))).includes('has items'), 'a subcategory with items can’t go inside another subcategory')
  check((await refuse(() => categoryRepo.moveTo(insCar.id!, maint.id!, []))).includes('already exists'), 'a name used at the destination is refused')
  check(badTreeRows(await db.categories.toArray()).size === 0, 'the tree check accepts the moved rows')
  await syncNow()
  check((await remoteRecord('Categories', gUid)).data.parentUid === savings.uid && (await remoteRecord('Categories', ira.uid!)).data.parentUid === ins.uid, 'sync pushes the moves (new parent)')
  const expenses = (await catByName('Expenses'))!
  const gRemote = await remoteRecord('Categories', gUid)
  await remoteWrite('Categories', gUid, now(), false, { ...gRemote.data, parentUid: expenses.uid })
  await syncNow()
  check((await db.categories.get(groceries.id!))?.parentId === expenses.id, 'a move on another device is pulled')
  const backup = checkBackup(JSON.parse(JSON.stringify(await exportBackup())))
  check(backup.categories.some(c => c.id === ira.id && c.parentId === ins.id), 'backup restore check accepts the moved rows')
  // A destination holding its own amounts hands them to a new Miscellaneous row first (as Budget setup does).
  await tick()
  const taxes = (await catByName('Taxes'))!
  await categoryRepo.update(taxes.id!, { estimate: 50, frequency: 'month' })
  const taxBuy = await budgetItemRepo.add({ categoryId: taxes.id!, amount: 7, date: '2026-11-02' })
  const hsa = (await catByName('HSA'))!
  const handed = await categoryRepo.moveTo(hsa.id!, taxes.id!, [{ id: hsa.id!, color: 'red' }])
  const taxKids = (await categoryRepo.list()).filter(c => c.parentId === taxes.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const taxMisc = taxKids.find(c => c.name === 'Miscellaneous')
  check(handed.movedFrom === 'Taxes' && taxKids.map(c => c.name).join() === 'Miscellaneous,HSA' && taxMisc?.estimate === 50 && taxMisc.frequency === 'month'
    && (await db.categories.get(taxes.id!))?.estimate === undefined && (await db.budgetItems.get(taxBuy))?.categoryId === taxMisc.id,
    `the destination’s own estimate and purchase move to Taxes › Miscellaneous; the moved row is last (${taxKids.map(c => c.name).join(', ')})`)
  await syncNow()
  check(!!taxMisc?.uid && (await remoteRecord('Categories', taxMisc.uid)).data.parentUid === taxes.uid && (await remoteRecord('Purchases', (await db.budgetItems.get(taxBuy))!.uid!)).data.categoryUid === taxMisc.uid,
    'sync pushes the new Miscellaneous row and the purchase on it')

  const local = (await catByName('Groceries'))!
  await remoteWrite('Categories', gUid, local.updatedAt!, false, { ...(await remoteRecord('Categories', gUid)).data, name: 'Tie Name' })
  await categoryRepo.update(local.id!, { estimate: 5 })
  await db.transaction('rw', db.categories, async tx => { markTx(tx, 'sync'); await db.categories.update(local.id!, { updatedAt: local.updatedAt }) }) // same time on both sides
  await syncNow()
  check(!!(await catByName('Tie Name')), 'a tie goes to the remote copy')

  // ----- tombstones -----
  const purchase = (await budgetItemRepo.list())[0]
  await budgetItemRepo.remove(purchase.id!)
  await syncNow()
  const tomb = await remoteRecord('Purchases', purchase.uid!)
  check(tomb.deleted && tomb.data === null, 'a local delete leaves a tombstone row with no content')

  const p2 = await budgetItemRepo.add({ categoryId: local.id!, amount: 3, date: '2026-11-02' })
  await syncNow()
  const p2uid = (await db.budgetItems.get(p2))!.uid!
  await remoteWrite('Purchases', p2uid, now(), true, null)
  await syncNow()
  check(!(await db.budgetItems.get(p2)), 'a remote tombstone deletes the local purchase')
  check(!!(await db.syncRecords.get(['Purchases', p2uid])), 'the tombstone is remembered')

  offset += TOMBSTONE_MS + DAY_MS
  await syncNow()
  check(sheet().rowOf('Purchases', purchase.uid!) < 0 && sheet().rowOf('Purchases', p2uid) < 0, 'tombstones older than 90 days are purged from the sheet')
  check(!(await db.syncRecords.get(['Purchases', p2uid])), 'purged tombstones are forgotten locally')

  // ----- untrusted rows (0015 §7.1): decrypt, then the import checks -----
  const before = JSON.stringify(await categoryRepo.list())
  const tamperRow = sheet().rowOf('Categories', gUid)
  const cell = String(sheet().tabs.Categories[tamperRow][3])
  sheet().tabs.Categories[tamperRow][3] = cell.slice(0, 30) + (cell[30] === 'A' ? 'B' : 'A') + cell.slice(31)
  let r = await syncNow()
  check(!!r?.notes.some(n => n.includes('couldn’t be read')) && JSON.stringify(await categoryRepo.list()) === before, 'a hand-edited encrypted cell is skipped with a note; local data unchanged')
  check((await remoteRecord('Categories', gUid)).data.name === 'Tie Name', 'the skipped row is repaired from this device')

  // A repeated row (e.g. copied by hand): the older copy is cleared from the sheet.
  const orig = sheet().tabs.Categories[sheet().rowOf('Categories', gUid)]
  sheet().tabs.Categories.push([orig[0], Number(orig[1]) - 1000, orig[2], orig[3]])
  r = await syncNow()
  check(sheet().tabs.Categories.filter(row => row[0] === gUid).length === 1 && !!r?.notes.some(n => n.includes('repeats')), 'a repeated row is removed from the sheet, with a note')

  const exp = (await catByName('Expenses'))!
  const badRows: [string, unknown][] = [
    ['bad-color', { name: 'Bad color', color: 'x" onclick="y', parentUid: exp.uid }],
    ['bad-estimate', { name: 'Bad estimate', color: 'orange', parentUid: exp.uid, estimate: 1e15 }],
    ['no-parent', { name: 'Orphan', color: 'orange', parentUid: 'missing-uid' }],
  ]
  for (const [id, data] of badRows) await remoteWrite('Categories', id, now(), false, data)
  await remoteWrite('Purchases', 'bad-amount', now(), false, { categoryUid: gUid, amount: 'abc', date: '2026-11-01', createdAt: now() })
  await remoteWrite('Purchases', 'bad-date', now(), false, { categoryUid: gUid, amount: 1, date: '11/01/2026', createdAt: now() })
  await remoteWrite('Purchases', 'future', now() + 30 * DAY_MS, false, { categoryUid: gUid, amount: 1, date: '2026-11-01', createdAt: now() })
  // Deeper than category › subcategory › item.
  const charity = (await catByName('Charity'))!
  const misc = (await catByName('Miscellaneous', 'Charity'))!
  await remoteWrite('Categories', 'too-deep', now(), false, { name: 'Too deep', color: 'orange', parentUid: misc.uid })
  const catsBefore = (await categoryRepo.list()).length, itemsBefore = (await budgetItemRepo.list()).length
  r = await syncNow()
  check((await categoryRepo.list()).length === catsBefore && (await budgetItemRepo.list()).length === itemsBefore,
    `rows failing the import checks reach nothing (${r?.notes.length} notes)`)
  check(!!charity && (r?.notes.length ?? 0) >= 7, 'each skipped row gets a note')
  for (const id of ['bad-color', 'bad-estimate', 'no-parent', 'too-deep']) sheet().tabs.Categories[sheet().rowOf('Categories', id)] = []
  for (const id of ['bad-amount', 'bad-date', 'future']) sheet().tabs.Purchases[sheet().rowOf('Purchases', id)] = []

  // A sheet with far too many rows is refused before any row is read; local data is untouched.
  const purchaseRows = sheet().tabs.Purchases.length
  for (let i = 0; i <= MAX_ROWS_PER_TAB; i++) sheet().tabs.Purchases.push(['junk', 1, false, 'x'])
  const itemsPre = JSON.stringify(await budgetItemRepo.list())
  r = await syncNow()
  check(r === null && /more than 50,000 rows/.test(sync.syncState().error ?? '') && JSON.stringify(await budgetItemRepo.list()) === itemsPre, 'a sheet with more than 50,000 rows in a tab is refused with a plain message')
  sheet().tabs.Purchases.length = purchaseRows

  // ----- name clash re-check inside the transaction (v0.5 3.2) -----
  await remoteWrite('Categories', 'clash-1', now(), false, { name: 'Gas', color: 'lighter-orange', parentUid: exp.uid })
  r = await syncNow()
  const gas = (await categoryRepo.list()).filter(c => c.parentId === exp.id && /^Gas/.test(c.name)).map(c => c.name).sort()
  check(gas.join(',') === 'Gas,Gas (2)' && !!r?.notes.some(n => n.includes('renamed')), `a sibling name clash gets a suffix and a note (${gas.join(', ')})`)
  check((await remoteRecord('Categories', 'clash-1')).data.name === 'Gas (2)', 'the renamed row is pushed back')

  // ----- a second device links the sheet: its default categories are matched, not doubled -----
  await tick()
  await categoryRepo.update((await catByName('Tie Name'))!.id!, { name: 'Groceries' })
  await budgetItemRepo.add({ categoryId: (await catByName('Groceries'))!.id!, amount: 4.25, date: '2026-11-04' })
  await syncNow()
  const rowsBefore = sheet().data('Categories').length
  const remoteCats = sheet().data('Categories').filter(row => !row[2]).length
  const remoteItems = sheet().data('Purchases').filter(row => !row[2]).length
  await sync.unlink()
  await wipe()
  await seedCategories()
  await sync.link('s1', PASSCODE, false)
  check((await categoryRepo.list()).length === remoteCats && (await budgetItemRepo.list()).length === remoteItems,
    `linking a sheet on a new device: ${remoteCats} categories and ${remoteItems} purchases, no duplicates`)
  check(sheet().data('Categories').length === rowsBefore && !sync.syncState().error, 'linking pushes no duplicate rows')

  // Wrong passcode on link: refused and nothing stays linked.
  await sync.unlink()
  let refused = ''
  try { await sync.link('s1', 'not the passcode', false) } catch (e) { refused = String(e instanceof Error ? e.message : e) }
  check(!!refused && !sync.syncState().linked && !(await db.syncConfig.get('cryptoKey')), `wrong passcode: refused (${refused}), key removed`)
  check(refused.includes('passcode doesn’t match'), 'a wrong passcode says so')
  // Network failure during the first sync on link: its own message, nothing left linked.
  let offline = ''
  sheet().failReadAt = sheet().reads + 2 // the salt read passes; the sync's read fails
  try { await sync.link('s1', PASSCODE, false) } catch (e) { offline = String(e instanceof Error ? e.message : e) }
  check(offline.includes('couldn’t be reached') && !offline.includes('passcode doesn’t match') && !sync.syncState().linked, `a network failure on link is not reported as a wrong passcode (${offline})`)
  await sync.link('s1', PASSCODE, false)

  // Two requests in the same moment start one run, not two: while the first run is held, only one read has started.
  const readsBefore = sheet().reads
  sheet().hold()
  const both = Promise.all([sync.requestSync(), sync.requestSync()])
  for (let i = 0; i < 200 && sheet().reads === readsBefore; i++) await new Promise(r => setTimeout(r, 5))
  await new Promise(r => setTimeout(r, 50))
  const concurrent = sheet().reads - readsBefore
  sheet().release()
  await both
  await sync.whenIdle()
  for (let i = 0; i < 200 && sync.isSyncBusy(); i++) await new Promise(r => setTimeout(r, 5))
  check(concurrent === 1, `simultaneous requests start one run (${concurrent} read(s) in flight)`)

  // ----- queued saves while a sync runs (0015 Q4) -----
  sheet().hold()
  const running = syncNow()
  await waitFor(sync.isSyncBusy)
  check(sync.isSyncBusy(), 'sync reports busy while it runs')
  const target = (await catByName('Groceries'))!
  let written = false
  const queued = sync.whenIdle().then(async () => { await budgetItemRepo.add({ categoryId: target.id!, amount: 9.99, date: '2026-11-03' }); written = true })
  await new Promise(res => setTimeout(res, 0))
  check(!written, 'an Add purchase save waits while the sync runs')
  sheet().release()
  await running
  await queued
  check(written && !sync.isSyncBusy(), 'the held save is written once the sync completes')

  sheet().failNext = new Error('offline')
  sheet().hold()
  const failing = syncNow()
  let written2 = false
  const queued2 = sync.whenIdle().then(() => { written2 = true })
  sheet().release()
  await failing
  await queued2
  check(written2 && !!sync.syncState().error?.includes('Your data on this device is safe'), 'a failed sync releases held saves and says local data is safe')

  // ----- quota back-off (0015 §7.1) -----
  sheet().failNext = new RateLimitError('429')
  await syncNow()
  const readsAfter429 = sheet().reads
  await syncNow()
  check(sheet().reads === readsAfter429, 'after a 429 the next sync waits for the back-off')
  offset += sync.SYNC_INTERVAL_MS + 1
  await syncNow()
  check(sheet().reads === readsAfter429 + 1 && !sync.syncState().error, 'sync resumes after the back-off')

  // ----- settings sync; onboarding stays per device -----
  await tick() // the edit must be strictly newer than the last settings write
  await settingsRepo.update({ weekStart: 3, onboarded: true })
  await syncNow()
  const s = await remoteRecord('Settings', 'settings')
  check(s.data.weekStart === 3 && !('onboarded' in s.data), 'settings sync; the onboarding mark stays on the device')

  // ----- unlink -----
  await sync.unlink()
  check(!(await db.syncConfig.get('cryptoKey')) && !(await db.syncConfig.get('link')) && (await categoryRepo.list()).length > 0, 'unlink removes the key and link; local data stays')

  await redirectSignInChecks(check)
}

/** Redirect sign-in (D004): the page's `location`, `history` and `sessionStorage` are stand-ins. */
async function redirectSignInChecks(check: Check) {
  const g = globalThis as Record<string, unknown>
  const store = new Map<string, string>()
  const page = { origin: 'https://example.test', pathname: '/Simple_Budget/', search: '', hash: '', assigned: '' }
  const fake = {
    location: { ...page, assign(url: string) { page.assigned = url } },
    history: { replaceState() { fake.location.hash = '' } },
    sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } },
  }
  for (const [k, v] of Object.entries({ ...fake, window: globalThis })) Object.defineProperty(g, k, { value: v, configurable: true, writable: true })
  const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file')
  const back = (hash: string) => { fake.location.hash = `#${hash}`; return readRedirect() }
  const leave = (to: 'backup' | 'wizard') => { signInRedirect(to); return new URL(page.assigned).searchParams }

  signOut()
  const sent = leave('wizard')
  const state = sent.get('state') ?? ''
  check(page.assigned.startsWith(OAUTH_URL) && sent.get('response_type') === 'token' && sent.get('scope') === 'https://www.googleapis.com/auth/drive.file'
    && !!sent.get('redirect_uri')?.startsWith('https://example.test/') && !sent.get('redirect_uri')?.includes('#'), 'redirect sign-in asks Google for a token with the app’s own address as the return')
  check(!!state && !page.assigned.includes('access_token') && !store.get(REDIRECT_PENDING_KEY)?.includes('token'), 'only a random state is kept across the redirect, never a token')

  const ok = back(`access_token=tok&expires_in=3599&scope=${scope}&state=${state}&token_type=Bearer`)
  check(ok?.returnTo === 'wizard' && !ok.error && isSignedIn() && accessToken() === 'tok', 'a return with the right state signs in and says where to go back to')
  check(fake.location.hash === '' && !store.has(REDIRECT_PENDING_KEY), 'the token is removed from the address and the pending state is cleared')

  signOut()
  leave('backup')
  check(back(`access_token=forged&expires_in=3599&scope=${scope}&state=wrong`) === null && !isSignedIn(), 'a return with a different state is ignored')
  check(back(`access_token=forged&state=${state}`) === null && !isSignedIn(), 'a return with no pending sign-in is ignored')

  const denied = (() => { const s = leave('backup').get('state'); return back(`error=access_denied&state=${s}`) })()
  check(denied?.returnTo === 'backup' && !!denied.error?.includes('wasn’t granted') && !isSignedIn(), 'a refusal on Google’s page gives our message and no sign-in')
  const unticked = (() => { const s = leave('backup').get('state'); return back(`access_token=tok&expires_in=3599&scope=openid&state=${s}`) })()
  check(!!unticked?.error?.includes('left unticked') && !isSignedIn(), 'the sync permission left unticked is reported and gives no sign-in')
  signOut()
}
