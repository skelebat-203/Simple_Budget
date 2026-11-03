import { db } from './db'
import { isPreselected } from './preselected'

/** Seed tree from 0004-table-design.md with the 0007 §2 Income group. `computed` marks top-level totals. */
interface SeedNode { name: string; color: string; computed?: boolean; children?: SeedNode[] }

const items = (color: string, names: string[]): SeedNode[] => names.map(name => ({ name, color }))
const sub = (name: string, names: string[]): SeedNode =>
  ({ name, color: 'lighter-orange', children: items('even-lighter-orange', names) })

const TREE: SeedNode[] = [
  { name: 'Income', color: 'blue', computed: true, children: items('blue', ['Pay', 'Incidental Income']) },
  { name: 'Taxes', color: 'red' },
  { name: 'Net Income', color: 'highlight-blue', computed: true },
  {
    name: 'Savings', color: 'green', computed: true,
    children: items('lighter-green', ['General Maintenance', 'Emergency', 'Roth 401k', 'Traditional 401k', 'Roth IRA', 'IRA', '403b', 'HSA', 'FSA']),
  },
  {
    name: 'Expenses', color: 'orange', computed: true,
    children: [
      { name: 'Groceries', color: 'lighter-orange' },
      { name: 'Gas', color: 'lighter-orange' },
      { name: 'Gifts', color: 'lighter-orange' },
      sub('Charity', ['Miscellaneous', 'United Way', 'Wikipedia', 'Library']),
      sub('Incidentals', ['Coffee Shops', 'Treats', 'Snacks', 'Pet Stuff', 'Eat Food Out', 'Dates', 'Family Time', 'Clothing', 'Shoes', 'General Self Care', 'Books', 'Alcohol', 'Hair Cuts', 'Decorations', 'Crafting', 'Miscellaneous']),
      sub('Medical', ['Miscellaneous']),
      sub('Insurance', ['Car', 'Life', 'Medical', 'Dental', 'Vision']),
      sub('Maintenance', ['Car', 'House', 'Lawn Mowing', 'Miscellaneous']),
      sub('Debt', ['Mortgage', 'Credit Card']),
      sub('Utilities', ['Power', 'Water', 'Internet', 'Phone', 'Trash']),
      sub('Subscriptions', ['Netflix', 'YouTube Premium', 'Prime', 'Dropout', 'Duolingo', 'LastPass', '1Password', 'Proton Suite', 'Nebula', 'Gym', 'Audible', 'Librio.fm']),
    ],
  },
]

export async function seedCategories(): Promise<void> {
  if ((await db.categories.count()) > 0) return
  await db.transaction('rw', db.categories, async () => {
    const insert = async (nodes: SeedNode[], parentId: number | null, parentName: string | null) => {
      // A list made only of items starts alphabetical (Income keeps Pay first).
      const sorted = parentName !== 'Income' && nodes.every(n => !n.children)
        ? [...nodes].sort((a, b) => a.name.localeCompare(b.name)) : nodes
      for (const [order, n] of sorted.entries()) {
        const id = await db.categories.add({
          name: n.name, color: n.color, parentId, order, computed: n.computed || undefined,
          selected: isPreselected(n.name, parentName) || undefined,
        })
        if (n.children) await insert(n.children, id, n.name)
      }
    }
    await insert(TREE, null, null)
  })
}
