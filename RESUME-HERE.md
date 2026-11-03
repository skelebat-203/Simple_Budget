# RESUME-HERE

Tracking file for current work status. Roadmap authority: `docs/design/0003-roadmap.md`.
Design: `0004-table-design.md` (table), `0006-prototype.html` (v0.2 UI), `0007-v0.3-design-updates.md` (v0.3 changes), `0008-v0.5-design-updates.md` (v0.5 changes; wins on conflict).

## Current state
- Version: v0.5.0. v0.4 complete (security review approved, `docs/audits/security/security-v0.4.md`; accessibility `docs/audits/a11y/a11y-v0.4.md`). v0.3 and v0.2 complete (security reviews approved).
- Data: Dexie v8 (frequency/range `annual`; Income group, stored sibling `order`, `computed` only on top-level rows; see `src/storage/structure.ts`). Amounts link to categories by `categoryId`; estimate fields live on `Category`. `needsReview` removed (0007 §8.4).
- Next: write the v0.5 plan of action from `0003-roadmap.md` v0.5 (format and cost estimate per `.claude/CLAUDE.md` "Version action plans"; versions per "Version numbering"). v0.5 design: `0008-v0.5-design-updates.md`.
- Testing: headless Chromium via host flatpak + puppeteer-core; scripts in the session scratchpad.

## Rules
- Each completed item: commit + version bump (per `.claude/CLAUDE.md` "Version numbering").
- Human-facing docs in `docs/`; do not duplicate docs.
- Stop and ask on any uncertainty.
