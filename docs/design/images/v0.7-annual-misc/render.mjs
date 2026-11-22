// Renders option-*.html into the built app's Budget panel at 375px (mockup scope: 375 only).
import { spawn } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
const dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(dir, '../../../..')
const chrome = process.env.CHROME_PATH ?? resolve(root, '../..', 'tools/browsers/chrome-headless-shell-linux64/chrome-headless-shell')
const server = spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' })
const wait = ms => new Promise(r => setTimeout(r, ms))
await wait(2500)
const browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'] })
for (const f of readdirSync(dir).filter(f => /^option-.*\.html$/.test(f))) {
  const page = await browser.newPage()
  await page.setViewport({ width: 375, height: 800 })
  await page.goto('http://127.0.0.1:4175/', { waitUntil: 'networkidle0' })
  await page.evaluate(html => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); const m = document.querySelector('main') ?? document.body; m.innerHTML = '<section class="panel wide" id="mock">' + html + '</section>' }, readFileSync(resolve(dir, f), 'utf8'))
  await wait(200)
  await (await page.$('#mock')).screenshot({ path: resolve(dir, f.replace('.html', '-375.png')) })
  await page.close()
}
await browser.close()
server.kill()
