import type { SyncTab } from '../db'

/** A raw sheet row as read: its 1-based row number and its cells (A to D). */
export interface RawRow {
  row: number
  cells: unknown[]
}

export type RemoteSheet = Record<SyncTab, RawRow[]>

/** Cells to write: `row` overwrites that row; no `row` appends after the last one. */
export interface CellWrite {
  tab: SyncTab
  row?: number
  cells: (string | number | boolean)[]
}

/**
 * A remote copy of the budget (0015 §2). The Dexie store stays the source of truth; an
 * adapter only reads every data row in one batched call and writes changed rows in one
 * batched call. Cells arrive already neutralized (security-v0.2 2.3) and are written as
 * given (RAW). Later providers plug into the same interface.
 */
export interface StorageAdapter {
  read(): Promise<RemoteSheet>
  write(cells: CellWrite[]): Promise<void>
}

/** The provider asked us to slow down (HTTP 429): retry after a back-off. */
export class RateLimitError extends Error {}
/** Sign-in expired or was revoked: the user must sign in again. */
export class AuthError extends Error {}
/** Google's sign-in window was blocked or closed (D004): the redirect sign-in is offered instead. */
export class PopupError extends AuthError {}
/** Any other remote failure. The message is ours, never the provider's (0015 §7.1, CWE-209). */
export class RemoteError extends Error {}
