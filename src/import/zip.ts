// Minimal zip reader for XLSX (and later ODS). Reads the central directory itself so
// each entry is inflated in small pieces and stopped at the size limit: a zip's stated
// sizes can lie, so they are never trusted (zip bombs, 0013 §2).
import { Inflate } from 'fflate'
import { IMPORT_MAX_UNZIPPED, IMPORT_MAX_ZIP_ENTRIES, ImportError } from './grid'

/** Compressed bytes pushed to the inflater at a time; bounds how far one push can overshoot the limit. */
const INFLATE_STEP = 4096
const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50
const EOCD_SEARCH = 22 + 0xffff
const DAMAGED = 'is damaged or isn’t a real spreadsheet, so it can’t be read.'

/** `size`: compressed size from the central directory. */
interface Entry { method: number; size: number; offset: number }

export class Zip {
  private entries = new Map<string, Entry>()
  private used = 0
  private data: Uint8Array

  constructor(data: Uint8Array) {
    this.data = data
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let eocd = -1
    for (let i = data.length - 22; i >= Math.max(0, data.length - EOCD_SEARCH); i--) {
      if (dv.getUint32(i, true) === SIG_EOCD) { eocd = i; break }
    }
    if (eocd < 0) throw new ImportError(DAMAGED)
    const count = dv.getUint16(eocd + 10, true)
    let p = dv.getUint32(eocd + 16, true)
    if (count > IMPORT_MAX_ZIP_ENTRIES) throw new ImportError('has too many parts to be a budget spreadsheet.')
    const utf8 = new TextDecoder()
    for (let n = 0; n < count; n++) {
      if (p + 46 > data.length || dv.getUint32(p, true) !== SIG_CENTRAL) throw new ImportError(DAMAGED)
      const flags = dv.getUint16(p + 8, true)
      const method = dv.getUint16(p + 10, true)
      const size = dv.getUint32(p + 20, true)
      const nameLen = dv.getUint16(p + 28, true)
      const skip = nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true)
      const offset = dv.getUint32(p + 42, true)
      const name = utf8.decode(data.subarray(p + 46, p + 46 + nameLen))
      if (flags & 1) throw new ImportError('is password-protected. Save it without a password and try again.')
      if (size === 0xffffffff || offset === 0xffffffff) throw new ImportError(DAMAGED)
      if (method === 0 || method === 8) this.entries.set(name, { method, size, offset })
      p += 46 + skip
    }
  }

  has(name: string) { return this.entries.has(name) }

  /** Unzip one entry as UTF-8 text, or undefined when it isn't there. Counts toward IMPORT_MAX_UNZIPPED. */
  text(name: string): string | undefined {
    const e = this.entries.get(name)
    if (!e) return undefined
    const dv = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength)
    if (e.offset + 30 > this.data.length || dv.getUint32(e.offset, true) !== SIG_LOCAL) throw new ImportError(DAMAGED)
    const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true)
    const raw = this.data.subarray(start, Math.min(this.data.length, start + e.size))
    const chunks: Uint8Array[] = []
    const add = (c: Uint8Array) => {
      this.used += c.length
      if (this.used > IMPORT_MAX_UNZIPPED) throw new ImportError('unpacks to more than 40 MB, which is too large to be a budget spreadsheet.')
      chunks.push(c)
    }
    if (e.method === 0) add(raw)
    else {
      const inf = new Inflate(c => add(c))
      try {
        if (!raw.length) inf.push(raw, true)
        for (let i = 0; i < raw.length; i += INFLATE_STEP) inf.push(raw.subarray(i, i + INFLATE_STEP), i + INFLATE_STEP >= raw.length)
      } catch (err) {
        throw err instanceof ImportError ? err : new ImportError(DAMAGED)
      }
    }
    const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0))
    let o = 0
    for (const c of chunks) { out.set(c, o); o += c.length }
    return new TextDecoder().decode(out)
  }
}
