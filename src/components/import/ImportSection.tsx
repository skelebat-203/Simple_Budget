import { useRef, useState } from 'react'
import { IMPORT_ACCEPT, ImportError, importSnapshot, previewImport, readImportFile, type Snapshot, type Workbook } from '../../import'
import { Banner } from '../ui'
import { useAnnounce } from '../ui/announcer'
import { ImportReview, type ImportDone } from './ImportReview'
import { plural } from './text'

interface Message { text: string; kind: 'invalid' | 'error' | 'reading' }
interface Reading { fileName: string; workbook: Workbook; snapshot: Snapshot }

/**
 * Import section of the Backup dialog (0013 §9, mockups 14a and 14e). Choosing a file reads it and opens the review.
 * Messages sit between the file control and the "What can I import?" note; they are also announced through the app's one polite region.
 * The file control is a button, so its state is in its name ("invalid"), not aria-invalid.
 */
export function ImportSection({ onImported, note }: {
  onImported: () => void
  /** Extra sentence added to the help text (the onboarding wizard uses it). */
  note?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [reading, setReading] = useState<Reading | null>(null)
  const [done, setDone] = useState<(ImportDone & { fileName: string }) | null>(null)
  const doneText = done && `Added ${plural(done.purchases, 'purchase')} and ${plural(done.categories, 'new row')}`
  const doneExtra = done && done.undated > 0 ? ` ${done.undated === done.purchases ? `All ${done.undated} purchases` : `${plural(done.undated, 'purchase')}`} had no date in the file.` : ''
  useAnnounce(message?.text ?? '')
  useAnnounce(done ? `Import finished. ${doneText}.${doneExtra}` : '')

  async function choose(file: File | undefined) {
    setMessage(null); setDone(null); setReading(null)
    if (!file) return
    setMessage({ kind: 'reading', text: `Reading ${file.name}…` })
    try {
      const workbook = await readImportFile(file)
      const snapshot = await importSnapshot()
      previewImport(workbook, snapshot) // throws when the file has no budget sheets
      setMessage(null)
      setReading({ fileName: file.name, workbook, snapshot })
    } catch (e) {
      setMessage({ kind: 'invalid', text: `Invalid: ${e instanceof ImportError ? e.message : 'File can’t be read. Choose a .csv, .xlsx or .ods file.'}` })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const back = () => { setReading(null); requestAnimationFrame(() => fileRef.current?.focus()) }
  const invalid = message?.kind === 'invalid'

  return (
    <section className="field" aria-labelledby="import-heading">
      <h3 id="import-heading" className="label">Import a budget</h3>
      <p id="import-help" className="help">Choose a .csv, .xlsx or .ods file from a spreadsheet budget. You review the result before anything is saved.{note && ` ${note}`}</p>
      <label htmlFor="import-file" className="sr-only">Import file (.csv, .xlsx or .ods){invalid && <span> invalid</span>}</label>
      <input id="import-file" ref={fileRef} type="file" accept={IMPORT_ACCEPT} className="input"
        aria-describedby={message ? 'import-help import-message' : 'import-help'} onChange={e => choose(e.target.files?.[0])} />
      {message && <p id="import-message" className={message.kind === 'reading' ? 'help' : 'error'}>{message.text}</p>}
      <details className="import-more">
        <summary>What can I import?</summary>
        <ul className="import-help">
          <li>Each sheet is one month, one week, one day, or the whole year.</li>
          <li>Only the saved values are read. Formulas are never run.</li>
          <li>The file can be up to 5 MB and have up to 13 sheets.</li>
        </ul>
      </details>
      {done && <Banner kind="success" title="Import finished"><p>{doneText} from {done.fileName}.{doneExtra}</p></Banner>}
      {reading && (
        <ImportReview {...reading} onCancel={back}
          onDone={d => { setReading(null); setDone({ ...d, fileName: reading.fileName }); onImported(); requestAnimationFrame(() => fileRef.current?.focus()) }}
          onFail={text => { setReading(null); setMessage({ kind: 'error', text }); requestAnimationFrame(() => fileRef.current?.focus()) }} />
      )}
    </section>
  )
}
