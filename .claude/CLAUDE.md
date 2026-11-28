# Master Rules

Project-specific instructions for Simple_Budget. Complements the global
instruction set; does not override a direct user instruction about goal or
outcome.

## General rulesets
General rules load globally from `~/.claude/rules/` and `~/.claude/skills/`
(workflow, doc ownership, versioning, git, worktrees: `dev-workflow.md`,
`versioning.md`, `version-control.md`).
This project is network-exposed, so it uses the NETWORKED severity matrix:
- @~/.claude/rules-library/issue-severity-matrix_NETWORKED.md

## Project docs
- Roadmap: `docs/design/0003-roadmap.md`
- UI/UX review checklist (UI steps need human approval against it):
  `docs/design/0005-ui-ux-review-checklist.md`

## Mockups and prototypes
Save every mockup and prototype inside the project, never only in `/tmp/` or the
scratchpad: images in `docs/design/images/{version}-{topic}/` (HTML source beside
them), standalone prototypes in `docs/design/`. A mockup of several options shows
every option, each labelled with the name used in chat.

## Computed rows

The computed-row list lives in `0004-table-design.md`. The roadmap references
it; never restates it.

## Remote
GitHub remote: `origin`, https://github.com/skelebat-203/Simple_Budget.
Push rules are in the global `version-control.md`.

## Version numbering history
The per-commit patch numbering in the global `versioning.md` applies from v0.4.12 on (decided 2026-11-02). Earlier versions used the step-number rule. From v{first version under the new rule}, the patch goes up once per approved feature (decided 2026-11-28).

## Update popup (every merge to main)
The "What's new" popup lists changes and new known issues (`docs/design/0016-update-popup.md`;
data in `src/updates/updates.json`). Every merge to `main` updates it, in this order:
1. Draft a new `releases` entry (version = the version the merge lands at) from the feature's changes (the branch diff and what the human approved, not the checkpoint commits):
   user-visible changes only, plain words, grade 10 or lower, one short line each.
2. Add a `knownIssues` entry for each new open user-visible defect in `docs/defects/`; remove the ones fixed.
3. **The human reviews the Changes list before the merge is requested.** Do not ask to merge until they approve it.
4. Commit it in the feature's final commit, with the RESUME-HERE update and the version bump.
`npm run test:dialogs` fails if the newest release's version differs from `package.json`'s, so run it before asking to merge.

## Accessibility Overrides
- Exception to sticky content rules - in this app allow "Save" to be sticky in mobile unless the mobile screen has been zoomed.
- Allow the Import/Cancel footer in the review dialog to be sticky on desktop and mobile, unless the screen is short.

## Testing (standard process)
Test output costs tokens, so run only the suites a change needs. Map and tiers: `tests/README.md`.
- Every edit and end of a plan step: `npm run lint`, then `npm run test:changed`. Do not run a suite by hand when it covers it.
- Full run (`npm run test:all`, plus Lighthouse) only before the merge request and before the reviews.
- Runners are quiet (FAIL lines and a total). Use `--verbose` only to investigate a failure. Do not paste passing output.
- A new source folder or suite gets a row in the `tests/changed.mjs` map and in `tests/README.md` in the same change.

## Git
Use the git-broker MCP tools for git: git_status, git_diff, git_log, git_stage, git_commit, git_worktree_add, git_worktree_remove, git_merge, git_rebase. Do not run git directly; .git is read-only in the sandbox. Commit rules (checkpoints, final commit): global `version-control.md`. Commits and merges to main need the user's approval; the merge to main is a squash merge run by the user by hand.

