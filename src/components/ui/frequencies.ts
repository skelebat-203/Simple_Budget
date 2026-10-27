import type { Frequency } from '../../storage/db'

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  // Bi-monthly means twice a month, not every 2 months.
  { value: 'bimonthly', label: 'Bi-monthly' },
  { value: 'biweek', label: 'Every 2 weeks' },
]

// Recurrence applies to income items, or items in the Debt / Utilities /
// Subscriptions categories.
export const RECURRENCE_TYPES = new Set<string>(['income'])
export const RECURRENCE_CATEGORIES = new Set(['Debt', 'Utilities', 'Subscriptions'])
export const AUTOPAY_CATEGORIES = new Set(['Debt', 'Utilities', 'Subscriptions'])
