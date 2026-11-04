import { useEffect, useRef } from 'react'

/**
 * The app's one live region (a11y-v0.5): polite, visually hidden. Every status, error and
 * notice message is injected here with announce(); visible copies of messages are plain text.
 *
 * The region is created on first use. An open modal dialog makes everything outside it inert,
 * so the region moves into the topmost open dialog (or back to <body>) before each message.
 */
let region: HTMLElement | null = null
let timer: ReturnType<typeof setTimeout> | undefined

function ensure(): HTMLElement {
  if (!region) {
    region = document.createElement('div')
    region.id = 'live-region'
    region.className = 'sr-only'
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
  }
  const host = [...document.querySelectorAll('dialog[open]')].pop() ?? document.body
  if (region.parentElement !== host || !region.isConnected) host.appendChild(region)
  return region
}

/** Announce a message politely. Clearing first lets the same text be announced twice. */
export function announce(message: string) {
  if (!message) return
  const r = ensure()
  r.textContent = ''
  clearTimeout(timer)
  timer = setTimeout(() => { r.textContent = message }, 60)
}

/** Announce `message` whenever it changes to something non-empty (not on first render if `skipFirst`). */
export function useAnnounce(message: string, skipFirst = false) {
  const first = useRef(true)
  useEffect(() => {
    const was = first.current
    first.current = false
    if (message && !(skipFirst && was)) announce(message)
  }, [message, skipFirst])
}
