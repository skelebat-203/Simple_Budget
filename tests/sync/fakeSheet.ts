// In-memory stand-in for a Google Sheet (0015 §8): same rows-and-cells shape the Google
// adapter returns, so the sync engine runs unchanged against it.
import type { SyncTab } from '../../src/storage/db'
import { RemoteError, type CellWrite, type RemoteSheet, type StorageAdapter } from '../../src/storage/sync/adapter'
import { TABS } from '../../src/storage/sync/cells'

export class FakeSheet implements StorageAdapter {
  tabs: Record<SyncTab, unknown[][]> = { Categories: [], Purchases: [], Settings: [] }
  reads = 0
  writes = 0
  /** Set to make the next call fail with this error. */
  failNext: Error | null = null
  /** Set to make the read with this count (see `reads`) fail as if offline. */
  failReadAt = 0
  /** Set to hold the next read until `release()` is called. */
  private gate: Promise<void> | null = null
  private open: (() => void) | null = null

  hold() { this.gate = new Promise(r => { this.open = r }) }
  release() { this.open?.(); this.gate = null; this.open = null }

  async read(): Promise<RemoteSheet> {
    this.reads++
    if (this.gate) await this.gate
    if (this.failNext) { const e = this.failNext; this.failNext = null; throw e }
    if (this.failReadAt && this.reads === this.failReadAt) { this.failReadAt = 0; throw new RemoteError('The sheet couldn’t be reached.') }
    const out = {} as RemoteSheet
    // Like the Sheets API: trailing blank rows dropped, cells copied.
    for (const t of TABS) out[t] = this.tabs[t].map((cells, i) => ({ row: i + 1, cells: [...cells] }))
    return out
  }

  async write(cells: CellWrite[]): Promise<void> {
    this.writes++
    if (this.failNext) { const e = this.failNext; this.failNext = null; throw e }
    for (const c of cells) {
      const rows = this.tabs[c.tab]
      if (c.row == null) rows.push([...c.cells])
      else { while (rows.length < c.row) rows.push([]); rows[c.row - 1] = [...c.cells] }
    }
  }

  /** Data rows of a tab (header and meta rows left out). */
  data(tab: SyncTab) { return this.tabs[tab].slice(1).filter(r => r.length && r[0] !== '' && !String(r[0]).startsWith('_')) }
  rowOf(tab: SyncTab, id: string) { return this.tabs[tab].findIndex(r => r[0] === id) }
}
