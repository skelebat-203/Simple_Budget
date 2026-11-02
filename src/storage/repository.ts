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
}

export const categoryRepo = {
  async add(cat: Omit<Category, 'id'>) { return db.categories.add(cat) },
  async list() { return db.categories.toArray() },
  async update(id: number, patch: Partial<Category>) { return db.categories.update(id, patch) },
  /** Apply several patches in one transaction. */
  async updateMany(patches: { id: number; patch: Partial<Category> }[]) {
    await db.transaction('rw', db.categories, async () => {
      for (const { id, patch } of patches) await db.categories.update(id, patch)
    })
  },
  async rename(id: number, name: string) { return db.categories.update(id, { name }) },
  async remove(id: number) { return db.categories.delete(id) },
}

export const settingsRepo = {
  async get(): Promise<Settings> {
    const s = await db.settings.toCollection().first()
    if (s) return s
    const created: Settings = { rewardsEnabled: true, notificationsEnabled: false, defaultRange: 'day' }
    const id = await db.settings.add(created)
    return { ...created, id }
  },
  async update(patch: Partial<Settings>) {
    const s = await this.get()
    if (s.id != null) await db.settings.update(s.id, patch)
  },
}
