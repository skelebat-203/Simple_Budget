// Input rules shared by every form (security-v0.2 2.1, 3.2, 3.5).

export const NAME_MAX = 60
export const DESCRIPTION_MAX = 120
export const MONEY_MAX = 999_999_999.99

/**
 * Clean a user-typed name: Unicode NFC, drop control and format characters
 * (e.g. right-to-left override, zero-width space), collapse whitespace, trim,
 * cap length.
 */
export function cleanName(s: string): string {
  return s.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)
}

/** Clean an optional description: same rules as a name, up to DESCRIPTION_MAX; '' when nothing is left. */
export function cleanDescription(s: string): string {
  return s.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_MAX)
}

export type MoneyResult = { ok: true; value: number } | { ok: false; reason: 'empty' | 'format' | 'negative' | 'range' }

/**
 * Parse a money string: plain decimal, optional leading minus, commas ignored,
 * at most 2 decimal places, |value| ≤ MONEY_MAX. No hex, exponents or spaces.
 */
export function parseMoney(raw: string, { allowNegative }: { allowNegative: boolean }): MoneyResult {
  const s = raw.trim().replace(/,/g, '')
  if (s === '') return { ok: false, reason: 'empty' }
  if (!/^-?(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return { ok: false, reason: 'format' }
  const value = Number(s)
  if (value < 0 && !allowNegative) return { ok: false, reason: 'negative' }
  if (Math.abs(value) > MONEY_MAX) return { ok: false, reason: 'range' }
  return { ok: true, value: Object.is(value, -0) ? 0 : value }
}

/**
 * Parse a typed amount that may add or subtract terms, e.g. `12.50+3` or `40-5.25`.
 * Only digits, `.`, `,`, `+` and `-` are read (no evaluator); each term follows the
 * parseMoney format. The sum is worked in whole cents so it never drifts, then
 * checked like a single amount. `expr` is true when more than one term was typed.
 */
export function parseAmount(raw: string, { allowNegative }: { allowNegative: boolean }): MoneyResult & { expr?: boolean } {
  const s = raw.trim().replace(/,/g, '').replace(/\s*([+-])\s*/g, '$1')
  if (!/[+-]/.test(s.slice(1))) return parseMoney(s, { allowNegative })
  const terms = s.match(/[+-]?[^+-]*/g)!.filter(t => t !== '')
  if (terms.some(t => !/^[+-]?(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(t))) return { ok: false, reason: 'format' }
  let cents = 0
  for (const t of terms) {
    const r = parseMoney(t.replace(/^\+/, ''), { allowNegative: true })
    if (!r.ok) return r
    cents += Math.round(r.value * 100)
  }
  const value = cents / 100
  if (value < 0 && !allowNegative) return { ok: false, reason: 'negative' }
  if (Math.abs(value) > MONEY_MAX) return { ok: false, reason: 'range' }
  return { ok: true, value: Object.is(value, -0) ? 0 : value, expr: true }
}

/** Field-level message in the digital_accessibility.md format. */
export function moneyError(field: string, r: Exclude<MoneyResult, { ok: true }>, example: string): string {
  switch (r.reason) {
    case 'empty': return `Error: ${field} cannot be empty`
    case 'negative': return `Invalid: ${field} use a number of 0 or more`
    case 'range': return `Invalid: ${field} use a number up to 999,999,999.99`
    default: return `Invalid: ${field} use number format (e.g. ${example})`
  }
}

/** Allowed date range for amounts: Jan 1 2000 to one year from today. */
export function dateBounds(today: Date): { min: string; max: string } {
  const max = new Date(today)
  max.setFullYear(max.getFullYear() + 1)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { min: '2000-01-01', max: iso(max) }
}

/** Name → id segment (CLAUDE.md id convention): lowercase, every run of other characters becomes '-'. */
export const slug = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
