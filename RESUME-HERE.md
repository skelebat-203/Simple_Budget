# RESUME-HERE

Tracking file for v0.1 work status. Roadmap authority: `docs/design/0003-roadmap.md`. Reward animation deferred to v0.5 (not in v0.1).

Status legend: ✅ complete · ⏳ in progress · ⏸️ blocked · (blank) pending.

## Current state
- Version: v0.1.1
- v0.1 in progress. Phase 0 (Scaffold) complete.
- Phase 1 ready to start (parallel: CSS tokens, IndexedDB storage, PWA manifest/SW).
- Accessibility refactor of UI components complete (labels, ARIA, focus, touch targets).

## v0.1 workflow (parallelized)

Phase 0 — Sequential (foundation; everything depends on it)
- [x] 1. Scaffold — React + TS, Vite, PWA plugin, repo structure. → commit, bump v0.1.1 ✅

Phase 1 — Parallel (after scaffold)
- [ ] 2. CSS design tokens — colors, spacing, typography. → commit, bump
- [ ] 4. IndexedDB storage — Dexie + repository layer. → commit, bump
- [ ] 7. PWA manifest + service worker — offline cache. → commit, bump

Phase 2 — Sequential (depends on tokens)
- [ ] 3. In-house UI components — button, input, dropdown-with-search, date picker, amount input, checkbox group. → commit, bump

Phase 3 — Parallel (depends on components + storage)
- [ ] 5. Add flow — dropdown search, date picker (default today), amount required, save. (reward deferred to v0.5) → commit, bump
- [ ] 6. Budget screen skeleton — table view, Day/Week toggles. → commit, bump

Phase 4 — Sequential (last)
- [ ] 8. Security review — completes v0.1 → commit, bump to v0.2.0

## Rules
- Each completed item: commit + version bump (per `versioning.md`).
- Version reflects the highest-numbered completed item; parallel items may complete in any order.
- Human-facing docs go in `docs/`; do not duplicate docs. Roadmap authority is `docs/design/0003-roadmap.md`.
- Stop and ask on any uncertainty.
