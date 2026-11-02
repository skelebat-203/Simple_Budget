import Dexie, { type Table } from 'dexie'
import { isPreselected } from './preselected'
import { cleanName } from '../budget/validate'

/** Recurrence of an item's estimate. Bi-monthly means twice a month. */
export type Frequency = 'day' | 'week' | 'biweek' | 'bimonthly' | 'month'

/** Budget table display range. */
export type Range = 'day' | 'week' | 'month'

/** One recorded amount (a purchase, paycheck, credit…). Negative = credit. */
export interface BudgetItem {
  id?: number
  /** Category-tree node the amount belongs to (an item, or a subcategory that takes amounts directly). */
  categoryId: number
  amount: number
  /** Local date, YYYY-MM-DD. */
  date: string
  createdAt: number
  updatedAt: number
  /** Set when an upgrade couldn't be sure which category this amount belongs to. */
  needsReview?: boolean
}

/**
 * Node in the category tree (0004-table-design.md). Categories, subcategories
 * and items are all nodes; the estimate fields describe the node, not a single
 * amount, so they live here.
 */
export interface Category {
  id?: number
  name: string
  /** Color token suffix, e.g. 'lighter-orange' → `clr-lighter-orange`. */
  color: string
  /** Parent node id, null for top-level categories. */
  parentId: number | null
  /** Computed rows (sums) can't take amounts directly. */
  computed?: boolean
  /** Picked in Budget setup as a regularly used item. */
  selected?: boolean
  estimate?: number
  frequency?: Frequency
  autopay?: boolean
  /** Payment due date, YYYY-MM-DD (display/editing: roadmap v0.3). */
  dueDate?: string
}

export interface Settings {
  id?: number
  rewardsEnabled: boolean
  notificationsEnabled: boolean
  defaultRange?: Range
}

/** True when this session ran the fixed v5 upgrade, which already flags ambiguous rows. */
let ranFixedV5 = false

class SimpleBudgetDB extends Dexie {
  budgetItems!: Table<BudgetItem, number>
  categories!: Table<Category, number>
  settings!: Table<Settings, number>

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
        ranFixedV5 = true
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
          // (Car, Miscellaneous) can't be placed for sure. Never guess silently:
          // file it under the first match, flag it for review, and don't copy
          // its estimate onto a category it may not belong to (security-v0.2 3.1).
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
          await items.put({ id: old.id, categoryId: cat.id!, amount, date: old.date, createdAt: old.createdAt, updatedAt: Date.now(), needsReview: ambiguous || undefined })
        }

        for (const c of all) {
          if (isPreselected(c.name, nameOf(c.parentId))) await cats.update(c.id!, { selected: true })
        }
      })
    // v6: v5 (as shipped in v0.2.5) guessed on repeated names. Flag amounts it
    // migrated (updatedAt > createdAt; no edit flow exists yet) whose category
    // name repeats, so the user can check them once (security-v0.2 3.1).
    this.version(6).stores({}).upgrade(async tx => {
      if (ranFixedV5) return
      const all = await tx.table<Category, number>('categories').toArray()
      const count = new Map<string, number>()
      for (const c of all) count.set(c.name, (count.get(c.name) ?? 0) + 1)
      const repeated = new Set(all.filter(c => (count.get(c.name) ?? 0) > 1).map(c => c.id))
      await tx.table<BudgetItem, number>('budgetItems').toCollection().modify(it => {
        if (repeated.has(it.categoryId) && it.updatedAt > it.createdAt) it.needsReview = true
      })
    })
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
