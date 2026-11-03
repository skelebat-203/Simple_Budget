import { db, type BudgetItem, type Category, type Frequency, type DefaultRange, type MonthBoundary, type Settings } from './db'
import { cleanName, MONEY_MAX, slug } from '../budget/validate'
import { toV7Structure } from './structure'

const FREQS = new Set<Frequency>(['day', 'week', 'biweek', 'bimonthly', 'month', 'quarter', 'annual'])
const RANGES = new Set<DefaultRange>(['day', 'week', 'month'])
const validWeekStart = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6
const validBoundary = (b: unknown): b is MonthBoundary => b === 'weeks' || b === 'calendar'

/** Stored settings with every value checked and defaults filled in (0007 §1). */
function cleanSettings(s: Partial<Settings>): Settings {
  return {
    id: s.id,
    rewardsEnabled: s.rewardsEnabled ?? true,
    notificationsEnabled: !!s.notificationsEnabled,
    defaultRange: s.defaultRange && RANGES.has(s.defaultRange) ? s.defaultRange : 'day',
    weekStart: validWeekStart(s.weekStart) ? s.weekStart : 0,
    monthBoundary: validBoundary(s.monthBoundary) ? s.monthBoundary : 'weeks',
  }
}

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
    && (x.dueDate === undefined || (typeof x.dueDate === 'string' && DATE_RE.test(x.dueDate)))
    && ['autopay', 'selected', 'computed'].every(k => x[k as keyof Category] === undefined || typeof x[k as keyof Category] === 'boolean')
}

/** Deepest level the app supports: category › subcategory › item (deep nesting: v0.6). */
const MAX_DEPTH = 2

/**
 * Rows whose parent chain loops or runs deeper than MAX_DEPTH (security-v0.3
 * 3.1). Walks iteratively, so a hostile chain can't exhaust the stack. A
 * missing parent is treated as top level.
 */
export function badTreeRows(cats: Category[]): Set<number> {
  const byId = new Map(cats.map(c => [c.id, c]))
  const bad = new Set<number>()
  for (const c of cats) {
    let p = c.parentId, depth = 0
    const seen = new Set([c.id])
    while (p != null && byId.has(p)) {
      if (seen.has(p) || ++depth > MAX_DEPTH) { bad.add(c.id!); break }
      seen.add(p)
      p = byId.get(p)!.parentId
    }
  }
  return bad
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
      const moves = !!parent && (parent.parentId != null || !parent.computed) && siblings.length === 0 && parent.estimate != null
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
    const shaped = rows.filter(validCategory)
    const bad = badTreeRows(shaped)
    const ok = shaped.filter(c => !bad.has(c.id!))
    skipped.categories = rows.length - ok.length
    return ok
  },
  async update(id: number, patch: Partial<Category>) {
    return db.categories.update(id, patch.name === undefined ? patch : { ...patch, name: cleanName(patch.name) })
  },
  async rename(id: number, name: string) { return db.categories.update(id, { name: cleanName(name) }) },
  async remove(id: number) { return db.categories.delete(id) },
  /**
   * Delete a subcategory or item (0007 §9.2, §10). Refused for top-level rows,
   * rows with items, and rows with more than one purchase, checked inside the
   * transaction; a single purchase is deleted with the row.
   */
  async removeEmpty(id: number) {
    await db.transaction('rw', db.categories, db.budgetItems, async () => {
      const c = await db.categories.get(id)
      if (!c || c.parentId == null) throw new RowInUseError('top-level rows can’t be deleted.')
      if (await db.categories.where('parentId').equals(id).count()) throw new RowInUseError('it has items. Delete its items first.')
      const bought = db.budgetItems.where('categoryId').equals(id)
      // A row with a single purchase can go, taking that purchase with it (0007 §10).
      if (await bought.count() > 1) throw new RowInUseError('it has more than one purchase. Delete them in the Day table first.')
      await bought.delete()
      await db.categories.delete(id)
    })
  },
}

/** Why a row can't be deleted, checked inside the delete transaction (security-v0.3 8.1). */
export class RowInUseError extends Error {}

/** A name already used by a sibling; the message finishes "Invalid: {field} …". */
export class NameTakenError extends Error {}

async function assertFree(parentId: number, name: string, where: string) {
  const sibs = await db.categories.where('parentId').equals(parentId).toArray()
  if (sibs.some(c => slug(c.name) === slug(name))) throw new NameTakenError(`“${cleanName(name)}” already exists in ${where}`)
}

