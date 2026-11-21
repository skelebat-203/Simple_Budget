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

## Computed rows

The computed-row list lives in `0004-table-design.md`. The roadmap references
it; never restates it.

## Remote
GitHub remote: `origin`, https://github.com/skelebat-203/Simple_Budget.
Push rules are in the global `version-control.md`.

## Version numbering history
The per-commit patch numbering in the global `versioning.md` applies from
v0.4.12 on (decided 2026-11-02). Earlier versions used the step-number rule.

## Accessibility Overrides
- Exception to sticky content rules - in this app allow "Save" to be sticky in mobile unless the mobile screen has been zoomed.

## Git
Use the git-broker MCP tools for git: git_status, git_diff, git_log, git_stage, git_commit, git_worktree_add, git_worktree_remove, git_merge, git_rebase. Do not run git directly; .git is read-only in the sandbox. Commits and merges to main need the user's approval.
