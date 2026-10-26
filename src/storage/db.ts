import Dexie, { type Table } from 'dexie'

export type BudgetType = 'income' | 'savings' | 'expense'

export interface BudgetItem {
  id?: number
  name: string
  category: string
  type: BudgetType
  amount: number
  date: string
  createdAt: number
  updatedAt: number
}

export interface Category {
  id?: number
  name: string
  color: string
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
  }
}

export const db = new SimpleBudgetDB()
