// Shared inputs for the import checks: the test sheets, the seeded tree and hostile files.
import { readFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'
import type { Category } from '../../src/storage/db'
import { SEED_TREE, type SeedNode } from '../../src/storage/seed'

export const SHEETS_DIR = new URL('../../docs/test_sheets/', import.meta.url)
/** The test files that import cleanly. */
export const TEST_FILES = [
  'test_csv_4_wk_mn.csv', 'test_csv_5_wk_mn.csv', 'test_csv_annual.csv', 'test_csv_week.csv', 'test_csv_day.csv',
  'test_xlsx_import_data.xlsx', 'test_xlsx_week_day.xlsx', 'test_ods_import_data.ods',
]
/** The year the anonymized test sheets come from; every run passes it, since the default is the current year. */
export const SHEET_YEAR = 2023
/** A fixed "today", so date limits and the default year don't move. */
export const TODAY = new Date(2026, 10, 11)

export const readTestFile = (name: string) => new Uint8Array(readFileSync(new URL(name, SHEETS_DIR)))

/** The seeded tree as stored rows, ids from 1 in insert order. */
export function seededCategories(): Category[] {
  const out: Category[] = []
  let id = 1
  const insert = (nodes: SeedNode[], parentId: number | null) => nodes.forEach((n, order) => {
    const me = id++
    out.push({ id: me, name: n.name, color: n.color, parentId, order, ...(n.computed ? { computed: true } : {}) })
    if (n.children) insert(n.children, me)
  })
  insert(SEED_TREE, null)
  return out
}

// ---------- hostile and malformed files (0013 §2, §11) ----------

const CT = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'
const rels = (n: number) => '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + Array.from({ length: n }, (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + '</Relationships>'
const workbook = (n: number) => '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
  + Array.from({ length: n }, (_, i) => `<sheet name="S${i}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'
const sheet = (rows: string) => `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
const str = (ref: string, t: string) => `<c r="${ref}" t="inlineStr"><is><t>${t}</t></is></c>`

/** A minimal XLSX with the given sheet parts. */
export function xlsx(sheets: (string | Uint8Array)[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(CT), 'xl/workbook.xml': strToU8(workbook(sheets.length)), 'xl/_rels/workbook.xml.rels': strToU8(rels(sheets.length)),
  }
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = typeof s === 'string' ? strToU8(s) : s })
  return zipSync(files, { level: 9 })
}

const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet'
const ODS_NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"'
export const odsDoc = (tables: string) => `<?xml version="1.0"?><office:document-content ${ODS_NS}><office:body><office:spreadsheet>${tables}</office:spreadsheet></office:body></office:document-content>`
export const odsTable = (name: string, rows: string) => `<table:table table:name="${name}">${rows}</table:table>`
export const odsRow = (cells: string) => `<table:table-row>${cells}</table:table-row>`
export const odsStr = (t: string) => `<table:table-cell office:value-type="string"><text:p>${t}</text:p></table:table-cell>`
/** A minimal ODS with the given content.xml. */
const mergedStr = (t: string) => '<table:table-cell office:value-type="string" table:number-columns-spanned="2"><text:p>' + t + '</text:p></table:table-cell><table:covered-table-cell/>'
export const ods = (content: string) => zipSync({ mimetype: strToU8(ODS_MIME), 'content.xml': strToU8(content) }, { level: 9 })

