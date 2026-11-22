import { db, markTx, type BudgetItem, type Category, type Settings, type SyncRecord, type SyncTab } from '../db'
import { badTreeRows, cleanSettings, validCategory, validItem } from '../repository'
import { cleanDescription, cleanName, slug } from '../../budget/validate'
import type { CellWrite, StorageAdapter } from './adapter'
import { aadOf, CHECK_TEXT, decrypt, encrypt } from './crypto'
import { CHECK_ID, FIRST_DATA_ROW, HEADER, META_PREFIX, parseRow, SALT_ID, SETTINGS_UID, TABS, toCells } from './cells'

/** Tombstones are kept this long, then purged (0015 Q7). */
export const TOMBSTONE_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000
export const TOMBSTONE_MS = TOMBSTONE_DAYS * DAY_MS
/** Longest encrypted cell read; anything larger is not ours. */
export const MAX_CONTENT_CHARS = 20_000
/** Cap on the tree-check passes (each pass drops at least one bad row). */
const MAX_PASSES = 50
const COLOR_RE = /^[a-z][a-z-]{0,39}$/

/** The sheet isn't set up for sync, or the passcode doesn't match it. */
export class PasscodeError extends Error {}

export interface SyncResult {
  pulled: number
  pushed: number
  purged: number
  /** Plain-language notes for rows that were skipped, renamed or kept (0015 §4, Q4). */
  notes: string[]
}

type Clock = () => number

interface Remote { row: number; updatedAt: number; deleted: boolean; data?: unknown; error?: string }
interface Push { tab: SyncTab; uid: string; updatedAt: number; deleted: boolean; data?: unknown }

// ---------- record content (what the encrypted column holds) ----------

const CAT_KEYS = ['computed', 'order', 'selected', 'rollup', 'estimate', 'frequency', 'autopay', 'dueDate', 'dueWeekday', 'dueDay', 'dueDay2'] as const

function catContent(c: Category, parentUid: string | null) {
  const out: Record<string, unknown> = { name: c.name, color: c.color, parentUid }
  for (const k of CAT_KEYS) if (c[k] !== undefined) out[k] = c[k]
  return out
}

/** A pulled category, checked like an import or a restored backup; null when it fails. */
function readCat(data: unknown): { cat: Category; parentUid: string | null } | null {
  const x = data as Record<string, unknown>
  if (!x || typeof x !== 'object' || typeof x.name !== 'string' || typeof x.color !== 'string' || !COLOR_RE.test(x.color)) return null
  if (x.parentUid !== null && typeof x.parentUid !== 'string') return null
  const cat: Category = { name: cleanName(x.name), color: x.color, parentId: null }
  for (const k of CAT_KEYS) if (x[k] !== undefined) (cat as unknown as Record<string, unknown>)[k] = x[k]
  if (!cat.name || !validCategory(cat)) return null
  return { cat, parentUid: x.parentUid as string | null }
}

const itemContent = (i: BudgetItem, categoryUid: string) => ({
  categoryUid, amount: i.amount, date: i.date, createdAt: i.createdAt,
  ...(i.description ? { description: i.description } : {}), ...(i.undated ? { undated: true } : {}),
})

function readItem(data: unknown): { item: Omit<BudgetItem, 'categoryId'>; categoryUid: string } | null {
  const x = data as Record<string, unknown>
  if (!x || typeof x !== 'object' || typeof x.categoryUid !== 'string' || typeof x.createdAt !== 'number' || !Number.isFinite(x.createdAt)) return null
  const description = typeof x.description === 'string' ? cleanDescription(x.description) : undefined
  if (x.description !== undefined && typeof x.description !== 'string') return null
  const item = { categoryId: 0, amount: x.amount as number, date: x.date as string, createdAt: x.createdAt, updatedAt: 0,
    ...(description ? { description } : {}), ...(x.undated === true ? { undated: true } : {}) }
  if (x.undated !== undefined && typeof x.undated !== 'boolean') return null
  if (!validItem(item)) return null
  const { categoryId: _drop, ...rest } = item
  return { item: rest, categoryUid: x.categoryUid }
}

