import { useEffect, type RefObject } from 'react'

/** Sticky headers turn off on short screens (zoomed, landscape phone), as elsewhere in the app (digital_accessibility.md, Sticky content). */
const SHORT = '(max-height: 480px)'
/** Room kept between the header and a focused control under it. */
const FOCUS_GAP = 8

/** Moves the header down by `offset` px; `stuck` marks it while it is moved. */
function stick(head: HTMLElement, offset: number) {
  head.style.transform = offset ? `translateY(${offset}px)` : ''
  head.classList.toggle('stuck', offset > 0)
}

/**
 * Keeps a table's header row at the top of the viewport while the page scrolls past the table
 * (v0.7 step 6). The table sits in a sideways-scrolling box, which stops `position: sticky` from
 * reaching the page, so the header is moved down with a transform instead; it scrolls sideways
 * with the table. A control that takes focus under the header is scrolled clear of it.
 */
export function useStickyHead(table: RefObject<HTMLTableElement | null>, enabled: boolean) {
  useEffect(() => {
    const t = table.current
    const head = t?.tHead
    if (!enabled || !t || !head) return
    const short = matchMedia(SHORT)
    let frame = 0
    let current = 0
    const place = () => {
      frame = 0
      // Where the header would be without the transform (the caption sits above it).
      const top = head.getBoundingClientRect().top - current
      const room = t.getBoundingClientRect().bottom - top - head.offsetHeight
      const offset = short.matches ? 0 : Math.max(0, Math.min(-top, room))
      current = offset
      stick(head, offset)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place) }
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (short.matches || head.contains(el)) return
      const covered = head.getBoundingClientRect().bottom + FOCUS_GAP - el.getBoundingClientRect().top
      if (head.classList.contains('stuck') && covered > 0) window.scrollBy(0, -covered)
    }
    place()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    short.addEventListener('change', schedule)
    t.addEventListener('focusin', onFocus)
    const grow = new ResizeObserver(schedule)
    grow.observe(t)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      short.removeEventListener('change', schedule)
      t.removeEventListener('focusin', onFocus)
      grow.disconnect()
      stick(head, 0)
    }
  }, [table, enabled])
}
