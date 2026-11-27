# Tests

Three suites, run by changed files. Goal: spend few tokens on test output, so every runner prints only FAIL lines and a total (`--verbose` prints every check).

| Suite | Script | Needs | Covers |
|---|---|---|---|
| import | `test:import` | Node | `src/import/**`, import writes to the database, `docs/test_sheets/` |
| sync | `test:sync` | Node | `src/storage/sync/**`, sync components |
| dialogs | `test:dialogs` | build, `chrome-headless-shell` | Dialog focus, table control names, Actions menu, sort order, update popup, 375px layout |

## Which suites a change runs

`npm run test:changed` reads the files changed against `main` (committed or not, plus new files) and runs the suites below. It builds first only when `dialogs` is chosen, and prints the build's last lines only if the build fails. `tests/changed.mjs` holds the map; keep this table and that map in step.

| Changed path | Runs |
|---|---|
| `src/import/**`, `src/components/import/**`, `tests/import/**`, `docs/test_sheets/**` | import |
| `src/storage/sync/**`, `src/components/{Sync,WizardSync,syncForms,syncActions,useSyncState}*`, `tests/sync/**` | sync |
| `src/storage/**`, `src/budget/**` | import and sync |
| `src/components/**`, `src/screens/**`, `src/styles/**`, `src/rewards/**`, `src/updates/**`, `App.tsx`, `main.tsx`, `index.html`, `vite.config*`, `tests/dialogs/**` | dialogs |
| `docs/**` (except `test_sheets`), `*.md`, `package.json`, `.claude/**` | none |
| anything else (for example `package-lock.json`, `src/notifications.ts`) | all |

A file can match several rows; the suites add up.

## Tiers

1. **Every edit:** `npm run lint`, then `npm run test:changed`. Do not run a suite by hand when this covers it.
2. **End of a plan step:** `npm run test:changed`. It builds when a UI file changed.
3. **Before the merge request and before the reviews:** `npm run test:all`, plus Lighthouse. This is the only full run. The update popup data check in `dialogs` (newest release matches the `package.json` version) only matters here.

## Reading results

- Passing runs print one line per suite (`{n} passed, 0 failed`). Do not re-run with `--verbose` to look at passes.
- On a failure, read the FAIL lines first. Re-run only that suite (`npm run test:{suite}`), and add `--verbose` only when the context of the failure is needed.

Suite details: `tests/import/README.md`, `tests/dialogs/README.md`.
