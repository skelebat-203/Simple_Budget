import { db, type BudgetItem, type Category, type Settings } from './db'

export const budgetItemRepo = {
  async add(item: Omit<BudgetItem, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now()
    return db.budgetItems.add({ ...item, createdAt: now, updatedAt: now })
  },
  async list() { return db.budgetItems.toArray() },
  async update(id: number, patch: Partial<BudgetItem>) {
    return db.budgetItems.update(id, { ...patch, updatedAt: Date.now() })
  },
  async remove(id: number) { return db.budgetItems.delete(id) },
  async findByName(name: string) { return db.budgetItems.where('name').equals(name).toArray() },
}

export const categoryRepo = {
  async add(cat: Omit<Category, 'id'>) { return db.categories.add(cat) },
  async list() { return db.categories.toArray() },
  async rename(id: number, name: string) { return db.categories.update(id, { name }) },
  async remove(id: number) { return db.categories.delete(id) },
}

export const settingsRepo = {
  async get(): Promise<Settings> {
    const s = await db.settings.toCollection().first()
    if (s) return s
    const created: Settings = { rewardsEnabled: true, notificationsEnabled: false }
    const id = await db.settings.add(created)
    return { ...created, id }
  },
  async update(patch: Partial<Settings>) {
    const s = await this.get()
    if (s.id != null) await db.settings.update(s.id, patch)
  },
}
