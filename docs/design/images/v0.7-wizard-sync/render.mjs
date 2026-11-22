// Renders each option-*.html fragment inside the real wizard (built app, real CSS) at 1280 and 375px.
// Run from the worktree after npm run build: node docs/design/images/v0.7-wizard-sync/render.mjs
import { spawn } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
const dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(dir, '../../../..')
const chrome = process.env.CHROME_PATH ?? resolve(root, '../..', 'tools/browsers/chrome-headless-shell-linux64/chrome-headless-shell')
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' })
const wait = ms => new Promise(r => setTimeout(r, ms))
await wait(2500)
const browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'] })
for (const f of readdirSync(dir).filter(f => /^option-.*\.html$/.test(f))) {
  for (const width of [1280, 375]) {
    const page = await browser.newPage()
    await page.setViewport({ width, height: 900 })
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' })
    await page.evaluate(html => { document.querySelector('#onboarding .dialog-body').innerHTML = html }, readFileSync(resolve(dir, f), 'utf8'))
    await wait(200)
    await (await page.$('#onboarding')).screenshot({ path: resolve(dir, f.replace('.html', `-${width}.png`)) })
    await page.close()
  }
}
await browser.close()
server.kill()
