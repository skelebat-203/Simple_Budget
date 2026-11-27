import data from './updates.json'

/** What the update popup lists. `updates.json` is written once per merge to main (see `docs/design/0016-update-popup.md`). */
export interface Release { version: string, changes: string[] }
export interface KnownIssue { id: string, since: string, text: string }
export interface Updates { releases: Release[], knownIssues: KnownIssue[] }

export const UPDATES: Updates = data

const LAST_SEEN_KEY = 'simple-budget:last-seen-version'

/** Compares "0.7.61" style versions part by part: negative when a is older. */
export function compareVersions(a: string, b: string): number {
  const x = a.split('.').map(Number), y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d
  }
  return 0
}

/**
 * What the popup shows for a user who last opened `lastSeen` and now runs `current`:
 * the releases in between, newest first, and the known issues logged since. A user with no
 * stored version (an existing user on the first popup) gets the newest release and every known issue.
 */
export function whatsNew(updates: Updates, lastSeen: string | null, current: string): Updates {
  const upTo = (v: string) => compareVersions(v, current) <= 0
  const releases = updates.releases.filter(r => upTo(r.version) && (lastSeen === null || compareVersions(r.version, lastSeen) > 0))
    .sort((a, b) => compareVersions(b.version, a.version))
  return {
    releases: lastSeen === null ? releases.slice(0, 1) : releases,
    knownIssues: updates.knownIssues.filter(i => upTo(i.since) && (lastSeen === null || compareVersions(i.since, lastSeen) > 0)),
  }
}

export function readLastSeen(): string | null {
  try { return localStorage.getItem(LAST_SEEN_KEY) } catch { return null }
}

export function writeLastSeen(version: string) {
  try { localStorage.setItem(LAST_SEEN_KEY, version) } catch { /* storage unavailable: the popup may show again */ }
}
