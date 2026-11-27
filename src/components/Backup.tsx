import { useRef, useState } from 'react'
import { useAnnounce } from './ui/announcer'
import { Button, Dialog } from './ui'
import { BACKUP_MAX_BYTES, BackupError, checkBackup, exportBackup, restoreBackup, type Backup as BackupData } from '../storage/repository'
import { isoDate } from '../budget/tree'
import { ImportSection } from './import/ImportSection'
import { Sync } from './Sync'

/** Backup dialog (0009 §5): export and restore a JSON backup of all data (security-v0.2 6.2). The import section follows (0013 §9, v0.6 step 14). */
export function Backup({ onClose, onRestored, onImported, onboarded, pickedId, onPick }: {
  onClose: () => void; onRestored: () => void; onImported: () => void
  /** For the Sync section (moved here 2026-11-26). */
  onboarded: boolean; pickedId: string | null; onPick: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupData | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  useAnnounce(status)
  useAnnounce(error)
  useAnnounce(pending ? 'Replace all data with this backup? Choose Cancel or Replace my data.' : '')

  async function download() {
    setError(''); setStatus('')
    try {
      const data = await exportBackup()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `simple-budget-backup-${isoDate(new Date())}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      setStatus(`Backup saved: ${data.budgetItems.length} amounts and ${data.categories.length} categories.`)
    } catch {
      setError('Error: The backup couldn’t be created. Try again.')
    }
  }

  async function choose(file: File | undefined) {
    setError(''); setStatus(''); setPending(null)
    if (!file) return
    if (file.size > BACKUP_MAX_BYTES) { setError('Invalid: Backup file is larger than 5 MB, so it isn’t a Simple Budget backup.'); return }
    if (!/\.json$/i.test(file.name)) { setError('Invalid: Backup file unsupported file type. Choose the .json file you exported.'); return }
    try {
      setPending(checkBackup(JSON.parse(await file.text())))
    } catch (e) {
      setError(`Invalid: Backup file ${e instanceof BackupError ? e.message : 'can’t be read. Choose the .json file you exported.'}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function restore() {
    if (!pending) return
    try {
      await restoreBackup(pending)
      setPending(null)
      setStatus('Backup restored.')
      onRestored()
    } catch {
      setError('Error: The backup couldn’t be restored. Your existing data was not changed.')
    }
  }

  return (
    <Dialog id="backup-dialog" title="Backup" onClose={onClose} className="backup"
      buttons={<Button type="button" className="secondary" id="backup-close" onClick={onClose}>Close</Button>}>
      <section className="field" aria-labelledby="backup-export-heading">
        <h3 id="backup-export-heading" className="label">Export</h3>
        <p className="help">Your budget is stored only in this browser. Save a backup file regularly so you can restore it if the browser clears its data.</p>
        <div className="actions">
          <Button type="button" onClick={download}>Export backup</Button>
        </div>
      </section>
      <section className="field" aria-labelledby="backup-restore-heading">
        <h3 id="backup-restore-heading" className="label">Restore from a backup file</h3>
        <p id="backup-help" className="help">Choose a .json file exported from Simple Budget. Restoring replaces everything currently in the app.</p>
        <label htmlFor="backup-file" className="sr-only">Backup file (.json)</label>
        <input id="backup-file" ref={fileRef} type="file" accept=".json,application/json" className="input"
          aria-describedby={error ? 'backup-help backup-error' : 'backup-help'} aria-invalid={!!error || undefined}
          onChange={e => choose(e.target.files?.[0])} />
        {error && <p id="backup-error" className="error">{error}</p>}
      </section>
      <ImportSection onImported={onImported} />
      <Sync onboarded={onboarded} pickedId={pickedId} onPick={onPick} />
      {pending && (
        <div className="banner banner-warn">
          <h3 className="banner-title">Replace all data with this backup?</h3>
          <p>It has {pending.budgetItems.length} amounts and {pending.categories.length} categories, exported {new Date(pending.exportedAt).toLocaleString()}. Everything now in the app will be replaced.</p>
          <div className="actions">
            <Button type="button" className="secondary" onClick={() => setPending(null)}>Cancel</Button>
            <Button type="button" onClick={restore}>Replace my data</Button>
          </div>
        </div>
      )}
      <p className="status">{status}</p>
    </Dialog>
  )
}
