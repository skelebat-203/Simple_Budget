// Budget setup edits on a working copy of the categories (0007 §5). Nothing is
// stored until Save; Cancel drops the copy. Unsaved rows get negative ids.
import { buildTree, childColor, flatten, subtree, type Cat, type CatNode } from './tree'
import { slug } from './validate'

let nextTempId = -1
const nodeOf = (cats: Cat[], id: number) => flatten(buildTree(cats)).find(n => n.cat.id === id)!

/** Sibling rows of `parentId` in display order. */
const siblingsOf = (cats: Cat[], parentId: number | null) => {
  const roots = buildTree(cats)
  return parentId == null ? roots : flatten(roots).find(n => n.cat.id === parentId)?.children ?? []
}

/** Rewrite every sibling's `order` to 0..n-1 in the given sequence. */
const renumber = (cats: Cat[], ids: number[]) =>
  cats.map(c => { const i = ids.indexOf(c.id); return i < 0 ? c : { ...c, order: i } })

export const patch = (cats: Cat[], id: number, p: Partial<Cat>) => cats.map(c => (c.id === id ? { ...c, ...p } : c))

/** A subcategory's checkbox selects or clears all of its items; estimates are never touched (§5.2). */
export function setSelected(cats: Cat[], id: number, selected: boolean) {
  const ids = new Set(subtree(nodeOf(cats, id)).map(n => n.cat.id))
  return cats.map(c => (ids.has(c.id) ? { ...c, selected } : c))
}

/** True when a sibling of `parentId` already uses this name (compared as an id slug, 0007 §8.2). */
export const nameTaken = (cats: Cat[], parentId: number | null, name: string, exceptId?: number) =>
  siblingsOf(cats, parentId).some(n => n.cat.id !== exceptId && slug(n.cat.name) === slug(name))

/**
 * Put `child` (already in `cats`, or new) as the last row under `parentId`.
 * If it's the parent's first item and the parent holds a manual estimate,
 * that estimate (with recurrence and autopay) moves to a Miscellaneous item
 * (0007 §2.1). Returns the parent's name when that happened.
 */
function attach(cats: Cat[], child: Cat, parentId: number): { cats: Cat[]; movedFrom?: string } {
  const parent = nodeOf(cats, parentId)
  const others = parent.children.filter(c => c.cat.id !== child.id)
  let order = others.length
  let rest = cats.filter(c => c.id !== child.id)
  let movedFrom: string | undefined
  if (parent.parent && others.length === 0 && parent.cat.estimate != null) {
    const p = parent.cat
    const held = { estimate: p.estimate, frequency: p.frequency, autopay: p.autopay, selected: p.selected }
    rest = patch(rest, p.id, { estimate: undefined, frequency: undefined, autopay: undefined })
    movedFrom = p.name
    if (child.name === 'Miscellaneous') child = { ...child, ...held }
    else {
      rest = [...rest, { id: nextTempId--, name: 'Miscellaneous', color: childColor(parent), parentId: p.id, order: order++, ...held }]
    }
  }
  return { cats: [...rest, { ...child, parentId, order, color: childColor(parent) }], movedFrom }
}

export function create(cats: Cat[], name: string, parentId: number) {
  return attach(cats, { id: nextTempId--, name, color: '', parentId, selected: true }, parentId)
}

/** Swap a row with its previous (-1) or next (+1) sibling (§5.3). */
export function move(cats: Cat[], id: number, delta: -1 | 1) {
  const n = nodeOf(cats, id)
  const ids = siblingsOf(cats, n.cat.parentId).map(s => s.cat.id)
  const i = ids.indexOf(id), j = i + delta
  if (j < 0 || j >= ids.length) return cats
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  return renumber(cats, ids)
}

/** Move an item under another row in the same category (§5.3). */
export function moveTo(cats: Cat[], id: number, parentId: number) {
  const n = nodeOf(cats, id)
  if (n.cat.parentId === parentId) return { cats }
  const oldSiblings = siblingsOf(cats, n.cat.parentId).map(s => s.cat.id).filter(x => x !== id)
  return attach(renumber(cats, oldSiblings), n.cat, parentId)
}

/** Rows an item can move under: its category and that category's other rows (not other items' children). */
export function moveTargets(n: CatNode): CatNode[] {
  let root = n
  while (root.parent) root = root.parent
  return [root, ...root.children.filter(c => c !== n)]
}

/** Items can move; categories (top level) and rows that have items can't. */
export const canMoveTo = (n: CatNode) => !!n.parent && n.children.length === 0
