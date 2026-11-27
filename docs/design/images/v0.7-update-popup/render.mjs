// Renders update-popup.html at 375px.
// Run from the project root: node docs/design/images/v0.7-update-popup/render.mjs
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
const dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(dir, '../../../..')
const chrome = process.env.CHROME_PATH ?? resolve(root, 'tools/browsers/chrome-headless-shell-linux64/chrome-headless-shell')
const browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage()
await page.setViewport({ width: 407, height: 732 })
await page.goto(`file://${resolve(dir, 'update-popup.html')}`)
await page.screenshot({ path: resolve(dir, 'update-popup-375.png'), fullPage: true })
await browser.close()
