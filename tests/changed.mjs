// Runs only the test suites a change needs: `npm run test:changed`. Map and tiers: tests/README.md.
//   npm run test:changed                 files changed against main, committed or not
//   npm run test:changed -- {file} ...   those files instead (also: --verbose, --all)
//   npm run test:all                     every suite
import { spawnSync } from 'node:child_process'

const SUITE_ORDER = ['import', 'sync', 'dialogs']
const BUILD_TAIL_LINES = 30

/** A changed file runs every suite of every rule it matches. */
const RULES = [
  { test: /^(src\/import\/|src\/components\/import\/|tests\/import\/|docs\/test_sheets\/)/, suites: ['import'] },
  { test: /^(src\/storage\/sync\/|src\/components\/(Sync|WizardSync|syncForms|syncActions|useSyncState)|tests\/sync\/)/, suites: ['sync'] },
  { test: /^src\/(storage|budget)\//, suites: ['import', 'sync'] },
  { test: /^(src\/(components|screens|styles|rewards|updates)\/|src\/(App|main)\.tsx|tests\/dialogs\/|index\.html|vite\.config)/, suites: ['dialogs'] },
]
/** Files no suite covers. Anything else that no rule matches runs every suite. */
const IGNORED = /^(docs\/(?!test_sheets\/)|\.claude\/|RESUME-HERE\.md|package\.json$|.*\.md$|tests\/(changed\.mjs|README\.md)$)/

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const all = args.includes('--all')
const given = args.filter(a => !a.startsWith('--'))

const lines = (cmd, argv) => spawnSync(cmd, argv, { encoding: 'utf8' }).stdout.split('\n').filter(Boolean)
const files = given.length ? given : [...new Set([...lines('git', ['diff', '--name-only', 'main']), ...lines('git', ['ls-files', '--others', '--exclude-standard'])])]

const picked = new Set()
const unmapped = []
for (const f of files) {
  const hits = RULES.filter(r => r.test.test(f))
  if (hits.length) hits.forEach(r => r.suites.forEach(s => picked.add(s)))
  else if (!IGNORED.test(f)) unmapped.push(f)
}
const runAll = all || unmapped.length > 0
const suites = SUITE_ORDER.filter(s => runAll || picked.has(s))

console.log(`test:changed: ${files.length} file(s) → ${suites.join(', ') || 'no suites'}${unmapped.length && !all ? ` (not mapped, so all: ${unmapped.slice(0, 3).join(', ')})` : ''}`)

const failed = []
if (suites.includes('dialogs')) {
  const b = spawnSync('npm', ['run', 'build'], { encoding: 'utf8' })
  if (b.status !== 0) { console.log(`build failed:\n${(b.stdout + b.stderr).split('\n').slice(-BUILD_TAIL_LINES).join('\n')}`); process.exit(1) }
}
for (const s of suites) {
  const r = spawnSync('node', [`tests/${s}/run.mjs`, ...(verbose ? ['--verbose'] : [])], { stdio: 'inherit' })
  if (r.status !== 0) failed.push(s)
}
console.log(failed.length ? `test:changed: FAILED ${failed.join(', ')}` : `test:changed: all passed`)
process.exit(failed.length ? 1 : 0)
