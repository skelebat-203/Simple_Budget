// Renders each option-*.html fragment in a <dialog open class="dialog"> over the built app (real CSS) at 1280 and 375px.
// Run from the worktree after npm run build: node docs/design/images/v0.7-move-rows/render.mjs
import { spawn } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from '/home/shash/Projects/Programming/Simple_Budget/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const PORT = 4174
const dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(dir, '../../../..')
const chrome = process.env.CHROME_PATH ?? '/home/shash/Projects/Programming/Simple_Budget/tools/browsers/chrome-headless-shell-linux64/chrome-headless-shell'
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'ignore' })
const wait = ms => new Promise(r => setTimeout(r, ms))
await wait(2500)
const browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'] })
try {
  for (const f of readdirSync(dir).filter(f => /^option-.*\.html$/.test(f))) {
    for (const width of [1280, 375]) {
      const page = await browser.newPage()
      await page.setViewport({ width, height: 900 })
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' })
      await page.evaluate(html => {
        document.querySelectorAll('dialog[open]').forEach(d => d.remove())
        const d = document.createElement('dialog')
        d.className = 'dialog'
        d.id = 'mock'
        d.style.position = 'static'
        d.innerHTML = `<style>.mock-label{font-weight:700;background:#ffe08a;color:#000;padding:4px 8px;margin:0 0 8px}</style><div class="dialog-body">${html}</div>`
        document.body.prepend(d)
        d.setAttribute('open', '')
      }, readFileSync(resolve(dir, f), 'utf8'))
      await wait(200)
      await (await page.$('#mock')).screenshot({ path: resolve(dir, f.replace('.html', `-${width}.png`)) })
      await page.close()
    }
  }
} finally {
  await browser.close()
  server.kill()
}
