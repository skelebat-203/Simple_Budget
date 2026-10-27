import { db } from './db'

// Color tokens from docs/design/0004-table-design.md
const C = {
  blue: 'blue',
  red: 'red',
  highlightBlue: 'highlight-blue',
  green: 'green',
  lighterGreen: 'lighter-green',
  orange: 'orange',
  lighterOrange: 'lighter-orange',
  evenLighterOrange: 'even-lighter-orange',
}

async function add(name: string, parentId: number | null, color: string, computed: boolean): Promise<number> {
  return db.categories.add({ name, parentId, color, computed })
}

export async function seedCategories(): Promise<void> {
  const count = await db.categories.count()
  if (count > 0) return

  await db.transaction('rw', db.categories, async () => {
    // Top-level
    const pay = await add('Pay', null, C.blue, false)
    const incidental = await add('Incidental Income', null, C.blue, false)
    const taxes = await add('Taxes', null, C.red, false)
    const netIncome = await add('Net Income', null, C.highlightBlue, true)
    const savings = await add('Savings', null, C.green, true)
    const expenses = await add('Expenses', null, C.orange, true)

    // Savings items
    const savingsItems = [
      'General Maintenance', 'Emergency', 'Roth 401k', 'Trad 401k', 'Roth IRA',
      'IRA', '403b', 'HSA', 'FSA',
    ]
    for (const n of savingsItems) await add(n, savings, C.lighterGreen, false)

    // Expense subcategories
    const groceries = await add('Groceries', expenses, C.lighterOrange, false)
    const gas = await add('Gas', expenses, C.lighterOrange, false)
    const gifts = await add('Gifts', expenses, C.lighterOrange, false)

    const charity = await add('Charity', expenses, C.lighterOrange, true)
    const incidentals = await add('Incidentals', expenses, C.lighterOrange, true)
    const medical = await add('Medical', expenses, C.lighterOrange, true)
    const insurance = await add('Insurance', expenses, C.lighterOrange, true)
    const maintenance = await add('Maintenance', expenses, C.lighterOrange, true)
    const debt = await add('Debt', expenses, C.lighterOrange, true)
    const utilities = await add('Utilities', expenses, C.lighterOrange, true)
    const subscriptions = await add('Subscriptions', expenses, C.lighterOrange, true)

    // keep unused vars referenced
    void groceries; void gas; void gifts

    // Charity items
    for (const n of ['Miscellaneous', 'United Way', 'Wikipedia', 'Library']) {
      await add(n, charity, C.evenLighterOrange, false)
    }
    // Incidentals items
    for (const n of [
      'Coffee Shops', 'Treats', 'Snacks', 'Pet Stuff', 'Eat Food Out', 'Dates',
      'Family Time', 'Clothing', 'Shoes', 'Gen. Self Care', 'Books', 'Alcohol',
      'Hair Cuts', 'Decorations', 'Crafting', 'Miscellaneous',
    ]) {
      await add(n, incidentals, C.evenLighterOrange, false)
    }
    // Insurance items
    for (const n of ['Car', 'Life', 'Medical', 'Dental', 'Vision']) {
      await add(n, insurance, C.evenLighterOrange, false)
    }
    // Maintenance items
    for (const n of ['Car', 'House', 'Lawn Mowing', 'Miscellaneous']) {
      await add(n, maintenance, C.evenLighterOrange, false)
    }
    // Debt items
    for (const n of ['Mortgage', 'Credit Card']) {
      await add(n, debt, C.evenLighterOrange, false)
    }
    // Utilities items
    for (const n of ['Power', 'Water', 'Internet', 'Phone', 'Trash']) {
      await add(n, utilities, C.evenLighterOrange, false)
    }
    // Subscriptions items
    for (const n of [
      'Netflix', 'YouTube Premium', 'Prime', 'Dropout', 'Duolingo', 'LastPass',
      '1Password', 'Proton Suite', 'Nebula', 'Gym', 'Audible', 'Librio.fm',
    ]) {
      await add(n, subscriptions, C.evenLighterOrange, false)
    }

    void pay; void incidental; void taxes; void netIncome; void savings; void expenses; void medical
  })
}