/** Files that must fail with a plain "Invalid: …" message and write nothing. */
export function badFiles(): Record<string, Uint8Array> {
  const real = readTestFile('test_xlsx_import_data.xlsx')
  return {
    // One sheet that unpacks to 200 MB of spaces.
    'bomb.xlsx': xlsx([new Uint8Array(200 * 1024 * 1024).fill(32)]),
    'fourteen.xlsx': xlsx(Array.from({ length: 14 }, () => sheet(''))),
    // Entity expansion ("billion laughs").
    'entities.xlsx': xlsx(['<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><worksheet><sheetData><row r="1">' + str('A1', '&lol2;') + '</row></sheetData></worksheet>']),
    'truncated.xlsx': real.subarray(0, Math.floor(real.length / 2)),
    'garbage.xlsx': Uint8Array.from({ length: 5000 }, (_, i) => (i * 7919) % 256),
    'huge.csv': strToU8('a,'.repeat(3 * 1024 * 1024)),
    'quote.csv': strToU8('September,,,,09/03 - 09/09,,09/10 - 09/16,,Monthly\n"Expenses,,,'),
    'nobudget.csv': strToU8('Name,Amount\nCoffee,5\n'),
    'rows.csv': strToU8('x\n'.repeat(6000)),
    'budget.ods': strToU8('x'),
    'nocontent.ods': zipSync({ mimetype: strToU8(ODS_MIME) }),
    'badxml.ods': ods('<office:document-content><office:body><office:spreadsheet><table:table'),
    'wrongtype.ods': zipSync({ mimetype: strToU8('application/vnd.oasis.opendocument.text'), 'content.xml': strToU8(odsDoc('')) }),
    'nomimetype.ods': zipSync({ 'content.xml': strToU8(odsDoc('')) }),
    'bomb.ods': zipSync({ mimetype: strToU8(ODS_MIME), 'content.xml': new Uint8Array(200 * 1024 * 1024).fill(32) }, { level: 9 }),
    'fourteen.ods': ods(odsDoc(Array.from({ length: 14 }, (_, i) => odsTable(`S${i}`, '')).join(''))),
    'entities.ods': ods('<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]>' + odsDoc(odsTable('S', odsRow(odsStr('&lol;'))))),
    // A non-empty cell repeated past the column limit, and a non-empty row repeated past the row limit.
    'widecells.ods': ods(odsDoc(odsTable('S', odsRow('<table:table-cell table:number-columns-repeated="16384" office:value-type="float" office:value="1"/>')))),
    'tallrows.ods': ods(odsDoc(odsTable('S', '<table:table-row table:number-rows-repeated="1048576">' + odsStr('x') + '</table:table-row>'))),
    'badrepeat.ods': ods(odsDoc(odsTable('S', '<table:table-row table:number-rows-repeated="-5">' + odsStr('x') + '</table:table-row>'))),
    'budget.txt': strToU8('x'),
    'fake.xlsx': strToU8('September,,,'),
  }
}

/** Formula and script-like content: must import as data only. */
export function formulaFiles(): Record<string, Uint8Array> {
  const head = '<row r="1">' + str('A1', 'September') + str('E1', '09/03 - 09/09') + str('G1', '09/10 - 09/16') + str('I1', 'Monthly') + '</row>'
    + '<row r="2">' + str('A2', 'Expenses') + '</row>'
  return {
    // A formula with a wrong stored value (5), a formula with no stored value, and text that looks like code.
    'formulas.xlsx': xlsx([sheet(head
      + '<row r="3">' + str('B3', '=HYPERLINK("http://evil","Click")') + '<c r="F3"><f>1000000*1000</f><v>5</v></c><c r="H3"><f>WEBSERVICE("http://evil")</f></c><c r="J3"><v>5</v></c></row>'
      + '<row r="4">' + str('B4', '&lt;img src=x onerror=alert(1)&gt;') + str('F4', '=1+2') + str('H4', '@SUM(1)') + '</row>')]),
    // Same sheet as formulas.xlsx; the week headers are merged across their Est./Act. pair.
    'formulas.ods': ods(odsDoc(odsTable('September',
      odsRow(odsStr('September') + '<table:table-cell table:number-columns-repeated="3"/>' + mergedStr('09/03 - 09/09') + mergedStr('09/10 - 09/16') + mergedStr('Monthly') + '<table:table-cell table:number-columns-repeated="1024"/>')
      + odsRow(odsStr('Expenses'))
      + odsRow('<table:table-cell/>' + odsStr('=HYPERLINK("http://evil","Click")') + '<table:table-cell table:number-columns-repeated="3"/>'
        + '<table:table-cell table:formula="of:=1000000*1000" office:value-type="float" office:value="5"><text:p>5</text:p></table:table-cell>'
        + '<table:table-cell/><table:table-cell table:formula="of:=WEBSERVICE(&quot;http://evil&quot;)"/><table:table-cell/>'
        + '<table:table-cell office:value-type="float" office:value="5"/>')
      + odsRow('<table:table-cell/>' + odsStr('&lt;img src=x onerror=alert(1)&gt;') + '<table:table-cell table:number-columns-repeated="3"/>' + odsStr('=1+2') + '<table:table-cell/>' + odsStr('@SUM(1)'))
      + '<table:table-row table:number-rows-repeated="1048570"><table:table-cell table:number-columns-repeated="16384"/></table:table-row>'))),
    'formula.csv': strToU8('September,,,,09/03 - 09/09,,09/10 - 09/16,,Monthly,\n,,,,Est.,Act.,Est.,Act.,Est,Act.\nExpenses\n,"=cmd|\' /C calc\'!A0",,,,=1+2,,+5,,\n,Groceries,,,,"$1,234.50",,(10.00),,'),
  }
}

/** A month sheet with a top-level row the app doesn't know (R1), with an item under it. */
export const UNKNOWN_TOP_CSV = 'September,,,,09/03 - 09/09,,09/10 - 09/16,,Monthly,\n,,,,Est.,Act.,Est.,Act.,Est.,Act.\n'
  + 'Expenses,,,,,,,,,\n,Groceries,,,,10.00,,,,10.00\nHobbies,,,,,,,,,\n,Paint,,,,4.00,,6.00,,10.00\nGarden,,,,,3.00,,,,3.00\n'
