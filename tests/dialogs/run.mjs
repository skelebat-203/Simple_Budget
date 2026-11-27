// Dialog focus harness (v0.7 step 1): opens each dialog in headless Chromium and checks
// focus start, Tab trap, Escape, focus return and stacked dialogs.
// Run: npm run build, then npm run test:dialogs. See README.md.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const PORT = 4173
const URL = `http://127.0.0.1:${PORT}/`
const SHELL_PATH = 'tools/browsers/chrome-headless-shell-linux64/chrome-headless-shell'
const WIDTH = 1280
const NARROW = 375
const HEIGHT = 900
const SETTLE_MS = 150
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** CHROME_PATH, else the project's tools folder (a worktree finds the main checkout's, two levels up). */
const chrome = [process.env.CHROME_PATH, resolve(root, SHELL_PATH), resolve(root, '../..', SHELL_PATH)].find(p => p && existsSync(p))
if (!chrome) { console.error(`No browser: set CHROME_PATH or install chrome-headless-shell at ${SHELL_PATH}`); process.exit(2) }

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(URL)).ok) break } catch { /* not up yet */ }
  await sleep(200)
}

const verbose = process.argv.includes('--verbose') // quiet by default: only FAIL lines and the total
let passed = 0, failed = 0
const check = (name, ok, detail = '') => { if (ok) passed++; else failed++; if (!ok || verbose) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`) }

const browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'], defaultViewport: { width: WIDTH, height: HEIGHT } })
const page = await browser.newPage()
const settle = () => sleep(SETTLE_MS)

/** Open dialogs' ids, bottom to top. */
const openIds = () => page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map(d => d.id))
/** Is focus inside the dialog with this id? And is it the dialog itself? */
const focusIn = id => page.evaluate(i => { const d = document.getElementById(i); const a = document.activeElement; return { inside: !!d && d.contains(a), self: a === d } }, id)
const activeId = () => page.evaluate(() => document.activeElement?.id ?? '')
const press = async (key, shift = false) => { if (shift) await page.keyboard.down('Shift'); await page.keyboard.press(key); if (shift) await page.keyboard.up('Shift'); await settle() }
const clickId = async id => { await page.click(`[id="${id}"]`); await settle() }

/** The checks every dialog gets: focus on open, Tab and Shift+Tab stay inside, Escape closes it and focus returns to the opener. */
async function standard(name, id, openerId, { returns = true, selfFocus = true } = {}) {
  check(`${name}: opens`, (await openIds()).at(-1) === id, JSON.stringify(await openIds()))
  const f = await focusIn(id)
  check(`${name}: focus starts ${selfFocus ? 'on the dialog' : 'inside the dialog'}`, selfFocus ? f.self : f.inside, JSON.stringify(f))
  let stayed = true
  for (let i = 0; i < 40; i++) { await press('Tab'); if (!(await focusIn(id)).inside) { stayed = false; break } }
  check(`${name}: Tab stays inside`, stayed)
  await press('Tab', true)
  check(`${name}: Shift+Tab stays inside`, (await focusIn(id)).inside)
  await press('Escape')
  check(`${name}: Escape closes it`, !(await openIds()).includes(id), JSON.stringify(await openIds()))
  if (returns && openerId) check(`${name}: focus returns to the opener`, (await activeId()) === openerId, `active: ${await activeId()}`)
}

/**
 * Table controls (digital_accessibility.md, Tables; v0.7 group B audit): every interactive control inside a
 * visible data table has a name unique in that table and an aria-describedby that includes its row header's id
 * (a row with no header of its own, such as Budget setup's Create row, points at a row header in the same table).
 */
async function tableRules(label) {
  const r = await page.evaluate(() => {
    const textOf = id => document.getElementById(id)?.textContent.trim() ?? ''
    const nameOf = el => {
      const by = el.getAttribute('aria-labelledby')
      if (by) return by.split(/\s+/).map(textOf).join(' ')
      if (el.getAttribute('aria-label')) return el.getAttribute('aria-label')
      const lab = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label')
      return (lab ?? el).textContent.replace(/\s+/g, ' ').trim()
    }
    const out = { tables: 0, controls: 0, noKey: [], dupes: [] }
    for (const t of document.querySelectorAll('table')) {
      if (!t.getClientRects().length) continue
      out.tables++
      const seen = new Map()
      for (const el of t.querySelectorAll('button, input, select, textarea, a[href], [role=menuitem]')) {
        if (!el.getClientRects().length) continue
        out.controls++
        const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
        const own = el.closest('tr')?.querySelector('th[scope=row]')
        const ok = own ? ids.includes(own.id) && !!own.id : ids.some(i => document.getElementById(i)?.matches('th[scope=row]') && t.contains(document.getElementById(i)))
        if (!ok) out.noKey.push(el.id || nameOf(el))
        const n = nameOf(el)
        if (seen.has(n)) out.dupes.push(n); else seen.set(n, 1)
      }
    }
    return out
  })
  check(`${label}: ${r.controls} table controls in ${r.tables} table(s) are described by their row header`, r.controls > 0 && r.noKey.length === 0, r.noKey.slice(0, 5).join(', '))
  check(`${label}: table control names are unique`, r.dupes.length === 0, r.dupes.slice(0, 5).join(', '))
}

try {
  // Update popup data (0016 §4): every merge to main bumps the version, so the newest release must be for the
  // version in package.json and have changes. A merge with no new entry fails here.
  const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
  const appVersion = readJson('package.json').version
  const newest = readJson('src/updates/updates.json').releases.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0]
  check(`Update popup data: the newest release is for v${appVersion}, with changes (update src/updates/updates.json)`, newest?.version === appVersion && newest.changes.length > 0, JSON.stringify(newest?.version))

  await page.goto(URL, { waitUntil: 'networkidle0' })
  await settle()

  // First run: the wizard opens by itself.
  check('first load: wizard opens', (await openIds()).includes('onboarding'), JSON.stringify(await openIds()))
  await clickId('onboarding-skip')
  check('first load: Skip closes it', (await openIds()).length === 0)

  // Sync lives in the Backup dialog (2026-11-26): no Sync button on the screens; Backup is the last button in the tab row.
  check('Sync: no Sync button on the screens', await page.evaluate(() => !document.getElementById('sync')))
  check('Sync: Backup is the last button in the tab row', await page.evaluate(() => document.querySelector('.tab-row > :last-child')?.textContent?.trim() === 'Backup'))
  // Range is a three-option toggle (radio group), not buttons.
  await clickId('tab-budget')
  check('Range: a radio group of Week, Month, Annual', await page.evaluate(() => {
    const g = [...document.querySelectorAll('#tabpanel-budget [role=radiogroup]')].find(r => r.getAttribute('aria-labelledby'))
    return !!g && [...g.querySelectorAll('input[type=radio]')].length === 3 && g.textContent.replace(/\s/g, '') === 'WeekMonthAnnual' && !document.querySelector('#tabpanel-budget [aria-pressed]')
  }))
  await clickId('tab-add')

  // The version shows at the top of the app.
  check('Version: shown at the top as vN.N.N', await page.evaluate(() => /^v\d+\.\d+\.\d+$/.test(document.getElementById('app-version')?.textContent ?? '')))
  // Add purchase: Item Search has no help; Amount and Description have info buttons that open a floating note (2026-11-26).
  check('Add purchase: Item Search label, no supporting text', await page.evaluate(() => document.querySelector('label[for=item]')?.textContent.trim().startsWith('Item Search') && !document.getElementById('item-help')))
  const infoState = name => page.evaluate(n => document.querySelector(`#tabpanel-add button[aria-label="${n} help"]`)?.getAttribute('aria-expanded'), name)
  const infoOpen = () => page.evaluate(() => document.querySelectorAll('#tabpanel-add .info-note').length)
  check('Info: closed by default; the text stays in the page for screen readers', (await infoState('Amount')) === 'false' && await page.evaluate(() => !!document.getElementById('amount-help')?.textContent && document.getElementById('amount')?.getAttribute('aria-describedby')?.includes('amount-help')))
  await page.evaluate(() => document.querySelector('#tabpanel-add button[aria-label="Amount help"]').click()); await settle()
  check('Info: the button opens the note', (await infoState('Amount')) === 'true' && (await infoOpen()) === 1)
  await press('Escape')
  check('Info: Escape closes the note only', (await infoState('Amount')) === 'false' && (await infoOpen()) === 0 && (await openIds()).length === 0)
  await page.evaluate(() => document.querySelector('#tabpanel-add button[aria-label="Description help"]').click()); await settle()
  await page.evaluate(() => document.getElementById('amount').focus()); await page.mouse.click(5, 5); await settle()
  check('Info: pressing outside closes the note', (await infoOpen()) === 0)

  // Wizard steps (v0.7 step 3b): sync first, the count follows the path.
  const stepText = () => page.evaluate(() => document.getElementById('onboarding-step')?.textContent ?? '')
  await clickId('help-button')
  check('wizard: step 1 is the sync choice', await page.evaluate(() => !!document.getElementById('sync_mode-local')?.matches(':checked')))
  check('wizard: no pay frequency step', await page.evaluate(() => !document.querySelector('[name=pay_frequency]')))
  check('wizard: Step 1 of 2 (Local only)', (await stepText()) === 'Step 1 of 2', await stepText())
  await page.click('label:has(#sync_mode-google)'); await settle()
  check('wizard: Sync with Google shows tabs', await page.evaluate(() => document.querySelectorAll('#onboarding [role=tab]').length === 2 && !!document.querySelector('#onboarding [role=tabpanel]')))
  await page.focus('#wizard-tab-new'); await press('ArrowRight')
  check('wizard: arrow key moves to Existing Budget', (await activeId()) === 'wizard-tab-existing' && await page.evaluate(() => document.getElementById('wizard-tab-existing')?.getAttribute('aria-selected') === 'true'))
  check('wizard: Existing Budget is Step 1 of 1 with Done', (await stepText()) === 'Step 1 of 1' && await page.evaluate(() => !!document.getElementById('onboarding-done')), await stepText())
  await clickId('onboarding-done')
  check('wizard: Done before linking shows an error', await page.evaluate(() => !!document.querySelector('#onboarding .error')))
  await page.click('label:has(#sync_mode-local)'); await settle()
  await clickId('onboarding-next')
  check('wizard: Next goes to Step 2 of 2', (await stepText()) === 'Step 2 of 2', await stepText())
  check('wizard: pay frequency help points to Advanced options', await page.evaluate(() => [...document.querySelectorAll('#onboarding .help')].some(p => p.textContent.includes('Advanced options'))))
  await press('Escape')

  // Help button reopens the wizard.
  await clickId('help-button')
  await standard('wizard (help button)', 'onboarding', 'help-button', { selfFocus: false }) // the wizard moves focus to its first answer

  // Backup.
  const backupId = await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Backup')?.id ?? '')
  check('Backup button has an id', !!backupId)
  await clickId(backupId)
  await standard('Backup', 'backup-dialog', backupId)

  // Budget setup, through the wizard's Advanced options.
  await clickId('help-button')
  await clickId('onboarding-advanced-options')
  check('Budget setup: opens from the wizard', (await openIds()).at(-1) === 'setup', JSON.stringify(await openIds()))
  const footer = await page.evaluate(() => { const r = document.querySelector('#setup .dialog-actions')?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom } : null })
  check('Budget setup: footer visible in the viewport', !!footer && footer.top >= 0 && footer.bottom <= HEIGHT, JSON.stringify(footer))
  const named = await page.evaluate(() => document.getElementById('setup')?.getAttribute('aria-labelledby') === 'setup-title' && !!document.getElementById('setup-title'))
  check('Budget setup: named by its heading', named)
  await standard('Budget setup', 'setup', '', { returns: false })
  // Table controls, with each category's Create row open so its fields are checked too.
  await clickId('help-button')
  await clickId('onboarding-advanced-options')
  await page.evaluate(() => document.querySelectorAll('#setup button[id^=create-][id$=-add]').forEach(b => b.click())); await settle()
  await tableRules('Budget setup')
  await press('Escape')

  // Seed a row: add a Groceries purchase, then show the Week table.
  await clickId('tab-add')
  await page.click('#item')
  await page.keyboard.type('Groc')
  await settle()
  await press('ArrowDown')
  await press('Enter')
  await page.click('#amount')
  await page.keyboard.type('12.50')
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save')?.click())
  await sleep(500)
  // Two Incidentals › Miscellaneous purchases with descriptions for the Misc. Breakdown (0014).
  for (const desc of ['Car wash', 'Stamps', 'coffee shops']) {
    await page.click('#item'); await page.keyboard.type('Misc'); await settle()
    await press('ArrowDown'); await press('Enter') // the first Miscellaneous offered is Incidentals'
    await page.click('#amount'); await page.keyboard.type('4')
    await page.click('#description'); await page.keyboard.type(desc)
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save')?.click())
    await sleep(500)
  }

  /** Open the menu behind this button from the keyboard and pick the item with this label. */
  async function pick(buttonId, label) {
    await page.focus(`[id="${buttonId}"]`); await press('ArrowDown')
    const at = await page.evaluate((b, l) => [...document.querySelectorAll(`[id="${b}-menu"] [role=menuitem]`)].findIndex(m => m.textContent.trim() === l), buttonId, label)
    for (let i = 0; i < at; i++) await press('ArrowDown')
    await press('Enter')
    return at >= 0
  }
  const said = () => page.evaluate(() => document.getElementById('live-region')?.textContent ?? '')
  /** The menu's box is inside the window (D006). */
  const menuInWindow = id => page.evaluate(i => { const r = document.getElementById(`${i}-menu`)?.getBoundingClientRect(); return !!r && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }, id)

  // Day table under Add purchase (v0.7 step 15d): an Update button on each purchase, no other controls.
  await tableRules('Day table (Add purchase)')
  const dayButtons = await page.evaluate(() => [...document.querySelectorAll('#tabpanel-add .day-table tbody button')].map(b => b.textContent.trim()))
  check('Day table: only Update buttons', dayButtons.length === 4 && dayButtons.every(t => t === 'Update'), dayButtons.join())
  const dayUpdate = await page.evaluate(() => document.querySelector('#tabpanel-add .day-table tbody button')?.id ?? '')
  await clickId(dayUpdate)
  const dayDlg = (await openIds()).at(-1)
  check('Day Update: opens the purchase form with Delete', !!dayDlg && await page.evaluate(i => !!document.querySelector(`#${CSS.escape(i)} #${CSS.escape(i)}-item`) && [...document.querySelectorAll(`#${CSS.escape(i)} button`)].some(b => b.textContent.trim() === 'Delete'), dayDlg))
  await standard('Day Update', dayDlg, dayUpdate)

  await clickId('tab-budget')
  const range = async r => { await page.evaluate(r => [...document.querySelectorAll('#tabpanel-budget [role=radiogroup] .toggle-option')].find(l => l.textContent.trim() === r)?.querySelector('input')?.click(), r); await settle() }
  check('Budget: no Day view', (await page.evaluate(() => [...document.querySelectorAll('#tabpanel-budget [role=radiogroup] .toggle-option')].map(l => l.textContent.trim()))).join() === 'Week,Month,Annual')
  await range('Annual')
  await tableRules('Annual and Misc. Breakdown tables')
  check('Annual: no Actions menu, a pencil to rename', await page.evaluate(() => !document.querySelector('#tabpanel-budget .budget-table [aria-haspopup=menu]') && !!document.querySelector('#tabpanel-budget [id^=rename-]')))
  check('Misc. Breakdown: rows in alphabetical order', await page.evaluate(() => [...document.querySelectorAll('.misc-table tbody th')].map(t => t.textContent).join() === 'Car wash,coffee shops,Stamps'))
  await clickId('misc-save-car-wash'); await sleep(500)
  check('Misc. Breakdown: Save for future moves the row out', await page.evaluate(() => [...document.querySelectorAll('.misc-table tbody th')].map(t => t.textContent).join() === 'coffee shops,Stamps'))
  check('Misc. Breakdown: Save for future is announced', /Saved Car wash for future/.test(await said()))
  check('Misc. Breakdown: Car wash is now an Annual row', await page.evaluate(() => [...document.querySelectorAll('.budget-table:not(.misc-table) tbody th')].some(t => t.textContent.includes('Car wash'))))
  // Merge (0014 M2): "coffee shops" matches the existing Coffee Shops item, so its purchase moves there.
  await clickId('misc-save-coffee-shops'); await sleep(500)
  const merged = await page.evaluate(() => ({
    misc: [...document.querySelectorAll('.misc-table tbody th')].map(t => t.textContent).join(),
    rows: [...document.querySelectorAll('#tabpanel-budget .budget-table:not(.misc-table) tbody th')].map(t => t.textContent.trim()).filter(t => /coffee shops/i.test(t)),
  }))
  check('Misc. Breakdown: a name that exists merges into that item', merged.misc === 'Stamps' && merged.rows.join() === 'Coffee Shops', JSON.stringify(merged))
  check('Misc. Breakdown: the merge is announced', (await said()) === 'Moved 1 purchase to Coffee Shops.')

  await range('Week')
  await tableRules('Week table')
  check('Week: no Up or Down buttons', await page.evaluate(() => ![...document.querySelectorAll('button')].some(b => /^Move .* (up|down)$/.test(b.getAttribute('aria-label') ?? ''))))
  const rowMenu = await page.evaluate(() => document.querySelector('[aria-haspopup="menu"][aria-label="Actions for Groceries"]')?.id ?? '')
  check('Week table: Groceries row has an Actions menu', !!rowMenu)
  if (rowMenu) {
    await page.focus(`[id="${rowMenu}"]`); await press('ArrowDown')
    check('Actions menu: New purchase and Update', (await page.evaluate(i => [...document.querySelectorAll(`[id="${i}-menu"] [role=menuitem]`)].map(m => m.textContent.trim()).join(), rowMenu)) === 'New purchase,Update')
    check('Actions menu: inside the window', await menuInWindow(rowMenu))
    await tableRules('Week table, Actions menu open')
    await press('Escape')

    // Delete is in the Update dialog: a confirmation over the table (Groceries has one purchase, so it may go).
    await pick(rowMenu, 'Update')
    const up = (await openIds()).at(-1)
    check('Update: opens with Name, Total and Move to', up === 'budget-update' && await page.evaluate(() => ['budget-update-name', 'budget-update-amount', 'budget-update-move_to'].every(i => !!document.getElementById(i))))
    check('Update: no supporting text under Move to; the Name warning has an icon', await page.evaluate(() => !document.getElementById('budget-update-move_to-help') && !!document.querySelector('#budget-update-name-help .banner-icon')))
    await page.mouse.click(2, 2); await settle()
    check('Update: a click outside the dialog closes it', !(await openIds()).includes('budget-update'), JSON.stringify(await openIds()))
    await pick(rowMenu, 'Update')
    await page.evaluate(() => [...document.querySelectorAll('#budget-update button')].find(b => b.textContent.trim() === 'Delete')?.click()); await settle()
    const confirmId = (await openIds()).at(-1)
    check('confirm: Delete opens a confirmation', confirmId === 'budget-delete', JSON.stringify(await openIds()))
    if (confirmId) {
      const buttons = await page.evaluate(i => [...document.querySelectorAll(`#${CSS.escape(i)} .dialog-actions button`)].map(b => b.textContent.trim()), confirmId)
      check('confirm: buttons are Cancel then Delete', buttons.join() === 'Cancel,Delete', buttons.join())
      check('confirm: described by its message', await page.evaluate(i => { const d = document.getElementById(i); const t = document.getElementById(d.getAttribute('aria-describedby') ?? ''); return !!t && t.textContent.length > 0 }, confirmId))
      await standard('confirm', confirmId, rowMenu)
    }

    // Update: the total for the week (amount) adds the difference.
    await pick(rowMenu, 'Update')
    await page.click('#budget-update-amount', { clickCount: 3 }); await page.keyboard.type('20')
    await page.evaluate(() => document.querySelector('#budget-update button[type=submit]')?.click()); await sleep(500)
    check('Update: a new total is saved and announced', /^Updated Groceries: set the total for Week of .* to 20\.00\.$/.test(await said()), await said())
    check('Update: focus returns to the Actions button', (await activeId()) === rowMenu, `active: ${await activeId()}`)
    check('Update: the Week total shows 20.00', await page.evaluate(i => document.getElementById(i)?.closest('tr')?.textContent.includes('20.00') ?? false, rowMenu))

    // New purchase: the Add purchase form's order (Amount, Description, Date) and info buttons (none on Date).
    await pick(rowMenu, 'New purchase')
    const np = await page.evaluate(() => {
      const d = document.getElementById('budget-new'); if (!d) return null
      return { order: [...d.querySelectorAll('.field label')].map(l => l.textContent.replace('*', '').trim()).join(), info: [...d.querySelectorAll('.field')].map(f => !!f.querySelector('.info-button')).join(), help: [...d.querySelectorAll('.help')].length }
    })
    check('New purchase: Amount, Description, Date; info buttons on the first two only', !!np && np.order === 'Amount,Description,Date' && np.info === 'true,true,false' && np.help === 0, JSON.stringify(np))
    await press('Escape')
  }
  // Week table: the expand button follows the name, and Show estimates sits at the right of the date row.
  check('Week table: the expand button comes after the name', await page.evaluate(() => { const l = document.querySelector('#tabpanel-budget .budget-table .name-line:has(.chevron)'); return !!l && l.querySelector('.name-link')?.compareDocumentPosition(l.querySelector('.chevron')) === Node.DOCUMENT_POSITION_FOLLOWING }))
  check('Budget tables: no caption; each is named by a heading', await page.evaluate(() => [...document.querySelectorAll('table.budget-table')].every(t => !t.querySelector('caption') && (t.getAttribute('aria-labelledby') ?? '').split(' ').some(i => /^H[1-6]$/.test(document.getElementById(i)?.tagName ?? '')))))
  check('Week: Show estimates is in line with the table heading, at the right', await page.evaluate(() => { const h = document.querySelector('#tabpanel-budget .table-heading'); const t = h?.querySelector('.table-title')?.getBoundingClientRect(); const c = h?.querySelector('.check')?.getBoundingClientRect(); return !!t && !!c && Math.abs((t.top + t.bottom) / 2 - (c.top + c.bottom) / 2) < 4 && h.getBoundingClientRect().right - c.right < 40 }))

  // A table dialog: highlight, with New purchase stacked on top of it.
  const nameId = await page.evaluate(() => document.querySelector('button.name-link')?.id ?? '')
  check('Week table: a row name button exists', !!nameId)
  if (nameId) {
    await clickId(nameId)
    const hl = (await openIds()).at(-1)
    check('highlight: opens', !!hl && hl.endsWith('-highlight'), JSON.stringify(await openIds()))
    await tableRules('highlight')
    const actionsBtn = await page.evaluate(h => document.querySelector(`#${CSS.escape(h)} [aria-haspopup="menu"]`)?.id ?? '', hl)
    check('highlight: has an Actions menu in an Actions column', !!actionsBtn && await page.evaluate(h => [...document.querySelectorAll(`#${CSS.escape(h)} thead th`)].at(-1)?.textContent.trim() === 'Actions', hl))
    if (actionsBtn) {
      await clickId(actionsBtn)
      check('highlight: Actions menu inside the window', await menuInWindow(actionsBtn))
      await press('Enter') // first item
      const ids = await openIds()
      check('stacked: a dialog opens over the highlight', ids.length === 2 && ids[0] === hl, JSON.stringify(ids))
      const top = ids.at(-1)
      check('stacked: focus is in the top dialog', (await focusIn(top)).inside)
      await press('Tab')
      await press('Tab', true)
      check('stacked: Tab keeps focus in the top dialog', (await focusIn(top)).inside && !(await focusIn(hl)).self)
      await press('Escape')
      const after = await openIds()
      check('stacked: Escape closes only the top dialog', after.length === 1 && after[0] === hl, JSON.stringify(after))
      check('stacked: focus returns to the Actions button', (await activeId()) === actionsBtn, `active: ${await activeId()}`)
    }
    await press('Escape')
    check('highlight: Escape closes it', (await openIds()).length === 0)
    check('highlight: focus returns to the row name', (await activeId()) === nameId, `active: ${await activeId()}`)
  }

  // Move to in the Update dialog (v0.7 step 15d), keyboard only, in the Incidentals highlight (Week).
  const incId = await page.evaluate(() => [...document.querySelectorAll('button.name-link')].find(b => b.textContent.trim() === 'Incidentals')?.id ?? '')
  check('Move: Incidentals row name exists', !!incId)
  if (incId) {
    await page.focus(`[id="${incId}"]`); await press('Enter')
    const hl = (await openIds()).at(-1)
    const q = sel => `#${hl} ${sel}`
    const kids = () => page.evaluate(s => [...document.querySelectorAll(s)].map(t => t.textContent.trim()), q('tbody tr.depth-1 th .name-line > span:first-child'))
    const idOf = label => page.evaluate(s => document.querySelector(s)?.id ?? '', q(`[aria-label="${label}"]`))
    /** Update a row's Move to: open Actions › Update, choose the place by its label, Save. Returns the dialog's error text. */
    async function moveVia(row, label) {
      // A repeated name is spoken with its parent ("Miscellaneous, Incidentals").
      await pick(await page.evaluate(s => document.querySelector(s)?.id ?? '', q(`[aria-label="Actions for ${row}"], ${q(`[aria-label^="Actions for ${row}, "]`)}`)), 'Update')
      const ok = await page.evaluate(l => { const s = document.getElementById('budget-hl-update-move_to'); const o = [...(s?.options ?? [])].find(x => x.textContent === l); if (o) s.value = o.value; return !!o }, label)
      if (ok) await page.select('#budget-hl-update-move_to', await page.evaluate(() => document.getElementById('budget-hl-update-move_to').value))
      await page.evaluate(() => document.querySelector('#budget-hl-update button[type=submit]')?.click()); await sleep(500)
      const err = await page.evaluate(() => document.querySelector('#budget-hl-update .error')?.textContent ?? '')
      if ((await openIds()).includes('budget-hl-update')) await press('Escape')
      return ok ? err : `no option ${label}`
    }
    check('Move: rows listed alphabetically', (await kids()).join() === [...(await kids())].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).join(), (await kids()).join())
    // A name a sibling at the destination already uses is refused, and nothing changes.
    const clash = await moveVia('Miscellaneous', 'Expenses › Maintenance')
    check('Move: a name clash is refused with an Invalid message', /^Invalid: Name “Miscellaneous” already exists in Maintenance/.test(clash), clash)
    check('Move: the refused row stays', (await kids()).includes('Miscellaneous'))
    // An item into another subcategory: it leaves this highlight; focus goes to the highlighted row's Actions button.
    await moveVia('Coffee Shops', 'Expenses › Maintenance')
    check('Move: an item moves into another subcategory', !(await kids()).includes('Coffee Shops'), (await kids()).join())
    check('Move: the move is announced', (await said()) === 'Updated Coffee Shops: moved it to Expenses › Maintenance as an item.', await said())
    check('Move: focus goes to the highlighted row’s Actions button', (await activeId()) === await idOf('Actions for Incidentals'), `active: ${await activeId()}`)
    // A subcategory with items can't go inside another subcategory.
    const deep = await moveVia('Incidentals', 'Expenses › Medical')
    check('Move: a subcategory with items is refused', /^Error: Incidentals has \d+ items, so it cannot go inside another subcategory\. Move its items out first\.$/.test(deep), deep)
    // An item moved to a category becomes a subcategory.
    await moveVia('Car wash', 'Expenses')
    check('Move: an item moved to a category becomes a subcategory', (await said()) === 'Updated Car wash: moved it to Expenses as a subcategory.', await said())
    await press('Escape')
    const rowsNow = () => page.evaluate(() => [...document.querySelectorAll('#tabpanel-budget .budget-table:not(.misc-table) tbody tr[aria-level]')]
      .map(r => `${r.getAttribute('aria-level')}:${r.querySelector('th .name-link')?.textContent.trim()}`))
    const tree = await rowsNow()
    const coffee = tree.indexOf('3:Coffee Shops')
    const parentRow = tree.slice(0, coffee).reverse().find(r => r.startsWith('2:'))
    check('Move: the table shows Coffee Shops under Maintenance after the highlight closes', coffee > 0 && parentRow === '2:Maintenance', tree.join(' | '))
    check('Move: the table shows Car wash as a subcategory', tree.includes('2:Car wash'), tree.join(' | '))
    const subs = tree.filter(r => r.startsWith('2:')).map(r => r.slice(2))
    check('Sort: subcategories listed alphabetically', subs.join() === [...subs].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).join(), subs.join())
    // A row moved into a closed row: the main table opens it, so the row shows after the highlight closes.
    await page.evaluate(() => [...document.querySelectorAll('#tabpanel-budget [id^=expand-]')].find(x => x.closest('tr')?.querySelector('.name-link')?.textContent.trim() === 'Maintenance')?.click()); await settle()
    check('Move: Maintenance closed before the move', !(await rowsNow()).includes('3:Coffee Shops'), (await rowsNow()).join(' | '))
    const carId = await page.evaluate(() => [...document.querySelectorAll('button.name-link')].find(b => b.textContent.trim() === 'Car wash')?.id ?? '')
    await page.focus(`[id="${carId}"]`); await press('Enter')
    await moveVia('Car wash', 'Expenses › Maintenance')
    await press('Escape')
    const opened = await rowsNow()
    check('Move: the destination opens so the moved row shows', opened.includes('3:Car wash') && opened.includes('3:Coffee Shops'), opened.join(' | '))
  }

  // Add purchase (v0.7 step 15d): a subcategory with items saves to its Miscellaneous; a new row can go straight under a category.
  await clickId('tab-add')
  const saveForm = () => page.evaluate(() => [...document.querySelectorAll('#tabpanel-add button')].find(b => b.textContent.trim() === 'Save')?.click())
  const dayRows = () => page.evaluate(() => [...document.querySelectorAll('#tabpanel-add .day-table tbody tr:not(.purchase) th')].map(t => t.textContent.trim()))
  await page.click('#item'); await page.keyboard.type('Insurance'); await settle()
  await page.click('#amount'); await page.keyboard.type('30')
  await saveForm(); await sleep(500)
  check('Add purchase: a subcategory with items saves to a new Miscellaneous under it', /Saved Miscellaneous \(Insurance\): 30\.00/.test(await said()) && (await dayRows()).join().includes('Insurance,Miscellaneous'), `${await said()} | ${(await dayRows()).join()}`)
  await page.click('#item'); await page.keyboard.type('Pet care'); await settle()
  await page.click('#category'); await page.keyboard.type('Expenses'); await settle()
  await page.click('#amount'); await page.keyboard.type('15')
  await saveForm(); await sleep(500)
  const petRow = await page.evaluate(() => [...document.querySelectorAll('#tabpanel-add .day-table tbody tr')].find(r => r.querySelector('th')?.textContent.trim() === 'Pet care')?.className ?? '')
  check('Add purchase: a new row under a category is a subcategory', /depth-1/.test(petRow), `${await said()} | ${petRow}`)

  // Phones (375px): the date navigation fills the width; row menus stay inside the window (D006).
  await clickId('tab-budget')
  await page.setViewport({ width: NARROW, height: HEIGHT }); await settle()
  const nav = await page.evaluate(() => { const n = document.querySelector('.date-row > nav')?.getBoundingClientRect(); const p = document.getElementById('tabpanel-budget')?.getBoundingClientRect(); return n && p ? { nav: Math.round(n.width), panel: Math.round(p.width) } : null })
  check('375px: date navigation is the full width', !!nav && nav.nav === nav.panel, JSON.stringify(nav))
  const narrowMenu = await page.evaluate(() => document.querySelector('#tabpanel-budget [aria-haspopup=menu][aria-label^="Actions for"]')?.id ?? '')
  if (narrowMenu) {
    await page.evaluate(i => document.getElementById(i)?.scrollIntoView({ block: 'center', inline: 'center' }), narrowMenu)
    await clickId(narrowMenu)
    check('375px: Actions menu inside the window', await menuInWindow(narrowMenu))
    await press('Escape')
    await pick(narrowMenu, 'Update')
    const halves = d => page.evaluate(id => { const b = [...document.querySelectorAll(`#${id} .dialog-actions .actions .btn`)].map(x => Math.round(x.getBoundingClientRect().width)); const a = document.querySelector(`#${id} .dialog-actions .actions`)?.getBoundingClientRect().width ?? 0; return { b, a: Math.round(a) } }, d)
    const upHalves = await halves('budget-update')
    check('375px: Update, Cancel and Save take half the row each', upHalves.b.length === 2 && Math.abs(upHalves.b[0] - upHalves.b[1]) <= 1 && upHalves.b[0] * 2 + 20 >= upHalves.a - 2, JSON.stringify(upHalves))
    await press('Escape')
    await clickId('help-button'); await settle()
    const wizHalves = await halves('onboarding')
    check('375px: wizard, Cancel and Next take half the row each', wizHalves.b.length === 2 && Math.abs(wizHalves.b[0] - wizHalves.b[1]) <= 1 && wizHalves.b[0] * 2 + 20 >= wizHalves.a - 2, JSON.stringify(wizHalves))
    await press('Escape'); await settle()
  }
  check('375px: Show estimates wraps under the table heading', await page.evaluate(() => { const t = document.querySelector('#tabpanel-budget .table-title')?.getBoundingClientRect(); const c = document.querySelector('#tabpanel-budget .table-heading .check')?.getBoundingClientRect(); return !!t && !!c && c.top >= t.bottom - 1 }))

  // Update popup (2026-11-26): opens on the first open after an update, once per update (the version is kept per device).
  const reopen = async seen => {
    await page.evaluate(v => { if (v === null) localStorage.removeItem('simple-budget:last-seen-version'); else localStorage.setItem('simple-budget:last-seen-version', v) }, seen)
    await page.reload({ waitUntil: 'networkidle0' }); await settle()
  }
  await reopen('0.0.1')
  check('Update popup: opens after an update', (await openIds()).includes('update-popup'), JSON.stringify(await openIds()))
  const pop = await page.evaluate(() => {
    const d = document.getElementById('update-popup'); const x = d?.querySelector('.dialog-close'); const dr = d?.getBoundingClientRect(); const xr = x?.getBoundingClientRect()
    return d && x && dr && xr ? {
      border: getComputedStyle(d).borderTopWidth, xName: x.getAttribute('aria-label'), xTopRight: xr.top - dr.top < 20 && dr.right - xr.right < 20,
      title: d.querySelector('h2')?.textContent, bullets: d.querySelectorAll('.update-list li').length, issues: d.querySelector('.update-issues h3')?.textContent ?? '',
      xSize: Math.round(xr.width), titleClear: (() => { const h = d.querySelector('h2'); if (!h) return false; const r = document.createRange(); r.selectNodeContents(h); return r.getBoundingClientRect().right <= xr.left + 1 })(),
    } : null
  })
  check('Update popup: 3px border, an X named Close at the top right, bullets and Known Issues', !!pop && pop.border === '3px' && pop.xName === 'Close' && pop.xTopRight && pop.bullets > 0 && pop.issues === (readJson('src/updates/updates.json').knownIssues.length > 0 ? 'Known Issues' : ''), JSON.stringify(pop))
  check('Update popup: the title does not run under the X', !!pop && pop.titleClear, JSON.stringify(pop))
  await standard('Update popup', 'update-popup', '', { returns: false })
  await reopen('0.0.1')
  await page.click('#update-popup .dialog-close'); await settle()
  check('Update popup: the X closes it', !(await openIds()).includes('update-popup'), JSON.stringify(await openIds()))
  await reopen(await page.evaluate(() => localStorage.getItem('simple-budget:last-seen-version')))
  check('Update popup: not shown again for the same version', !(await openIds()).includes('update-popup'), JSON.stringify(await openIds()))
  await reopen(null)
  check('Update popup: an existing user with no stored version sees it once', (await openIds()).includes('update-popup'), JSON.stringify(await openIds()))
  await press('Escape')
} catch (e) {
  console.error(e)
  failed++
} finally {
  await browser.close()
  server.kill()
}
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