/** Synced settings: `onboarded` stays per device. */
const settingsContent = (s: Settings) => ({ rewardsEnabled: s.rewardsEnabled, notificationsEnabled: s.notificationsEnabled, defaultRange: s.defaultRange, weekStart: s.weekStart, monthBoundary: s.monthBoundary })

function readSettings(data: unknown): Partial<Settings> | null {
  const x = data as Record<string, unknown>
  if (!x || typeof x !== 'object' || typeof x.rewardsEnabled !== 'boolean' || typeof x.notificationsEnabled !== 'boolean') return null
  const { rewardsEnabled, notificationsEnabled, defaultRange, weekStart, monthBoundary } = cleanSettings(x as Partial<Settings>)
  return { rewardsEnabled, notificationsEnabled, defaultRange, weekStart, monthBoundary }
}

// ---------- sheet setup ----------

/** Write the headers, the salt and the passcode check into a new, empty sheet (0015 §5). */
export async function initSheet(adapter: StorageAdapter, key: CryptoKey, salt: string, now: number) {
  const writes: CellWrite[] = TABS.map(tab => ({ tab, row: 1, cells: HEADER }))
  writes.push({ tab: 'Settings', row: FIRST_DATA_ROW, cells: toCells(SALT_ID, now, false, salt) })
  writes.push({ tab: 'Settings', row: FIRST_DATA_ROW + 1, cells: toCells(CHECK_ID, now, false, await encrypt(key, aadOf('Settings', CHECK_ID), CHECK_TEXT)) })
  await adapter.write(writes)
}

/** The salt of a linked sheet, or null when the sheet isn't set up for sync. */
export async function readSalt(adapter: StorageAdapter, now: number): Promise<string | null> {
  const sheet = await adapter.read()
  for (const r of sheet.Settings) {
    const p = parseRow(r.row, r.cells, now)
    if (p && !('error' in p) && p.id === SALT_ID && p.content) return p.content
  }
  return null
}

// ---------- one sync run: pull, merge, push (0015 §4) ----------

export async function syncOnce(adapter: StorageAdapter, key: CryptoKey, clock: Clock = Date.now): Promise<SyncResult> {
  const now = clock()
  const notes: string[] = []
  const sheet = await adapter.read()

  // Pull: every row is untrusted. Decrypt first (outside the database transaction, which
  // can't wait on Web Crypto), then the import-style checks run inside it.
  const remote = Object.fromEntries(TABS.map(t => [t, new Map<string, Remote>()])) as Record<SyncTab, Map<string, Remote>>
  let check: string | undefined
  const dupClears: { tab: SyncTab; row: number }[] = []
  for (const tab of TABS) {
    for (const raw of sheet[tab]) {
      if (raw.row < FIRST_DATA_ROW) continue
      const p = parseRow(raw.row, raw.cells, now)
      if (!p) continue
      if ('error' in p) {
        notes.push(`${tab} row ${p.row} ${p.error}, so it was skipped.`)
        if (p.id && !p.id.startsWith(META_PREFIX)) remote[tab].set(p.id, { row: p.row, updatedAt: 0, deleted: false, error: p.error })
        continue
      }
      if (p.id.startsWith(META_PREFIX)) { if (tab === 'Settings' && p.id === CHECK_ID) check = p.content; continue }
      const prior = remote[tab].get(p.id)
      if (prior) {
        // A repeated row: keep the newer copy and clear the older one from the sheet.
        notes.push(`${tab} row ${p.row} repeats an earlier row, so the older copy was removed.`)
        if (prior.updatedAt >= p.updatedAt) { dupClears.push({ tab, row: p.row }); continue }
        dupClears.push({ tab, row: prior.row })
      }
      const r: Remote = { row: p.row, updatedAt: p.updatedAt, deleted: p.deleted }
      if (!p.deleted) {
        try {
          if (p.content.length > MAX_CONTENT_CHARS) throw new Error('too long')
          r.data = JSON.parse(await decrypt(key, aadOf(tab, p.id), p.content))
        } catch {
          r.error = 'couldn’t be read (it may have been edited by hand)'
          notes.push(`${tab} row ${p.row} ${r.error}, so it was skipped.`)
        }
      }
      remote[tab].set(p.id, r)
    }
  }
  try {
    if (!check || await decrypt(key, aadOf('Settings', CHECK_ID), check) !== CHECK_TEXT) throw new Error('no match')
  } catch {
    throw new PasscodeError('The passcode doesn’t match this sheet, or the sheet isn’t set up for Simple Budget.')
  }

  const merged = await db.transaction('rw', [db.categories, db.budgetItems, db.settings, db.syncRecords], async tx => {
    markTx(tx, 'sync')
    return mergeLocal(remote, now, notes)
  })

  // Push: encrypt the records the merge chose, then one batched write.
  const writes: CellWrite[] = []
  for (const p of merged.pushes) {
    const content = p.deleted ? '' : await encrypt(key, aadOf(p.tab, p.uid), JSON.stringify(p.data))
    writes.push({ tab: p.tab, row: remote[p.tab].get(p.uid)?.row, cells: toCells(p.uid, p.updatedAt, p.deleted, content) })
  }
  for (const c of [...dupClears, ...merged.clears]) writes.push({ tab: c.tab, row: c.row, cells: ['', '', '', ''] })
  if (writes.length) await adapter.write(writes)
  return { pulled: merged.pulled, pushed: merged.pushes.length, purged: merged.clears.length, notes }
}

