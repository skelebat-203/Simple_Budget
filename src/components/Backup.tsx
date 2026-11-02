import { useRef, useState } from 'react'
import { Button } from './ui'
import { BACKUP_MAX_BYTES, BackupError, checkBackup, exportBackup, restoreBackup, type Backup as BackupData } from '../storage/repository'
import { isoDate } from '../budget/tree'

/** Export and restore a JSON backup of all data (security-v0.2 6.2). */
export function Backup({ onRestored }: { onRestored: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<BackupData | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

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
    <section className="panel" aria-labelledby="backup-heading">
      <h2 id="backup-heading" className="section-title">Backup</h2>
      <p className="help">Your budget is stored only in this browser. Save a backup file regularly so you can restore it if the browser clears its data.</p>
      <div className="actions">
        <Button type="button" className="secondary" onClick={download}>Export backup</Button>
      </div>
      <div className="field">
        <label className="label" htmlFor="backup-file">Restore from a backup file</label>
        <p id="backup-help" className="help">Choose a .json file exported from Simple Budget. Restoring replaces everything currently in the app.</p>
        <input id="backup-file" ref={fileRef} type="file" accept=".json,application/json" className="input"
          aria-describedby={error ? 'backup-help backup-error' : 'backup-help'} aria-invalid={!!error || undefined}
          onChange={e => choose(e.target.files?.[0])} />
        {error && <p id="backup-error" className="error">{error}</p>}
      </div>
      {pending && (
        <div className="banner banner-warn" role="alert">
          <h3 className="banner-title">Replace all data with this backup?</h3>
          <p>It has {pending.budgetItems.length} amounts and {pending.categories.length} categories, exported {new Date(pending.exportedAt).toLocaleString()}. Everything now in the app will be replaced.</p>
          <div className="actions">
            <Button type="button" className="secondary" onClick={() => setPending(null)}>Cancel</Button>
            <Button type="button" onClick={restore}>Replace my data</Button>
          </div>
        </div>
      )}
      <p className="status" role="status">{status}</p>
    </section>
  )
}
