// Targets the review offers for a spreadsheet row (0013 §9) and how they map to the plan's TargetChoice.
import { buildTree, flatten, type CatNode } from '../../budget/tree'
import type { Category } from '../../storage/db'
import type { ComboGroup, ComboOption } from '../ui'
import type { TargetChoice } from '../../import'

/** Option values: 'auto', 'skip', 'misc', `c:{id}` (onto an existing row) and `p:{id}` (a new row under an existing one). */
export function toChoice(value: string | null): TargetChoice | undefined {
  if (!value) return undefined
  if (value === 'auto' || value === 'skip' || value === 'misc') return value
  const id = Number(value.slice(2))
  return value.startsWith('c:') ? { categoryId: id } : value.startsWith('p:') ? { parentId: id } : undefined
}

export function choiceValue(c: TargetChoice | undefined): string {
  if (!c) return 'auto'
  return typeof c === 'string' ? c : 'categoryId' in c ? `c:${c.categoryId}` : `p:${c.parentId}`
}

const pathOf = (n: CatNode): string => (n.parent ? `${pathOf(n.parent)} › ${n.cat.name}` : n.cat.name)

/** Existing rows that take amounts (no rows under them, not a computed total), with their paths. */
export function amountRows(categories: Category[]): ComboOption[] {
  return flatten(buildTree(categories))
    .filter(n => !n.cat.computed && !n.children.length)
    .map(n => ({ value: `c:${n.cat.id}`, label: pathOf(n) }))
}

/** Groups for the "Where should X go?" picker (14d): add under, put on an existing row, skip. */
export function placeGroups(categories: Category[]): ComboGroup[] {
  const nodes = flatten(buildTree(categories)).filter(n => n.cat.name !== 'Net Income')
  // A new row may be added under a top-level row or a subcategory directly under one.
  const under = nodes.filter(n => n.depth === 0 || (n.depth === 1 && n.children.length))
  return [
    { key: 'under', heading: 'Add as a new row under', options: under.map(n => ({ value: `p:${n.cat.id}`, label: pathOf(n) })) },
    { key: 'onto', heading: 'Put its amounts on an existing row', options: amountRows(categories) },
    { key: 'skip', heading: 'Do not import it', choice: 'skip', options: [] },
  ]
}
