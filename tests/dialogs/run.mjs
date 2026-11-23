// Dialog focus harness (v0.7 step 1): opens each dialog in headless Chromium and checks
// focus start, Tab trap, Escape, focus return and stacked dialogs.
// Run: npm run build, then npm run test:dialogs. See README.md.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
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

let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`); if (!ok) failed++ }

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
  await page.goto(URL, { waitUntil: 'networkidle0' })
  await settle()

  // First run: the wizard opens by itself.
  check('first load: wizard opens', (await openIds()).includes('onboarding'), JSON.stringify(await openIds()))
  await clickId('onboarding-skip')
  check('first load: Skip closes it', (await openIds()).length === 0)

  // Sync button (v0.7 step 3b): only in the Budget panel, beside the date controls; beside Screens when narrow.
  const syncIn = () => page.evaluate(() => { const b = document.getElementById('sync'); return b ? (b.closest('[id^=tabpanel-]')?.id ?? b.parentElement?.className ?? '') : null })
  check('Sync: not shown on Add purchase', await page.evaluate(() => !document.getElementById('sync')?.getClientRects().length))
  check('Sync: Backup is the last button in the tab row', await page.evaluate(() => document.querySelector('.tab-row > :last-child')?.textContent?.trim() === 'Backup'))
  await clickId('tab-budget')
  check('Sync: in the Budget panel', (await syncIn()) === 'tabpanel-budget', String(await syncIn()))
  check('Sync: after the date controls in reading order', await page.evaluate(() => document.querySelector('.date-row > nav + #sync') !== null))
  await page.setViewport({ width: NARROW, height: HEIGHT }); await settle()
  check('Sync (narrow): beside the Screens button', (await syncIn()) === 'menu-row', String(await syncIn()))
  check('Sync (narrow): one instance', await page.evaluate(() => document.querySelectorAll('#sync').length === 1))
  await page.setViewport({ width: WIDTH, height: HEIGHT }); await settle()
  await clickId('tab-add')

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
  await clickId('tab-budget')
  const range = async r => { await page.evaluate(r => [...document.querySelectorAll('[role=group][aria-label=Range] button')].find(b => b.textContent.trim() === r)?.click(), r); await settle() }
  await range('Day')
  await tableRules('Day table')
  await range('Annual')
  await tableRules('Annual and Misc. Breakdown tables')
  check('Misc. Breakdown: rows in alphabetical order', await page.evaluate(() => [...document.querySelectorAll('.misc-table tbody th')].map(t => t.textContent).join() === 'Car wash,coffee shops,Stamps'))
  await clickId('misc-save-car-wash'); await sleep(500)
  check('Misc. Breakdown: Save for future moves the row out', await page.evaluate(() => [...document.querySelectorAll('.misc-table tbody th')].map(t => t.textContent).join() === 'coffee shops,Stamps'))
  check('Misc. Breakdown: Save for future is announced', /Saved Car wash for future/.test(await page.evaluate(() => document.getElementById('live-region')?.textContent ?? '')))
  check('Misc. Breakdown: Car wash is now an Annual row', await page.evaluate(() => [...document.querySelectorAll('.budget-table:not(.misc-table) tbody th')].some(t => t.textContent.includes('Car wash'))))
  // Merge (0014 M2): "coffee shops" matches the existing Coffee Shops item, so its purchase moves there.
  await clickId('misc-save-coffee-shops'); await sleep(500)
  const merged = await page.evaluate(() => ({
    misc: [...document.querySelectorAll('.misc-table tbody th')].map(t => t.textContent).join(),
    rows: [...document.querySelectorAll('#tabpanel-budget .budget-table:not(.misc-table) tbody th')].map(t => t.textContent.trim()).filter(t => /coffee shops/i.test(t)),
  }))
  check('Misc. Breakdown: a name that exists merges into that item', merged.misc === 'Stamps' && merged.rows.join() === 'Coffee Shops', JSON.stringify(merged))
  check('Misc. Breakdown: the merge is announced', (await page.evaluate(() => document.getElementById('live-region')?.textContent ?? '')) === 'Moved 1 purchase to Coffee Shops.')
  await range('Week')
  await tableRules('Week table')
  await page.click('[aria-haspopup="menu"][aria-label="Edit Groceries"]'); await settle()
  await tableRules('Week table, Edit menu open')
  await press('Escape')

  // Confirm mode: Delete on the Groceries row (one purchase, no items).
  const rowMenu = await page.evaluate(() => document.querySelector('[aria-haspopup="menu"][aria-label="Edit Groceries"]')?.id ?? '')
  check('Week table: Groceries row has an Edit menu', !!rowMenu, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[aria-haspopup=menu],button.name-link')].map(m => m.id))))
  if (rowMenu) {
    await clickId(rowMenu)
    await page.evaluate(() => [...document.querySelectorAll('[role=menuitem]')].find(m => m.textContent.trim().startsWith('Delete'))?.click())
    await settle()
    const confirmId = (await openIds()).at(-1)
    check('confirm: Delete opens a dialog', !!confirmId, JSON.stringify(await openIds()))
    if (confirmId) {
      const buttons = await page.evaluate(i => [...document.querySelectorAll(`#${CSS.escape(i)} .dialog-actions button`)].map(b => b.textContent.trim()), confirmId)
      check('confirm: buttons are Cancel then Delete', buttons.join() === 'Cancel,Delete', buttons.join())
      check('confirm: described by its message', await page.evaluate(i => { const d = document.getElementById(i); const t = document.getElementById(d.getAttribute('aria-describedby') ?? ''); return !!t && t.textContent.length > 0 }, confirmId))
      await standard('confirm', confirmId, rowMenu)
    }
  }

  // A table dialog: highlight, with the Edit menu stacked on top of it.
  const nameId = await page.evaluate(() => document.querySelector('button.name-link')?.id ?? '')
  check('Week table: a row name button exists', !!nameId)
  if (nameId) {
    await clickId(nameId)
    const hl = (await openIds()).at(-1)
    check('highlight: opens', !!hl && hl.endsWith('-highlight'), JSON.stringify(await openIds()))
    await tableRules('highlight')
    const editBtn = await page.evaluate(h => document.querySelector(`#${CSS.escape(h)} [aria-haspopup="menu"]`)?.id ?? '', hl)
    check('highlight: has an Edit menu button', !!editBtn)
    if (editBtn) {
      await clickId(editBtn)
      await press('Enter') // first item (Rename)
      const ids = await openIds()
      check('stacked: Rename opens over the highlight', ids.length === 2 && ids[0] === hl, JSON.stringify(ids))
      const top = ids.at(-1)
      check('stacked: focus is in the top dialog', (await focusIn(top)).inside)
      await press('Tab')
      await press('Tab', true)
      check('stacked: Tab keeps focus in the top dialog', (await focusIn(top)).inside && !(await focusIn(hl)).self)
      await press('Escape')
      const after = await openIds()
      check('stacked: Escape closes only the top dialog', after.length === 1 && after[0] === hl, JSON.stringify(after))
      check('stacked: focus returns to the Edit button', (await activeId()) === editBtn, `active: ${await activeId()}`)
    }
    await press('Escape')
    check('highlight: Escape closes it', (await openIds()).length === 0)
    check('highlight: focus returns to the row name', (await activeId()) === nameId, `active: ${await activeId()}`)
  }

  // Move column (v0.7 step 11), keyboard only, in the Incidentals highlight (Week).
  const incId = await page.evaluate(() => [...document.querySelectorAll('button.name-link')].find(b => b.textContent.trim() === 'Incidentals')?.id ?? '')
  check('Move: Incidentals row name exists', !!incId)
  if (incId) {
    await page.focus(`[id="${incId}"]`); await press('Enter')
    const hl = (await openIds()).at(-1)
    const q = sel => `#${hl} ${sel}`
    const kids = () => page.evaluate(s => [...document.querySelectorAll(s)].map(t => t.textContent.trim()), q('tbody tr.depth-1 th .name-line > span:first-child'))
    const said = () => page.evaluate(() => document.getElementById('live-region')?.textContent ?? '')
    const errorText = () => page.evaluate(s => document.querySelector(s)?.textContent ?? '', q('.error'))
    const idOf = label => page.evaluate(s => document.querySelector(s)?.id ?? '', q(`[aria-label="${label}"]`))
    /** Open a row's Move to menu from the keyboard and pick the item with this label. */
    async function moveVia(row, label) {
      await page.focus(`[id="${await idOf(`Move ${row} to`)}"]`); await press('ArrowDown')
      const at = await page.evaluate((s, l) => [...document.querySelectorAll(s)].findIndex(m => m.textContent.trim() === l), q('[role=menuitem]'), label)
      for (let i = 0; i < at; i++) await press('ArrowDown')
      await press('Enter'); await sleep(500)
      return at >= 0
    }
    await tableRules('highlight with Move column')
    await page.focus(`[id="${await idOf(`Move ${(await kids())[0]} to`)}"]`); await press('ArrowDown')
    await tableRules('highlight, Move to menu open')
    await press('Escape')
    const before = await kids()
    check('Move: at least two rows to reorder', before.length >= 2, before.join())
    const upId = await idOf(`Move ${before[1]} up`)
    await page.focus(`[id="${upId}"]`); await press('Enter'); await sleep(500)
    const up = await kids()
    check('Move: Up swaps the row with the one above', up[0] === before[1] && up[1] === before[0], up.join())
    check('Move: focus stays on the Up button', (await activeId()) === upId, `active: ${await activeId()}`)
    check('Move: Up is announced', (await said()) === `Moved ${before[1]} up.`, await said())
    const downId = await idOf(`Move ${before[1]} down`)
    await page.focus(`[id="${downId}"]`); await press('Enter'); await sleep(500)
    check('Move: Down moves it back', (await kids()).join() === before.join(), (await kids()).join())
    // A name a sibling at the destination already uses is refused.
    check('Move: Miscellaneous offered Expenses › Maintenance', await moveVia('Miscellaneous', 'Expenses › Maintenance'))
    check('Move: a name clash is refused with an Invalid message', /^Invalid: .*“Miscellaneous” already exists in Maintenance/.test(await errorText()), await errorText())
    check('Move: the refused row stays', (await kids()).includes('Miscellaneous'))
    // An item into another subcategory: it leaves this highlight; focus goes to the highlighted row's Move to.
    await moveVia('Coffee Shops', 'Expenses › Maintenance')
    check('Move to: an item moves into another subcategory', !(await kids()).includes('Coffee Shops'), (await kids()).join())
    check('Move to: the move is announced', (await said()) === 'Moved Coffee Shops to Expenses › Maintenance as an item.', await said())
    check('Move to: focus goes to the highlighted row’s Move to', (await activeId()) === await idOf('Move Incidentals to'), `active: ${await activeId()}`)
    // A subcategory with items can't go inside another subcategory.
    await moveVia('Incidentals', 'Expenses › Medical')
    check('Move to: a subcategory with items is refused', /^Error: Incidentals has \d+ items, so it cannot go inside another subcategory\. Move its items out first\.$/.test(await errorText()), await errorText())
    // An item moved to a category becomes a subcategory.
    await moveVia('Car wash', 'Expenses')
    check('Move to: an item moved to a category becomes a subcategory', (await said()) === 'Moved Car wash to Expenses as a subcategory.', await said())
    await press('Escape')
    const tree = await page.evaluate(() => [...document.querySelectorAll('#tabpanel-budget .budget-table:not(.misc-table) tbody tr[aria-level]')]
      .map(r => `${r.getAttribute('aria-level')}:${r.querySelector('th .name-link')?.textContent.trim()}`))
    const coffee = tree.indexOf('3:Coffee Shops')
    const parentRow = tree.slice(0, coffee).reverse().find(r => r.startsWith('2:'))
    check('Move: the table shows Coffee Shops under Maintenance after the highlight closes', coffee > 0 && parentRow === '2:Maintenance', tree.join(' | '))
    check('Move: the table shows Car wash as a subcategory', tree.includes('2:Car wash'), tree.join(' | '))
  }
} catch (e) {
  console.error(e)
  failed++
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
