import { db, type BudgetItem, type Category, type Frequency, type Range, type Settings } from './db'
import { cleanName, MONEY_MAX } from '../budget/validate'
import { toV7Structure } from './structure'

const FREQS = new Set<Frequency>(['day', 'week', 'biweek', 'bimonthly', 'month', 'quarter', 'year'])
const RANGES = new Set<Range>(['day', 'week', 'month'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= MONEY_MAX

// ---------- shape checks for stored rows (security-v0.2 6.5) ----------

function validItem(r: unknown): r is BudgetItem {
  const x = r as BudgetItem
  return !!x && Number.isInteger(x.categoryId) && isMoney(x.amount) && typeof x.date === 'string' && DATE_RE.test(x.date)
}

function validCategory(r: unknown): r is Category {
  const x = r as Category
  return !!x && typeof x.name === 'string' && x.name.length > 0 && typeof x.color === 'string'
    && (x.parentId === null || Number.isInteger(x.parentId))
    && (x.estimate === undefined || isMoney(x.estimate))
    && (x.frequency === undefined || FREQS.has(x.frequency))
    && (x.order === undefined || Number.isInteger(x.order))
}

/** Rows that failed a shape check on the last read; the app tells the user. */
export const skipped = { items: 0, categories: 0 }

export const budgetItemRepo = {
  async add(item: Omit<BudgetItem, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now()
    return db.budgetItems.add({ ...item, createdAt: now, updatedAt: now })
  },
  async list() {
    const rows = await db.budgetItems.toArray()
    const ok = rows.filter(validItem)
    skipped.items = rows.length - ok.length
    return ok
  },
  async update(id: number, patch: Partial<BudgetItem>) {
    return db.budgetItems.update(id, { ...patch, updatedAt: Date.now() })
  },
  async remove(id: number) { return db.budgetItems.delete(id) },
}

export const categoryRepo = {
  /**
   * Add a row at the end of its siblings. When it is the first item of a
   * subcategory that holds a manual estimate, that estimate (with recurrence
   * and autopay) moves to a Miscellaneous item (0007 §2.1); the result names
   * the subcategory so the UI can say so.
   */
  async add(cat: Omit<Category, 'id' | 'order'>): Promise<{ id: number; movedFrom?: string }> {
    return db.transaction('rw', db.categories, async () => {
      const siblings = cat.parentId == null
        ? await db.categories.filter(c => c.parentId == null).toArray()
        : await db.categories.where('parentId').equals(cat.parentId).toArray()
      const order = siblings.reduce((m, c) => Math.max(m, (c.order ?? -1) + 1), 0)
      const name = cleanName(cat.name)
      const parent = cat.parentId == null ? undefined : await db.categories.get(cat.parentId)
      const moves = !!parent && parent.parentId != null && siblings.length === 0 && parent.estimate != null
      if (!moves) return { id: await db.categories.add({ ...cat, name, order }) }
      const held = { estimate: parent.estimate, frequency: parent.frequency, autopay: parent.autopay, selected: parent.selected || undefined }
      await db.categories.update(parent.id!, { estimate: undefined, frequency: undefined, autopay: undefined })
      if (name === 'Miscellaneous') return { id: await db.categories.add({ ...cat, ...held, name, order }), movedFrom: parent.name }
      await db.categories.add({ name: 'Miscellaneous', color: cat.color, parentId: parent.id!, order, ...held })
      return { id: await db.categories.add({ ...cat, name, order: order + 1 }), movedFrom: parent.name }
    })
  },
  async list() {
    const rows = await db.categories.toArray()
    const ok = rows.filter(validCategory)
    skipped.categories = rows.length - ok.length
    return ok
  },
  async update(id: number, patch: Partial<Category>) {
    return db.categories.update(id, patch.name === undefined ? patch : { ...patch, name: cleanName(patch.name) })
  },
  async rename(id: number, name: string) { return db.categories.update(id, { name: cleanName(name) }) },
  async remove(id: number) { return db.categories.delete(id) },
}

export const settingsRepo = {
  async get(): Promise<Settings> {
    const s = await db.settings.toCollection().first()
    if (s) return { ...s, defaultRange: s.defaultRange && RANGES.has(s.defaultRange) ? s.defaultRange : 'day' }
    const created: Settings = { rewardsEnabled: true, notificationsEnabled: false, defaultRange: 'day' }
    const id = await db.settings.add(created)
    return { ...created, id }
  },
  async update(patch: Partial<Settings>) {
    const s = await this.get()
    if (s.id != null) await db.settings.update(s.id, patch)
  },
}

/** Budget setup save: category patches and the default range in one transaction (security-v0.2 8.3). */
export async function saveSetup(patches: { id: number; patch: Partial<Category> }[], defaultRange: Range) {
  await db.transaction('rw', db.categories, db.settings, async () => {
    for (const { id, patch } of patches) await db.categories.update(id, patch)
    await settingsRepo.update({ defaultRange })
  })
}

// ---------- backup (security-v0.2 6.2) ----------

export const BACKUP_FORMAT = 'simple-budget-backup'
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: 1
  exportedAt: string
  categories: Category[]
  budgetItems: BudgetItem[]
  settings: Settings[]
}

export async function exportBackup(): Promise<Backup> {
  return db.transaction('r', db.categories, db.budgetItems, db.settings, async () => ({
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    budgetItems: await db.budgetItems.toArray(),
    settings: await db.settings.toArray(),
  }))
}

/** Why a backup file was rejected; completes the sentence "Invalid: Backup file …". */
export class BackupError extends Error {}

/** Check a parsed backup file fully before anything is written. */
export function checkBackup(data: unknown): Backup {
  const b = data as Backup
  if (!b || b.format !== BACKUP_FORMAT || b.version !== 1) throw new BackupError('is not a Simple Budget backup. Choose the .json file you exported.')
  if (!Array.isArray(b.categories) || !Array.isArray(b.budgetItems) || !Array.isArray(b.settings)) throw new BackupError('is incomplete. Export a new backup and try again.')
  if (!b.categories.every(c => validCategory(c) && Number.isInteger(c.id))) throw new BackupError('has a damaged category list. Export a new backup and try again.')
  const ids = new Set(b.categories.map(c => c.id))
  if (!b.budgetItems.every(i => validItem(i) && ids.has(i.categoryId))) throw new BackupError('has damaged amounts. Export a new backup and try again.')
  // Backups made before the v7 structure (no stored order) get the same upgrade the database got.
  const cats = b.categories.some(c => c.order === undefined) ? toV7Structure(b.categories) : b.categories
  return {
    ...b,
    budgetItems: b.budgetItems.map(({ id, categoryId, amount, date, createdAt, updatedAt }) => ({ id, categoryId, amount, date, createdAt, updatedAt })),
    categories: cats.map(c => ({ ...c, name: cleanName(c.name) })),
    settings: b.settings.slice(0, 1).map(s => ({
      id: s.id, rewardsEnabled: !!s.rewardsEnabled, notificationsEnabled: !!s.notificationsEnabled,
      defaultRange: RANGES.has(s.defaultRange as Range) ? s.defaultRange : 'day',
    })),
  }
}

/** Replace all data with a checked backup, all-or-nothing. */
export async function restoreBackup(b: Backup) {
  await db.transaction('rw', db.categories, db.budgetItems, db.settings, async () => {
    await Promise.all([db.categories.clear(), db.budgetItems.clear(), db.settings.clear()])
    await db.categories.bulkAdd(b.categories)
    await db.budgetItems.bulkAdd(b.budgetItems)
    if (b.settings.length) await db.settings.bulkAdd(b.settings)
  })
}
