import Dexie, { type Table } from 'dexie'
import { isPreselected } from './preselected'
import { cleanName } from '../budget/validate'
import { toV7Structure } from './structure'

/** Recurrence of an estimate. Bi-monthly means twice a month. Quarter/annual: bill groups only (0007 §3). */
export type Frequency = 'day' | 'week' | 'biweek' | 'bimonthly' | 'month' | 'quarter' | 'annual'

/** Budget table display range. Day is only the table under Add purchase (v0.7 step 15d); Annual is never a default range (0007 §7.4). */
export type Range = 'day' | 'week' | 'month' | 'annual'
/** The Budget screen's ranges. */
export type BudgetRange = Exclude<Range, 'day'>
export type DefaultRange = Exclude<BudgetRange, 'annual'>

/** One recorded amount (a purchase, paycheck, credit…). Negative = credit. */
export interface BudgetItem {
  id?: number
  /** Random UUID shared across synced devices (0015 §4, security-v0.2 8.8). Set by the creating hook. */
  uid?: string
  /** Category-tree node the amount belongs to (an item, or a subcategory that takes amounts directly). */
  categoryId: number
  amount: number
  /** Local date, YYYY-MM-DD. */
  date: string
  /** Optional note on the purchase (0009 §4); shown in the Day table. */
  description?: string
  /** Imported without a date in the file, so placed on the first day of its week or month (0013 §5). Not indexed. */
  undated?: boolean
  /** When it was added; the Day table shows this time and sorts by it (imports use the sheet's Time, 0013 Q10). */
  createdAt: number
  updatedAt: number
}

/**
 * Node in the category tree (0004-table-design.md). Categories, subcategories
 * and items are all nodes; the estimate fields describe the node, not a single
 * amount, so they live here.
 */
export interface Category {
  id?: number
  /** Random UUID shared across synced devices (0015 §4). Set by the creating hook. */
  uid?: string
  /** Last local or synced change (ms); set by the hooks (0015 §4 last-write-wins). */
  updatedAt?: number
  name: string
  /** Color token suffix, e.g. 'lighter-orange' → `clr-lighter-orange`. */
  color: string
  /** Parent node id, null for top-level categories. */
  parentId: number | null
  /**
   * Top-level total rows (Income, Net Income, Savings, Expenses). A subcategory
   * is a total exactly when it has items (`isTotal` in tree.ts), so it isn't stored.
   */
  computed?: boolean
  /** Position among siblings, 0 first (0007 §5.3). */
  order?: number
  /** Picked in Budget setup as a regularly used item. */
  selected?: boolean
  /** Charity only: once set, Charity only totals its children and purchases are kept in Miscellaneous (0009 §6). */
  rollup?: boolean
  estimate?: number
  frequency?: Frequency
  autopay?: boolean
  /**
   * Schedule (0008 §3.2). Which fields apply depends on `frequency`; changing the
   * frequency clears the ones that no longer fit (`scheduleClears` in tree.ts).
   * `dueDate`: date of the next payment, YYYY-MM-DD (Every 2 weeks, Quarterly, Annual).
   */
  dueDate?: string
  /** Weekly: weekday of the payment, 0 = Sunday … 6 = Saturday. */
  dueWeekday?: number
  /** Monthly: day of the month (1–27 or 'last'). Bi-monthly: 1st payment (1–15). */
  dueDay?: DueDay
  /** Bi-monthly: 2nd payment (16–27 or 'last'). */
  dueDay2?: DueDay
}

/** Day of the month a payment is due; 'last' is the month's last day. */
export type DueDay = number | 'last'

export interface Settings {
  id?: number
  /** Last local or synced change (ms); set by the hooks. */
  updatedAt?: number
  rewardsEnabled: boolean
  notificationsEnabled: boolean
  /** Set when the onboarding questionnaire was finished or skipped (0008 §8). */
  onboarded?: boolean
  defaultRange?: DefaultRange
  /** Day a week starts on, 0 = Sunday … 6 = Saturday (0007 §1.1). */
  weekStart?: number
  /** 'weeks': months span whole weeks; 'calendar': the 1st to the last day (0007 §1.2). */
  monthBoundary?: MonthBoundary
}

export type MonthBoundary = 'weeks' | 'calendar'

/** Sheet tab a synced record lives in (0015 §3). */
export type SyncTab = 'Categories' | 'Purchases' | 'Settings'

/**
 * What this device last knew of a synced record: lets the sync tell a local delete
 * from a record it never had, and holds local tombstones until they are purged (0015 §4).
 */
