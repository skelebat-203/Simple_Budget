import { Dialog } from './ui'
import type { Updates } from '../updates/updates'

/** Opens on the first open after an update: what changed since the last open, and new known issues. */
export function UpdatePopup({ updates, version, onClose }: { updates: Updates, version: string, onClose: () => void }) {
  const many = updates.releases.length > 1
  return (
    <Dialog id="update-popup" title="What’s new" className="update-popup" closeButton onClose={onClose}>
      <p className="update-sub">Version {version}</p>
      {updates.releases.map(r => (
        <div key={r.version}>
          <h3>{many ? `Changes in ${r.version}` : 'Changes'}</h3>
          <ul className="update-list">{r.changes.map(c => <li key={c}>{c}</li>)}</ul>
        </div>
      ))}
      {updates.knownIssues.length > 0 && (
        <div className="update-issues">
          <h3>Known Issues</h3>
          <ul className="update-list">{updates.knownIssues.map(i => <li key={i.id}>{i.text}</li>)}</ul>
        </div>
      )}
    </Dialog>
  )
}
