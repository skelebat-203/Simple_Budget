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
  await clickId('tab-budget')
  await page.evaluate(() => [...document.querySelectorAll('[role=group][aria-label=Range] button')].find(b => b.textContent.trim() === 'Week')?.click())
  await settle()

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
} catch (e) {
  console.error(e)
  failed++
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