export interface SyncRecord {
  tab: SyncTab
  uid: string
  updatedAt: number
  deleted: boolean
}

/** Sync link and key, one row each by `key` (0015 §5: the key is a non-extractable CryptoKey). */
export interface SyncConfig {
  key: 'link' | 'cryptoKey'
  spreadsheetId?: string
  lastSync?: number
  cryptoKey?: CryptoKey
}

/**
 * How the hooks treat a transaction's writes: 'sync' keeps the uid and updatedAt it is
 * given (pulled rows); 'restore' keeps the uid but stamps the time (a backup is the user's
 * newest intent). Unmarked writes get a fresh uid on create and the current time.
 */
type TxMode = 'sync' | 'restore'
const txModes = new WeakMap<object, TxMode>()
export function markTx(tx: object, mode: TxMode) { txModes.set(tx, mode) }
function modeOf(tx: unknown): TxMode | undefined {
  for (let t = tx as { parent?: unknown } | undefined; t; t = t.parent as typeof t) {
    const m = txModes.get(t)
    if (m) return m
  }
  return undefined
}
const newUid = () => crypto.randomUUID()

class SimpleBudgetDB extends Dexie {
  budgetItems!: Table<BudgetItem, number>
  categories!: Table<Category, number>
  settings!: Table<Settings, number>
  syncRecords!: Table<SyncRecord, [SyncTab, string]>
  syncConfig!: Table<SyncConfig, string>

