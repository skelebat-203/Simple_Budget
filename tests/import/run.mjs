// Import test harness (0013 §11): `npm run test:import`. See tests/import/README.md.
// The database is fake-indexeddb; it must be installed before Dexie loads.
import 'fake-indexeddb/auto'
import { createServer } from 'vite'

const root = new URL('../..', import.meta.url).pathname
let pass = 0, fail = 0
const check = (ok, msg) => { if (ok) pass++; else fail++; console.log(ok ? 'PASS' : 'FAIL', msg) }

const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  for (const [title, file] of [['Reading and preview', 'node-checks.ts'], ['Database', 'db-checks.ts']]) {
    console.log(`— ${title}`)
    await (await server.ssrLoadModule(`/tests/import/${file}`)).run(check)
  }
} catch (e) {
  check(false, `harness error: ${e?.stack ?? e}`)
} finally {
  await server.close()
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
