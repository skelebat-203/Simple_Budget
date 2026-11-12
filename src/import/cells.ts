// Cell text rules: amounts, header dates, times and names (0013 §3, §4).
import { cleanName, MONEY_MAX, slug } from '../budget/validate'
import type { Cell } from './grid'

/** No amount (empty, zero), an amount, or text that isn't one. */
export type Amount = { kind: 'none' } | { kind: 'value'; value: number } | { kind: 'bad'; text: string }

const MONEY_TEXT = /^-?(\d+(\.\d*)?|\.\d+)$/

/**
 * Amount in a cell (0013 §3.4): strip `$`, spaces, thousands commas, a leading `_(` and a
 * trailing `_)`; `$-135.50` and `(135.50)` are negative; empty and `$0.00` mean no amount.
 * Text that still isn't a plain number (a formula such as `=1+2`, a note) is never evaluated.
 */
export function parseAmount(cell: Cell | undefined): Amount {
  if (cell == null) return { kind: 'none' }
  let n: number
  if (typeof cell.v === 'number') n = cell.v
  else {
    let s = cell.v.replace(/^_\(|_\)$/g, '').replace(/[\s$,]/g, '').replace(/−/g, '-')
    if (s === '' || s === '-') return { kind: 'none' }
    let neg = false
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
    if (!MONEY_TEXT.test(s)) return { kind: 'bad', text: cell.v.trim() }
    n = Number(s) * (neg ? -1 : 1)
  }
  if (!Number.isFinite(n) || Math.abs(n) > MONEY_MAX) return { kind: 'bad', text: String(cell.v).trim() }
  const value = Math.round(n * 100) / 100
  return value === 0 ? { kind: 'none' } : { kind: 'value', value: Object.is(value, -0) ? 0 : value }
}

export interface MonthDay { month: number; day: number }

const validMD = (month: number, day: number) => month >= 1 && month <= 12 && day >= 1 && day <= 31

/** `MM/DD - MM/DD` → the first and last dates of a week header. */
export function weekRange(s: string): { from: MonthDay; to: MonthDay } | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})$/.exec(s.trim())
  if (!m) return undefined
  const [a, b, c, d] = m.slice(1).map(Number)
  return validMD(a, b) && validMD(c, d) ? { from: { month: a, day: b }, to: { month: c, day: d } } : undefined
}

/** `MM/DD` (a week sheet's day header). */
export function monthDay(s: string): MonthDay | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(s.trim())
  if (!m) return undefined
  const [month, day] = [Number(m[1]), Number(m[2])]
  return validMD(month, day) ? { month, day } : undefined
}

/** `MM/DD/YYYY` (or `YYYY-MM-DD`) → ISO date, only when the date exists. */
export function fullDate(s: string): string | undefined {
  const t = s.trim()
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t)
  const parts = us ? [us[3], us[1], us[2]] : iso ? [iso[1], iso[2], iso[3]] : undefined
  return parts && isoOf(Number(parts[0]), Number(parts[1]), Number(parts[2]))
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO date for a year, month and day, or undefined when the day doesn't exist (e.g. 02/30). */
export function isoOf(y: number, m: number, d: number): string | undefined {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? `${y}-${pad(m)}-${pad(d)}` : undefined
}

/** `9:32 AM`, `5:10 pm`, `17:10` → minutes after midnight. */
export function timeOfDay(s: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/.exec(s.trim())
  if (!m) return undefined
  let h = Number(m[1])
  const min = Number(m[2])
  if (min > 59) return undefined
  if (m[3]) {
    if (h < 1 || h > 12) return undefined
    h = (h % 12) + (/p/i.test(m[3]) ? 12 : 0)
  } else if (h > 23) return undefined
  return h * 60 + min
}

/** Known misspellings in budget sheets (0013 §4). A general spell check is a v0.7 item. */
const ALIASES: Record<string, string> = { expences: 'Expenses', maintainance: 'Maintenance' }

/**
 * Sheet name → app name (0013 §4): drop parentheses and what is inside them, apply the
 * known aliases word by word, then the app's name rules (trim, collapse spaces, 60 characters).
 */
export function importName(raw: string): string {
  let s = raw
  for (let prev = ''; prev !== s;) { prev = s; s = s.replace(/\([^()]*\)/g, ' ') }
  s = s.replace(/[()]/g, ' ')
  s = s.replace(/\p{L}+/gu, w => ALIASES[w.toLowerCase()] ?? w)
  return cleanName(s)
}

/** Matching key: the same rule the app uses to keep sibling names unique. */
export const nameKey = (name: string) => slug(name)

/**
 * Second-chance matching key without a trailing due-day note such as "8th" or
 * "11th / 13th" ("Power 8th" → "power"). Used only to match an existing row; a new
 * row keeps its full name. Review item R3.
 */
export const dueDayKey = (name: string) => slug(name.replace(/(\s+\d{1,2}(st|nd|rd|th))(\s*\/\s*\d{1,2}(st|nd|rd|th))*\s*$/i, ''))
