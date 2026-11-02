import { db } from './db'
import { isPreselected } from './preselected'

/** Seed tree from docs/design/0004-table-design.md. `*` rows are computed. */
interface SeedNode { name: string; color: string; computed?: boolean; children?: SeedNode[] }

const items = (color: string, names: string[]): SeedNode[] => names.map(name => ({ name, color }))
const sub = (name: string, names: string[]): SeedNode =>
  ({ name, color: 'lighter-orange', computed: true, children: items('even-lighter-orange', names) })

const TREE: SeedNode[] = [
  { name: 'Pay', color: 'blue' },
  { name: 'Incidental Income', color: 'blue' },
  { name: 'Taxes', color: 'red' },
  { name: 'Net Income', color: 'highlight-blue', computed: true },
  {
    name: 'Savings', color: 'green', computed: true,
    children: items('lighter-green', ['General Maintenance', 'Emergency', 'Roth 401k', 'Trad 401k', 'Roth IRA', 'IRA', '403b', 'HSA', 'FSA']),
  },
  {
    name: 'Expenses', color: 'orange', computed: true,
    children: [
      { name: 'Groceries', color: 'lighter-orange' },
      { name: 'Gas', color: 'lighter-orange' },
      { name: 'Gifts', color: 'lighter-orange' },
      sub('Charity', ['Miscellaneous', 'United Way', 'Wikipedia', 'Library']),
      sub('Incidentals', ['Coffee Shops', 'Treats', 'Snacks', 'Pet Stuff', 'Eat Food Out', 'Dates', 'Family Time', 'Clothing', 'Shoes', 'Gen. Self Care', 'Books', 'Alcohol', 'Hair Cuts', 'Decorations', 'Crafting', 'Miscellaneous']),
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
      for (const n of nodes) {
        const id = await db.categories.add({
          name: n.name, color: n.color, parentId, computed: !!n.computed,
          selected: isPreselected(n.name, parentName) || undefined,
        })
        if (n.children) await insert(n.children, id, n.name)
      }
    }
    await insert(TREE, null, null)
  })
}
