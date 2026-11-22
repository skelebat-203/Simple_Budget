import { useSyncExternalStore } from 'react'

/** The medium breakpoint (0007 §10): tabs and the Budget screen's Sync placement switch here. */
const WIDE = '(min-width: 640px)'
const subscribe = (cb: () => void) => { const m = matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) }
export const useWide = () => useSyncExternalStore(subscribe, () => matchMedia(WIDE).matches)
