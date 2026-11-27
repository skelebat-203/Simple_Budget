# 0016 — Update popup

Decided by the human, 2026-11-26. Mockup: `docs/design/images/v0.7-update-popup/` (375px). Scope lives in the roadmap (v0.7, "Update popup").

## 1. What the user sees

- A dialog titled "What's new", opened on the first open after an update. A line under the title shows the app version.
- A close button (an X, accessible name "Close") at the top right. Escape closes it too. There is no other button.
- A 3px border (`--border-thick`) in the primary brown, so it stands apart from the other dialogs.
- "Changes": a short bullet list. With more than one release to show, each release has its own "Changes in {version}" heading, newest first.
- "Known Issues": bullets in a warn-coloured box. The box is left out when there are none.
- Reading level: grade 10 or lower (`digital_accessibility.md`). One short sentence per bullet.
- The popup is the app's `Dialog` with its `closeButton` option and no footer.

## 2. When it opens

- The version last shown is kept in `localStorage` (`simple-budget:last-seen-version`), per device. It is not in Dexie because Dexie settings sync across devices.
- On load, once settings are read:
  - Setup not finished (first run): record the current version, show nothing. The wizard opens instead.
  - Otherwise show every release newer than the stored version (and not newer than the running one), and every known issue logged since.
  - No stored version for a user who has finished setup (an existing user on the first popup): show the newest release once, and every known issue.
  - Nothing to show: stay closed.
- The stored version is updated as soon as the popup opens or is skipped, so it shows once.

## 3. The data: `src/updates/updates.json`

```json
{
  "releases": [{ "version": "0.7.61", "changes": ["…"] }],
  "knownIssues": [{ "id": "D004", "since": "0.7.10", "text": "…" }]
}
```

- `version` is the app version the merge lands at (no `v`). It is the version in `package.json` on the merge commit.
- `since` is the version in which the defect was logged. A known issue is shown to a user whose last-seen version is older than `since`.
- Known issues are user-visible defects from `docs/defects/` that are still open. The defect file stays the source of the facts; the JSON holds the user wording. A defect with no visible effect for the user (for example D002) is left out.
- When a defect is fixed, delete its known issue and, if the user would notice, add a change ("… issue resolved").

## 4. Keeping it current: one entry per merge to `main`

Per-commit entries are rejected: patch versions bump on every commit, so the list would be long, later commits can undo earlier ones, and parallel branches would conflict in the file. Commit messages are developer wording and are not used as the text.

Before asking to merge to `main` (the rule is also in `.claude/CLAUDE.md`):

1. Draft the release's `changes` from `git log main..{branch}` and the defect files: user-visible changes only, plain words, one line each. Set `version` to the version the merge lands at.
2. Add a known issue for each new open defect; remove those that were fixed.
3. **The human reviews the Changes list** and edits or approves it.
4. Commit it with the RESUME-HERE update (the last commit before the merge).
5. Only then ask to merge.

Checks: `npm run test:dialogs` covers the popup (opens after an update, once; the X; border; reading order).
