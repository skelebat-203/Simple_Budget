import { useEffect, useState } from 'react'
import * as sync from '../storage/sync/controller'

/** Current sync state, kept up to date (busy, linked, last sync, error). */
export function useSyncState() {
  const [s, setS] = useState(sync.syncState())
  useEffect(() => sync.subscribe(setS), [])
  return s
}
