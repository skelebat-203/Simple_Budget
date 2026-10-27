import Dexie, { type Table } from 'dexie'

export type BudgetType = 'income' | 'savings' | 'expense'

/** Recurrence of a budget item's estimated spend. */
export type Frequency = 'day' | 'week' | 'month' | 'bimonthly' | 'biweek'

export interface BudgetItem {
  id?: number
  name: string
  category: string
  type: BudgetType
  amount: number
  date: string
  estimate?: number
  frequency?: Frequency
  dueDate?: string
  autopay?: boolean
  createdAt: number
  updatedAt: number
}

export interface Category {
  id?: number
  name: string
  color: string
  /** True for computed rows (sums), not user-entered. */
  computed?: boolean
}

export interface Settings {
  id?: number
  rewardsEnabled: boolean
  notificationsEnabled: boolean
}

class SimpleBudgetDB extends Dexie {
  budgetItems!: Table<BudgetItem, number>
  categories!: Table<Category, number>
  settings!: Table<Settings, number>

  constructor() {
    super('simple-budget')
    this.version(1).stores({
      budgetItems: '++id, name, category, type, date',
      categories: '++id, name',
      settings: '++id',
    })
    // v2 (categories + color, computed flag)
    this.version(2).stores({
      budgetItems: '++id, name, category, type, date',
      categories: '++id, name, color, computed',
      settings: '++id',
    })
    this.version(3).stores({
      budgetItems: '++id, name, category, type, date, dueDate',
      categories: '++id, name, color, computed',
      settings: '++id',
    })
  }
}

export const db = new SimpleBudgetDB()