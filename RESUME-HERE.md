# RESUME-HERE

Tracking file for current work status. Roadmap authority: `docs/design/0003-roadmap.md`.
Design: `0004-table-design.md` (table), `0006-prototype.html` (v0.2 UI), `0007-v0.3-design-updates.md` (v0.3 changes), `0008-v0.5-design-updates.md` (v0.5 changes; wins on conflict), `0009-v0.6-design-updates.md` (v0.6, not final).

## Current state
- Version: v0.6.0. v0.5 complete (security review approved, `docs/audits/security/security-v0.5.md`; accessibility `docs/audits/a11y/a11y-v0.5.md`). v0.4, v0.3 and v0.2 complete.
- Data: Dexie v8 (no change in v0.5; schedule fields `dueWeekday`, `dueDay`, `dueDay2` and `Settings.onboarded` are unindexed). See `src/storage/structure.ts`.
- Next: write the v0.6 plan of action from `0003-roadmap.md` v0.6 (format and cost estimate per `.claude/CLAUDE.md` "Version action plans"). Design: `0009-v0.6-design-updates.md` (wizard and highlight are not final: review prototypes `0010` and `0011` with the human first).
- Defects to schedule in v0.6: `docs/defects/` (D001, D002).
- Testing: headless Chromium via host flatpak + puppeteer-core; scripts in the session scratchpad.

## Rules
- Each completed item: commit + version bump (per `.claude/CLAUDE.md` "Version numbering").
- Human-facing docs in `docs/`; do not duplicate docs.
- Stop and ask on any uncertainty.