/** The merge, inside one write transaction so every check sees the current data (security-v0.5 3.2). */
async function mergeLocal(remote: Record<SyncTab, Map<string, Remote>>, now: number, notes: string[]) {
  const [cats, items, settingsRows, known] = await Promise.all([db.categories.toArray(), db.budgetItems.toArray(), db.settings.toArray(), db.syncRecords.toArray()])
  const knownOf = (tab: SyncTab) => new Map(known.filter(k => k.tab === tab).map(k => [k.uid, k]))
  const pushes: Push[] = []
  const finalState: SyncRecord[] = []
  const clears: { tab: SyncTab; row: number }[] = []
  const dropKnown: [SyncTab, string][] = []
  let pulled = 0
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const expired = (t: number) => t < now - TOMBSTONE_MS

  /** Local tombstones: records this device knew of that are gone now, or already-known deletes. */
  function deadOf(tab: SyncTab, live: Set<string>) {
    const dead = new Map<string, number>()
    for (const k of knownOf(tab).values()) if (!live.has(k.uid)) dead.set(k.uid, k.deleted ? k.updatedAt : now)
    return dead
  }
  /** Shared last-write-wins decision for one record; ties go to the remote copy. */
  function decide(localAt: number | undefined, deadAt: number | undefined, r: Remote | undefined, sameContent: () => boolean, forcePull = false): 'pushLive' | 'pushDead' | 'pull' | 'pullDelete' | 'same' | 'none' {
    const lt = localAt ?? deadAt
    if (r?.error) return localAt != null ? 'pushLive' : deadAt != null ? 'pushDead' : 'none'
    if (!r) return localAt != null ? 'pushLive' : deadAt != null ? 'pushDead' : 'none'
    if (lt == null || r.updatedAt >= lt || forcePull) {
      if (!forcePull && lt === r.updatedAt && (deadAt != null) === r.deleted && sameContent()) return 'same'
      return r.deleted ? 'pullDelete' : 'pull'
    }
    return localAt != null ? 'pushLive' : 'pushDead'
  }
  const tombstone = (tab: SyncTab, uid: string, at: number, r: Remote | undefined) => {
    if (expired(at)) {
      if (r) clears.push({ tab, row: r.row })
      dropKnown.push([tab, uid])
    } else finalState.push({ tab, uid, updatedAt: at, deleted: true })
  }

  // ----- categories -----
  interface V { uid: string; id?: number; cat: Category; parentUid: string | null; updatedAt: number; orig?: V; fromRemote?: boolean; push?: boolean }
  const uidOfId = new Map(cats.map(c => [c.id!, c.uid!]))
  const tree = new Map<string, V>()
  for (const c of cats) {
    if (!c.uid) continue
    const v: V = { uid: c.uid, id: c.id, cat: c, parentUid: c.parentId == null ? null : uidOfId.get(c.parentId) ?? null, updatedAt: c.updatedAt ?? 1 }
    v.orig = { ...v }
    tree.set(c.uid, v)
  }
  const catKnown = knownOf('Categories')
  const catDead = deadOf('Categories', new Set(tree.keys()))
  const rCats = remote.Categories

  // A device linking a sheet for the first time already has its own copy of the default
  // categories: a local row never synced takes the id of the sheet's row with the same
  // name under the same parent, instead of becoming a second "Income" (parents first).
  const adopted = new Set<string>()
  for (let changed = true; changed;) {
    changed = false
    for (const [uid, r] of rCats) {
      if (tree.has(uid) || catDead.has(uid) || catKnown.has(uid) || r.deleted || r.error) continue
      const rc = readCat(r.data)
      if (!rc || (rc.parentUid != null && !tree.has(rc.parentUid))) continue
      const match = [...tree.values()].find(v => !catKnown.has(v.uid) && !rCats.has(v.uid) && v.parentUid === rc.parentUid && slug(v.cat.name) === slug(rc.cat.name))
      if (!match) continue
      tree.delete(match.uid)
      for (const v of tree.values()) if (v.parentUid === match.uid) v.parentUid = uid
      match.uid = uid // orig keeps the old uid, so the write below stores the new one
      tree.set(uid, match)
      adopted.add(uid)
      changed = true
    }
  }

  const catDeletes = new Set<string>()
  for (const uid of new Set([...tree.keys(), ...rCats.keys(), ...catDead.keys()])) {
    const v = tree.get(uid), r = rCats.get(uid), dead = catDead.get(uid)
    // An adopted row takes the sheet's version: the sheet is what the device linked to.
    const d = decide(v?.updatedAt, v ? undefined : dead, r, () => !v || same(catContent(v.cat, v.parentUid), r?.data), adopted.has(uid))
    if (d === 'pushLive') v!.push = true
    else if (d === 'pushDead') tombstone('Categories', uid, dead!, r) // pushed below unless expired
    else if (d === 'same') { if (v) finalState.push({ tab: 'Categories', uid, updatedAt: v.updatedAt, deleted: false }); else tombstone('Categories', uid, r!.updatedAt, r) }
    else if (d === 'pullDelete') { if (v) catDeletes.add(uid); else tombstone('Categories', uid, r!.updatedAt, r) }
    else if (d === 'pull') {
      const rc = readCat(r!.data)
      if (!rc) { notes.push(`Categories row ${r!.row} has content that isn’t valid, so it was skipped.`); if (v) v.push = true; continue }
      const next: V = { uid, id: v?.id, cat: { ...rc.cat, ...(v ? { id: v.id } : {}) }, parentUid: rc.parentUid, updatedAt: r!.updatedAt, orig: v?.orig, fromRemote: true }
      tree.set(uid, next)
    }
    if (d === 'pushDead' && !expired(dead!)) pushes.push({ tab: 'Categories', uid, updatedAt: dead!, deleted: true })
  }

  const revert = (v: V, why: string) => {
    notes.push(`A category from the sheet (“${v.cat.name}”) ${why}, so it was skipped.`)
    if (v.orig) tree.set(v.uid, { ...v.orig, uid: v.uid, orig: v.orig, push: true })
    else tree.delete(v.uid)
  }
  // Purchases that will still be here after the merge (used by the delete check).
  const rItems = remote.Purchases
  const itemSurvives = (i: BudgetItem) => {
    const r = i.uid ? rItems.get(i.uid) : undefined
    return !(r && !r.error && r.deleted && r.updatedAt >= i.updatedAt)
  }
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false
    // A delete from the sheet is refused while the row still has items or purchases here.
    for (const uid of catDeletes) {
      const v = tree.get(uid)!
      const inUse = [...tree.values()].some(c => c.parentUid === uid && !catDeletes.has(c.uid))
        || (v.id != null && items.some(i => i.categoryId === v.id && itemSurvives(i)))
      if (inUse) {
        catDeletes.delete(uid)
        notes.push(`“${v.cat.name}” was deleted on another device but still has items or purchases here, so it was kept.`)
        v.updatedAt = now; v.push = true
        changed = true
      }
    }
    // Parents must exist; no loops; no deeper than the app supports (security-v0.3 3.1).
    for (const v of [...tree.values()]) {
      if (v.parentUid != null && (!tree.has(v.parentUid) || catDeletes.has(v.parentUid)) && !catDeletes.has(v.uid)) {
        if (v.fromRemote) revert(v, 'has no parent here')
        else { notes.push(`“${v.cat.name}” lost its parent on another device, so it was kept.`); catDeletes.delete(v.parentUid!); const p = tree.get(v.parentUid!); if (p) { p.updatedAt = now; p.push = true } }
        changed = true
      }
    }
    const list = [...tree.values()].filter(v => !catDeletes.has(v.uid))
    const num = new Map(list.map((v, i) => [v.uid, i + 1]))
    const bad = badTreeRows(list.map(v => ({ ...v.cat, id: num.get(v.uid), parentId: v.parentUid == null ? null : num.get(v.parentUid) ?? null })))
    for (const v of list) if (bad.has(num.get(v.uid)!) && v.fromRemote) { revert(v, 'is nested in a loop or too deep'); changed = true }
    if (!changed) break
  }

  // Sibling names must stay unique: a clash gets a suffix and a note, never a silent drop (v0.5 3.2).
  const groups = new Map<string, V[]>()
  for (const v of tree.values()) {
    if (catDeletes.has(v.uid)) continue
    const k = `${v.parentUid ?? ''}|${slug(v.cat.name)}`
    groups.set(k, [...(groups.get(k) ?? []), v])
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue
    list.sort((a, b) => Number(!!a.fromRemote) - Number(!!b.fromRemote) || a.updatedAt - b.updatedAt)
    const taken = new Set([...tree.values()].filter(v => v.parentUid === list[0].parentUid).map(v => slug(v.cat.name)))
    for (const v of list.slice(1)) {
      let n = 2, name = ''
      do { name = cleanName(`${v.cat.name} (${n++})`) } while (taken.has(slug(name)))
      taken.add(slug(name))
      notes.push(`Two categories were both named “${v.cat.name}”, so one was renamed “${name}”.`)
      v.cat = { ...v.cat, name }
      v.updatedAt = now; v.push = true
    }
  }

  // Write the categories: deletes, then new rows parents-first, then changed rows.
  for (const uid of catDeletes) {
    await db.categories.delete(tree.get(uid)!.id!)
    tree.delete(uid)
    pulled++
    tombstone('Categories', uid, rCats.get(uid)!.updatedAt, rCats.get(uid))
  }
  const fresh = [...tree.values()].filter(v => v.id == null)
  while (fresh.length) {
    const i = fresh.findIndex(v => v.parentUid == null || tree.get(v.parentUid)?.id != null)
    if (i < 0) break // unreachable: parents were checked above
    const [v] = fresh.splice(i, 1)
    const { id: _id, ...row } = v.cat
    v.id = await db.categories.add({ ...row, uid: v.uid, parentId: v.parentUid == null ? null : tree.get(v.parentUid)!.id!, updatedAt: v.updatedAt })
    pulled++
  }
  for (const v of tree.values()) {
    const parentId = v.parentUid == null ? null : tree.get(v.parentUid)!.id!
    const o = v.orig
    const changed = !o || o.uid !== v.uid || o.updatedAt !== v.updatedAt || o.cat !== v.cat || o.parentUid !== v.parentUid
    if (changed && o) {
      await db.categories.put({ ...v.cat, id: v.id, uid: v.uid, parentId, updatedAt: v.updatedAt })
      if (v.fromRemote) pulled++
    }
    if (v.push) pushes.push({ tab: 'Categories', uid: v.uid, updatedAt: v.updatedAt, deleted: false, data: catContent(v.cat, v.parentUid) })
    finalState.push({ tab: 'Categories', uid: v.uid, updatedAt: v.updatedAt, deleted: false })
  }
  const catIdOf = (uid: string) => tree.get(uid)?.id
  const catUidOf = new Map([...tree.values()].map(v => [v.id!, v.uid]))

  // ----- purchases -----
  const itemByUid = new Map(items.filter(i => i.uid).map(i => [i.uid!, i]))
  const itemDead = deadOf('Purchases', new Set(itemByUid.keys()))
  for (const uid of new Set([...itemByUid.keys(), ...rItems.keys(), ...itemDead.keys()])) {
    const l = itemByUid.get(uid), r = rItems.get(uid), dead = itemDead.get(uid)
    const d = decide(l?.updatedAt, l ? undefined : dead, r, () => !l || same(itemContent(l, catUidOf.get(l.categoryId) ?? ''), r?.data))
    const pushLocal = () => {
      const cu = catUidOf.get(l!.categoryId)
      if (!cu) return // its category is gone; the next read reports it
      pushes.push({ tab: 'Purchases', uid, updatedAt: l!.updatedAt, deleted: false, data: itemContent(l!, cu) })
      finalState.push({ tab: 'Purchases', uid, updatedAt: l!.updatedAt, deleted: false })
    }
    if (d === 'pushLive') pushLocal()
    else if (d === 'pushDead') { tombstone('Purchases', uid, dead!, r); if (!expired(dead!)) pushes.push({ tab: 'Purchases', uid, updatedAt: dead!, deleted: true }) }
    else if (d === 'same') { if (l) finalState.push({ tab: 'Purchases', uid, updatedAt: l.updatedAt, deleted: false }); else tombstone('Purchases', uid, r!.updatedAt, r) }
    else if (d === 'pullDelete') { if (l) { await db.budgetItems.delete(l.id!); pulled++ } tombstone('Purchases', uid, r!.updatedAt, r) }
    else if (d === 'pull') {
      const ri = readItem(r!.data)
      const categoryId = ri && catIdOf(ri.categoryUid)
      if (!ri || categoryId == null) {
        notes.push(`Purchases row ${r!.row} ${ri ? 'belongs to a category that isn’t here' : 'has content that isn’t valid'}, so it was skipped.`)
        if (l) pushLocal()
        continue
      }
      await db.budgetItems.put({ ...ri.item, categoryId, uid, updatedAt: r!.updatedAt, ...(l ? { id: l.id } : {}) })
      finalState.push({ tab: 'Purchases', uid, updatedAt: r!.updatedAt, deleted: false })
      pulled++
    }
  }

  // ----- settings (one record) -----
  const local = settingsRows[0]
  const rs = remote.Settings.get(SETTINGS_UID)
  const localAt = local ? local.updatedAt ?? 1 : undefined
  const d = decide(localAt, undefined, rs, () => !local || same(settingsContent(cleanSettings(local)), rs?.data))
  if (d === 'pushLive') {
    pushes.push({ tab: 'Settings', uid: SETTINGS_UID, updatedAt: localAt!, deleted: false, data: settingsContent(cleanSettings(local!)) })
    finalState.push({ tab: 'Settings', uid: SETTINGS_UID, updatedAt: localAt!, deleted: false })
  } else if (d === 'pull') {
    const s = readSettings(rs!.data)
    if (!s) {
      notes.push(`Settings row ${rs!.row} has content that isn’t valid, so it was skipped.`)
      if (local) pushes.push({ tab: 'Settings', uid: SETTINGS_UID, updatedAt: localAt!, deleted: false, data: settingsContent(cleanSettings(local)) })
    } else {
      const base = cleanSettings(local ?? {})
      await db.settings.put({ ...base, ...s, ...(local?.id != null ? { id: local.id } : {}), updatedAt: rs!.updatedAt })
      finalState.push({ tab: 'Settings', uid: SETTINGS_UID, updatedAt: rs!.updatedAt, deleted: false })
      pulled++
    }
  } else if (d === 'same') finalState.push({ tab: 'Settings', uid: SETTINGS_UID, updatedAt: rs!.updatedAt, deleted: false })

  // What this device now knows; expired tombstones are forgotten.
  await db.syncRecords.clear()
  await db.syncRecords.bulkPut(finalState.filter(s => !dropKnown.some(([t, u]) => t === s.tab && u === s.uid)))
  return { pushes, clears, pulled }
}
