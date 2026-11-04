# Master Rules

Project-specific instructions for Simple_Budget. Complements the global
instruction set; does not override a direct user instruction about goal or
outcome.

## General rulesets
- @/home/shash/Documents/AI_rules/global/base-PERSONA.md
- @/home/shash/Documents/AI_rules/global/workflow-progress-updates.md
- @/home/shash/Documents/AI_rules/project_level_instructions/components.md
- @/home/shash/Documents/AI_rules/project_level_instructions/dev-environment.md
- @/home/shash/Documents/AI_rules/project_level_instructions/digital_accessibility.md
- @/home/shash/Documents/AI_rules/project_level_instructions/issue-severity-matrix_NETWORKED.md
- @/home/shash/Documents/AI_rules/project_level_instructions/security-domains.md
- @/home/shash/Documents/AI_rules/project_level_instructions/security-report-style.md
- @/home/shash/Documents/AI_rules/project_level_instructions/troubleshooting.md
- @/home/shash/Documents/AI_rules/versioning_instructions/version-control.md
- @/home/shash/Documents/AI_rules/versioning_instructions/versioning.md

## Doc ownership

- **`docs/design/0003-roadmap.md`** — scope. Versions, what work exists, in what
  order. Items are *commitments*, not suggestions.
- **`docs/design/000X-*.md`** — spec. Structure, models, seed data, behavior.
  Describes *what the thing is*, not *when it gets built*.
- **`docs/audits/security/ecurity-vX.Y.md`** — security findings per version.

Rule: **a fact lives in exactly one doc.** If a value appears in two places,
one owns it and the other references it. Roadmap references design docs; design
docs never restate roadmap content.

## Replan signal

When a design doc describes work not yet in the roadmap, that is a **replan
signal**, not a silent expansion. Bring it to the user, update the roadmap, then
build from the roadmap. Never implement from a design doc the roadmap does not
cover.

## Computed rows

The computed-row list lives in `0004-table-design.md`. The roadmap references
it; never restates it.

## Scratch files

- Human-made scratch files live in `docs/human_scratch_files/`.
- **Only the human deletes them.** We never delete, move, or edit a file in that
  folder. If a design doc exists for the same topic, we note the scratch file is
  stale and leave it alone.
- Scratch files are never a source of truth for implementation.

## Iteration

The user adds requirements when they see something missing or get feedback.

- New requirements go into the relevant design doc **and** the roadmap (if they
  are scope).
- When docs conflict, the newer doc wins — but **the conflict is surfaced to the
  user, not silently absorbed.**
- This must not produce unfinished files or let a non-final / tentative decision
  erase a final, decided item. Guardrails:
  - A doc still being written (no clear decision, marked TBD, half-fleshed) is
    **not authoritative** and cannot override a decided item in another doc.
  - Before accepting a conflict as a resolution, confirm the newer doc states a
    *final* decision. If it is tentative, ask.
  - Never delete or rewrite a decided item to make a doc consistent. Surface it
    and ask which one is intended.

## Remote override
The repo has a GitHub remote (`origin`, https://github.com/skelebat-203/Simple_Budget).
- Push to `origin main` after every version-bump commit.
- For other commits, push only when the user asks.
- Never force-push or rewrite pushed history without explicit approval.
- Before pushing, confirm `git status -sb` shows only the commits you intend to send.

## DOM id convention
- Form fields, radio groups and checkbox groups: `{name}` (e.g. Item field
  `id="item"`, label `for="item"`).
- Ids tied to a field: `{name}-{conditional_identifier}`, e.g. the Item
  error message is `item-error_msg`.
- Ids for data rows/options: `{field}-{parent}-{item}-{databaseId}`, e.g.
  `item-insurance-car-12`. The database id keeps it unique and stable on rename.
- Slug rule for names in ids: lowercase; every run of characters other than
  letters/digits becomes `-` (`Gen. Self Care` → `gen-self-care`).
- Existing code adopts this when a step touches it; no bulk sweep.

## Accessibility Overrides
- Exception to sticky content rules - in this app allow "Save" to be sticky in mobile unless the mobile screen has been zoomed.
## Version action plans
- Each version's plan of action lives in `RESUME-HERE.md`, under `## vX.Y plan of action`:
  - An intro line: versions follow "Version numbering" below; the final step bumps to the next minor version; UI steps need human approval (`0005-ui-ux-review-checklist.md`).
  - Numbered steps, each: **bold title** (vX.Y.N) — what it does; then sub-bullets `Source:` (roadmap item / design doc §), `Files:`, `Verify:`, `Deps:`. Mark ✅ when done, with the version(s) it landed in, e.g. `✅ (v0.4.12, v0.4.14)`.
  - An **Execution** block: the steps **grouped by the files they touch** (one group = one unit of work), with group order, which groups can run in parallel, and a status line (e.g. `✅ A · ⏳ B · ☐ C · ☐ reviews`).
  - UI/UX review, accessibility pass and security review are the last steps, run in the main session with the user.
- Before work starts, estimate which of the two cheapest ways to run it costs fewer tokens for that version's items, and tell the user with a short reason:
  1. **Single session with fresh restarts** — one session does the work and starts fresh at group boundaries; `RESUME-HERE.md` carries the state.
  2. **Grouped subagents** — one subagent per group; the main session coordinates, relays approval points and runs the reviews (UI/UX, accessibility, security) with the user.
- Rule of thumb: small or few items, or ones that need the user's approval often → option 1; many items in groups that touch separate files → option 2.

## Workflow agents use a worktree
Any workflow agent or session that builds a plan group (see "Version action plans") creates
its own git worktree and works only there. It never edits files in the main checkout.
- Create it from the latest `main`: `git worktree add .claude/worktrees/<version>-<group> -b worktree-<version>-<group> main` (e.g. `v0.6-group-b`). `.claude/` is git-ignored.
- Build, lint, test and commit in the worktree. Version bumps follow "Version numbering": before each commit, read the latest version on `main` (`git show main:package.json`) and rebase the worktree branch onto `main` first.
- **Merging to `main` needs explicit human approval, every time.** A workflow in a worktree never merges, pushes or fast-forwards `main` on its own. When the group (or a step) is done, it stops, reports the branch, commits and checks run, and waits. Approval of a UI step (`0005`) is not approval to merge; ask separately.
- After approval, bring it into `main` with a fast-forward merge (rebase first if `main` moved), then push per "Remote override". Never force-push or rewrite pushed history.
- Remove the worktree and its branch once merged (`git worktree remove`, `git branch -d`). Do not remove a worktree with uncommitted or unmerged work; ask the user.
- Docs-only edits by the main session with the user (design decisions, plan changes) may be made in the main checkout.

## Version numbering
Overrides the step-number rule in `versioning.md` (decided 2026-11-02, from v0.4.12 on).
- The patch version goes up by one on every completed-work commit, in the order commits land on `main`. It is **not** tied to the plan step number.
- Before bumping, read the latest version on `main` and use the next number. Never lower it; parallel workers re-check right before committing.
- Each commit ties to its plan item with a git trailer line in the body, plus a short description of the change:
  ```
  v0.4.12: <short summary>

  <one or two lines: what changed>

  Plan-Step: v0.4/7
  Co-Authored-By: ...
  ```
- One item may span several commits (e.g. fixes after review); each carries the same `Plan-Step:`. Find them with `git log --grep="Plan-Step: v0.4/7"`.
- Pushed history is never rewritten to fix old numbers.