  constructor() {
    super('simple-budget')
    this.version(1).stores({ budgetItems: '++id, name, category, type, date', categories: '++id, name', settings: '++id' })
    this.version(2).stores({ categories: '++id, name, color, computed' })
    this.version(3).stores({ budgetItems: '++id, name, category, type, date, dueDate' })
    this.version(4).stores({ categories: '++id, name, color, computed, parentId' })
    // v5: amounts link to a category by id (names repeat, e.g. "Car", "Miscellaneous");
    // estimate/frequency/autopay/dueDate move from each amount onto its category.
    this.version(5)
      .stores({ budgetItems: '++id, categoryId, date', categories: '++id, name, parentId' })
      .upgrade(async tx => {
        const cats = tx.table<Category, number>('categories')
        const all = await cats.toArray()
        const nameOf = (id: number | null) => all.find(c => c.id === id)?.name ?? null

        // 0004 routes Medical amounts to a "Miscellaneous" item the old seed never created.
        const medical = all.find(c => c.name === 'Medical' && c.parentId != null)
        if (medical && !all.some(c => c.parentId === medical.id && c.name === 'Miscellaneous')) {
          const row: Category = { name: 'Miscellaneous', parentId: medical.id!, color: 'even-lighter-orange', computed: false }
          all.push({ ...row, id: await cats.add(row) })
        }

        const expenses = all.find(c => c.name === 'Expenses' && c.parentId == null)
        const items = tx.table('budgetItems')
        for (const old of await items.toArray()) {
          const matches = all.filter(c => c.name === old.name)
          // Old builds saved category '' or a top-level name, so a repeated name
          // (Car, Miscellaneous) can't be placed for sure: file it under the first
          // match and don't copy its estimate onto a category it may not belong to.
          const exact = matches.filter(c => nameOf(c.parentId) === old.category)
          let cat = exact.length === 1 ? exact[0] : matches[0]
          const ambiguous = exact.length !== 1 && matches.length > 1
          if (!cat) {
            // Free-text item from the old form: keep the amount under a new Expenses item.
            const row: Category = { name: cleanName(old.name ?? '') || 'Unnamed', parentId: expenses?.id ?? null, color: 'lighter-orange', computed: false }
            cat = { ...row, id: await cats.add(row) }
            all.push(cat)
          }
          if (!ambiguous && (old.estimate != null || old.frequency || old.autopay || old.dueDate)) {
            // Keep the first value found; later amounts don't overwrite it.
            const patch: Partial<Category> = {
              estimate: cat.estimate ?? old.estimate,
              frequency: cat.frequency ?? old.frequency,
              autopay: cat.autopay ?? old.autopay,
              dueDate: cat.dueDate ?? old.dueDate,
              selected: true,
            }
            await cats.update(cat.id!, patch)
            Object.assign(cat, patch)
          }
          const amount = Number.isFinite(old.amount) ? old.amount : 0
          await items.put({ id: old.id, categoryId: cat.id!, amount, date: old.date, createdAt: old.createdAt, updatedAt: Date.now() })
        }

        for (const c of all) {
          if (isPreselected(c.name, nameOf(c.parentId))) await cats.update(c.id!, { selected: true })
        }
      })
    // v6: formerly flagged legacy amounts for review; removed (pre-alpha, no legacy data).
    this.version(6).stores({})
    // v7: Income group over Pay and Incidental Income, stored sibling order,
    // computed only on top-level rows (0007 §2); drop old review flags.
    this.version(7).stores({}).upgrade(async tx => {
      const cats = tx.table<Category, number>('categories')
      const next = toV7Structure(await cats.toArray())
      await cats.clear()
      await cats.bulkAdd(next)
      await tx.table('budgetItems').toCollection().modify((i: Record<string, unknown>) => { delete i.needsReview })
    })
    // v8: 'year' → 'annual' for frequency and range values (roadmap v0.4).
    this.version(8).stores({}).upgrade(async tx => {
      await tx.table('categories').toCollection().modify((c: Record<string, unknown>) => { if (c.frequency === 'year') c.frequency = 'annual' })
      await tx.table('settings').toCollection().modify((s: Record<string, unknown>) => { if (s.defaultRange === 'year') s.defaultRange = 'annual' })
    })
    // v9: sync (0015 §4). Synced records get a random UUID (auto-increment ids clash
    // between devices); categories and settings get updatedAt; sync state tables.
    this.version(9).stores({
      budgetItems: '++id, categoryId, date, uid',
      categories: '++id, name, parentId, uid',
      syncRecords: '[tab+uid]',
      syncConfig: 'key',
    }).upgrade(async tx => {
      const now = Date.now()
      await tx.table('categories').toCollection().modify((c: Category) => { c.uid ??= newUid(); c.updatedAt ??= now })
      await tx.table('budgetItems').toCollection().modify((i: BudgetItem) => { i.uid ??= newUid() })
      await tx.table('settings').toCollection().modify((s: Settings) => { s.updatedAt ??= now })
    })
    // v10: Incidentals › Miscellaneous exists and is preselected (0014 M3): its purchases
    // feed the Annual Misc. Breakdown. uid and updatedAt are set here so sync carries it.
    this.version(10).stores({}).upgrade(async tx => {
      const cats = tx.table<Category, number>('categories')
      const all = await cats.toArray()
      const inc = all.find(c => c.name === 'Incidentals' && all.find(p => p.id === c.parentId)?.name === 'Expenses')
      if (!inc) return
      const now = Date.now()
      const misc = all.find(c => c.parentId === inc.id && c.name === 'Miscellaneous')
      if (misc) { if (!misc.selected) await cats.update(misc.id!, { selected: true, updatedAt: now }); return }
      // Incidentals with no items holds its own amounts; adding a first item would strand them.
      if (!all.some(c => c.parentId === inc.id)) return
      const order = all.filter(c => c.parentId === inc.id).reduce((m, c) => Math.max(m, (c.order ?? -1) + 1), 0)
      await cats.add({ name: 'Miscellaneous', color: 'even-lighter-orange', parentId: inc.id!, order, selected: true, uid: newUid(), updatedAt: now })
    })

    // Stamp every local write so sync can merge it (last-write-wins by updatedAt).
    const stamp = (table: Table<{ uid?: string; updatedAt?: number }, number>, withUid: boolean) => {
      table.hook('creating', (_key, obj, tx) => {
        const mode = modeOf(tx)
        if (withUid && (mode == null || !obj.uid)) obj.uid = newUid()
        if (mode !== 'sync' || obj.updatedAt == null) obj.updatedAt = Date.now()
      })
      table.hook('updating', (mods, _key, _obj, tx) => {
        const mode = modeOf(tx)
        const patch: Record<string, unknown> = {}
        if (mode !== 'sync' && withUid && 'uid' in mods) patch.uid = (_obj as { uid?: string }).uid
        if (mode !== 'sync' || !('updatedAt' in mods)) patch.updatedAt = Date.now()
        return patch
      })
    }
    stamp(this.categories, true)
    stamp(this.budgetItems as Table<{ uid?: string; updatedAt?: number }, number>, true)
    stamp(this.settings, false)
  }
}

export const db = new SimpleBudgetDB()

/**
 * Database lifecycle problems the UI must explain (security-v0.2 8.4):
 * 'blocked' — an upgrade is waiting for another open tab to close;
 * 'versionchange' — another tab upgraded the database, so this tab must reload.
 */
export const dbEvents = new EventTarget()
db.on('blocked', () => { dbEvents.dispatchEvent(new Event('blocked')) })
db.on('versionchange', () => {
  db.close()
  dbEvents.dispatchEvent(new Event('versionchange'))
  return false
})
