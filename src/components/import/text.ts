/** Sheet names listed in a message before "and {n} more". */
const MAX_NAMED_SHEETS = 3

/** "1 purchase", "3 purchases". */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "Jan", "Jan and Feb", "Jan, Feb, Mar and 9 more". */
export function sheetList(names: string[]): string {
  const shown = names.slice(0, MAX_NAMED_SHEETS)
  const more = names.length - shown.length
  if (more > 0) return `${shown.join(', ')} and ${more} more`
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown.join('')
}

export const LOST_VALUES_TITLE = 'Some values may be missing'

/** Review warning for an ODS file with empty cells under merges in its amount area (plan step 13a). */
export function lostValuesText(cells: number, sheets: string[]): string {
  const where = sheets.length ? ` ${sheets.length === 1 ? 'Sheet' : 'Sheets'}: ${sheetList(sheets)}.` : ''
  return `This .ods file has ${plural(cells, 'cell')} that ${cells === 1 ? 'looks' : 'look'} empty because of merged cells.${where} LibreOffice can drop values under merges when it saves. Totals may be too low. Check the totals below, or save the file as .xlsx and import that.`
}