/**
 * Add form new-item flow (0007 §4.2), all-or-nothing: an optional new
 * subcategory, the new item, and its first amount. `selected` is the
 * "Use in future" choice. Returns the subcategory name when its estimate moved
 * to Miscellaneous (§2.1).
 */
export async function addNewItem(o: {
  name: string
  parent: { id: number; name: string } | { newSub: string; root: { id: number; name: string }; color: string }
  color: string
  selected: boolean
  amount: number
  date: string
}): Promise<string | undefined> {
  return db.transaction('rw', db.categories, db.budgetItems, async () => {
    let parent: { id: number; name: string }
    if ('newSub' in o.parent) {
      await assertFree(o.parent.root.id, o.parent.newSub, o.parent.root.name)
      const sub = await categoryRepo.add({ name: o.parent.newSub, parentId: o.parent.root.id, color: o.parent.color, selected: o.selected || undefined })
      parent = { id: sub.id, name: cleanName(o.parent.newSub) }
    } else {
      parent = o.parent
    }
    await assertFree(parent.id, o.name, parent.name)
    const r = await categoryRepo.add({ name: o.name, parentId: parent.id, color: o.color, selected: o.selected || undefined })
    await budgetItemRepo.add({ categoryId: r.id, amount: o.amount, date: o.date })
    return r.movedFrom
  })
}

export const settingsRepo = {
  async get(): Promise<Settings> {
    const s = await db.settings.toCollection().first()
    if (s) return cleanSettings(s)
    const created = cleanSettings({})
    delete created.id
    const id = await db.settings.add(created)
    return { ...created, id }
  },
  async update(patch: Partial<Settings>) {
    const s = await this.get()
    if (s.id != null) await db.settings.update(s.id, patch)
  },
}

/**
 * Budget setup save (0007 §5.5): the edited category list and settings in one
 * transaction (security-v0.2 8.3). Rows with negative ids are new; they are
 * added parents-first and their temporary ids are swapped for real ones.
 */
export async function saveSetup(working: Category[], original: Category[], settings: Partial<Settings>) {
  const before = new Map(original.map(c => [c.id, JSON.stringify(c)]))
  await db.transaction('rw', db.categories, db.settings, async () => {
    const real = new Map<number, number>()
    const mapId = (id: number | null) => (id != null && id < 0 ? real.get(id)! : id)
    const fresh = working.filter(c => c.id! < 0)
    while (fresh.length) {
      const i = fresh.findIndex(c => c.parentId == null || c.parentId >= 0 || real.has(c.parentId))
      if (i < 0) throw new Error('New row has no parent')
      const [c] = fresh.splice(i, 1)
      const { id, ...row } = c
      real.set(id!, await db.categories.add({ ...row, name: cleanName(row.name), parentId: mapId(row.parentId) }))
    }
    for (const c of working) {
      if (c.id! < 0 || before.get(c.id) === JSON.stringify(c)) continue
      await db.categories.put({ ...c, name: cleanName(c.name), parentId: mapId(c.parentId) })
    }
    await settingsRepo.update(settings)
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
  // Backups made before Dexie v8 store frequency 'year'; map it to 'annual'.
  for (const c of b.categories as { frequency?: string }[]) if (c?.frequency === 'year') c.frequency = 'annual'
  if (!b.categories.every(c => validCategory(c) && Number.isInteger(c.id))) throw new BackupError('has a damaged category list. Export a new backup and try again.')
  const ids = new Set(b.categories.map(c => c.id))
  if (ids.size !== b.categories.length) throw new BackupError('has a damaged category list. Export a new backup and try again.')
  if (!b.budgetItems.every(i => validItem(i) && ids.has(i.categoryId))) throw new BackupError('has damaged amounts. Export a new backup and try again.')
  // Backups made before the v7 structure (no stored order) get the same upgrade the database got.
  const cats = b.categories.some(c => c.order === undefined) ? toV7Structure(b.categories) : b.categories
  if (badTreeRows(cats).size) throw new BackupError('has categories nested in a loop or more than three levels deep. Export a new backup and try again.')
  return {
    ...b,
    budgetItems: b.budgetItems.map(({ id, categoryId, amount, date, createdAt, updatedAt }) => ({ id, categoryId, amount, date, createdAt, updatedAt })),
    categories: cats.map(c => ({ ...c, name: cleanName(c.name) })),
    settings: b.settings.slice(0, 1).map(s => cleanSettings({ ...s, rewardsEnabled: !!s.rewardsEnabled })),
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
