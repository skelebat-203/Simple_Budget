/**
 * Sheet encryption (0015 §5): AES-GCM per record, key from the passcode via PBKDF2 with a
 * random salt kept in the sheet's Settings tab. The key is non-extractable: it can be used
 * but never read out. The row's tab and id are bound in as additional data, so content
 * moved to another row fails to decrypt like any other change.
 */
export const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_BITS = 256
/** Known text encrypted into the sheet's check row: a wrong passcode fails to decrypt it. */
export const CHECK_TEXT = 'simple-budget-sync-check'

const enc = new TextEncoder()
const dec = new TextDecoder()

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export const newSalt = () => crypto.getRandomValues(new Uint8Array(SALT_BYTES))

export async function deriveKey(passcode: string, salt: Uint8Array<ArrayBuffer>, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: KEY_BITS }, false, ['encrypt', 'decrypt'])
}

export async function encrypt(key: CryptoKey, aad: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(plain)))
  const out = new Uint8Array(IV_BYTES + ct.length)
  out.set(iv)
  out.set(ct, IV_BYTES)
  return toBase64(out)
}

/** Throws on any change to the text, the row's tab or id, or a wrong key. */
export async function decrypt(key: CryptoKey, aad: string, text: string): Promise<string> {
  const all = fromBase64(text)
  if (all.length <= IV_BYTES) throw new Error('too short')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, IV_BYTES), additionalData: enc.encode(aad) }, key, all.slice(IV_BYTES))
  return dec.decode(plain)
}

export const aadOf = (tab: string, id: string) => `${tab}|${id}`
