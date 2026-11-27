import { UID_RE, type SyncTab } from '../db'

/** Sheet tabs, in the order they are read and written (0015 §3). */
export const TABS: SyncTab[] = ['Categories', 'Purchases', 'Settings']
/** Header row of every tab; data starts on the next row. */
export const HEADER = ['id', 'updatedAt', 'deleted', 'content']
export const FIRST_DATA_ROW = 2
/** Settings-tab rows that hold the sheet's key salt and passcode check, not records. */
export const META_PREFIX = '_'
export const SALT_ID = '_salt'
export const CHECK_ID = '_check'
/** Id of the one synced settings record. */
export const SETTINGS_UID = 'settings'

/**
 * Formula neutralizing (security-v0.2 2.3): cells are written RAW, and a text cell that
 * starts with = + - or @ gets a leading ' as well, so a spreadsheet never runs it as a
 * formula even when the data is copied elsewhere. Base64 text can start with +.
 */
const FORMULA_START = /^[=+\-@]/
export const neutralize = (s: string) => (FORMULA_START.test(s) ? `'${s}` : s)
export const unneutralize = (s: string) => (s.startsWith("'") && FORMULA_START.test(s.slice(1)) ? s.slice(1) : s)

/** One sheet row as written: plain id, updatedAt and deleted, and the encrypted content. */
export function toCells(id: string, updatedAt: number, deleted: boolean, content: string): (string | number | boolean)[] {
  return [neutralize(id), updatedAt, deleted, neutralize(content)]
}

/** A pulled row's plain columns; hand edits are allowed, so each is checked (0015 Q4). */
export interface ParsedRow {
  row: number
  id: string
  updatedAt: number
  deleted: boolean
  content: string
}

/** How far ahead of this device's clock a row's time may be (hand edits must not win forever). */
export const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000
const ID_RE = UID_RE

/** Parse a raw row; returns null for a blank row and a reason for a broken one. */
export function parseRow(row: number, cells: unknown[], now: number): ParsedRow | null | { row: number; id: string; error: string } {
  const text = (v: unknown) => (v == null ? '' : unneutralize(String(v)).trim())
  const id = text(cells[0])
  if (!id && cells.every(c => c == null || c === '')) return null
  if (!ID_RE.test(id)) return { row, id: '', error: 'has an id that isn’t valid' }
  const t = typeof cells[1] === 'number' ? cells[1] : Number(text(cells[1]))
  if (!Number.isInteger(t) || t <= 0 || t > now + CLOCK_SKEW_MS) return { row, id, error: 'has a time that isn’t valid' }
  const d = typeof cells[2] === 'boolean' ? String(cells[2]) : text(cells[2]).toLowerCase()
  if (d !== 'true' && d !== 'false' && d !== '') return { row, id, error: 'has a deleted mark that isn’t valid' }
  return { row, id, updatedAt: t, deleted: d === 'true', content: text(cells[3]) }
}
