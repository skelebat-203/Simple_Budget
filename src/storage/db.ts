import Dexie, { type Table } from 'dexie'
import { isPreselected } from './preselected'

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
          let cat = matches.find(c => nameOf(c.parentId) === old.category) ?? matches[0]
          if (!cat) {
            // Free-text item from the old form: keep the amount under a new Expenses item.
            const row: Category = { name: old.name || 'Unnamed', parentId: expenses?.id ?? null, color: 'lighter-orange', computed: false }
            cat = { ...row, id: await cats.add(row) }
            all.push(cat)
          }
          if (old.estimate != null || old.frequency || old.autopay || old.dueDate) {
            await cats.update(cat.id!, {
              estimate: old.estimate ?? cat.estimate,
              frequency: old.frequency ?? cat.frequency,
              autopay: old.autopay ?? cat.autopay,
              dueDate: old.dueDate ?? cat.dueDate,
              selected: true,
            })
          }
          await items.put({ id: old.id, categoryId: cat.id!, amount: old.amount ?? 0, date: old.date, createdAt: old.createdAt, updatedAt: Date.now() })
        }

        for (const c of all) {
          if (isPreselected(c.name, nameOf(c.parentId))) await cats.update(c.id!, { selected: true })
        }
      })
  }
}

export const db = new SimpleBudgetDB()
