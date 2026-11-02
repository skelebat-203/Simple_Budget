import type { Category } from './db'

/** Top-level rows in display order (0007 §2). */
export const ROOT_ORDER = ['Income', 'Taxes', 'Net Income', 'Savings', 'Expenses']

const rootRank = (name: string) => { const i = ROOT_ORDER.indexOf(name); return i < 0 ? ROOT_ORDER.length : i }

/**
 * Move a pre-v7 category list to the 0007 §2 structure: an Income group over
 * Pay and Incidental Income, `computed` kept only on top-level rows (a
 * subcategory is a total exactly when it has items), and a stored sibling
 * `order` that keeps the order the old tree showed. Pure; used by the Dexie v7
 * upgrade and by restoring an older backup. New rows get ids above the max.
 */
export function toV7Structure(input: Category[]): Category[] {
  const all = input.map(c => ({ ...c }))
  let income = all.find(c => c.parentId == null && c.name === 'Income')
  if (!income) {
    income = { id: Math.max(0, ...all.map(c => c.id ?? 0)) + 1, name: 'Income', color: 'blue', parentId: null, computed: true }
    all.push(income)
  }
  for (const c of all) {
    if (c.parentId == null && (c.name === 'Pay' || c.name === 'Incidental Income')) c.parentId = income.id!
  }

  const kids = new Map<number | null, Category[]>()
  for (const c of all) kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c])
  const hasKids = (c: Category) => (kids.get(c.id!)?.length ?? 0) > 0

  for (const [parentId, list] of kids) {
    list.sort((a, b) => a.id! - b.id!)
    if (parentId == null) list.sort((a, b) => rootRank(a.name) - rootRank(b.name))
    // The old tree sorted a list made only of items alphabetically (not Income, which is new).
    else if (parentId !== income.id && list.every(c => !hasKids(c) && !c.computed)) {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    list.forEach((c, i) => { c.order = i })
  }
  for (const c of all) if (c.parentId != null) delete c.computed
  return all
}
