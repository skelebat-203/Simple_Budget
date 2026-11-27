import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Info button beside a field's label (v0.7 step 15e, human 2026-11-26). Press it to show the field's supporting text
 * in a note that floats over the page (Option B in `docs/design/images/v0.7-info-buttons/`); press again, press
 * outside or press Escape to close it. Escape closes only the note, never a dialog around it.
 *
 * The note is always in the page (visually hidden while closed), and `id` is what the field's `aria-describedby`
 * points to, so a screen reader still reads it with the field. Put the button and the label in one `.label-row`.
 */
export function InfoButton({ id, name, children }: { id: string; name: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [arrowX, setArrowX] = useState(0)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const b = button.current
    if (b) setArrowX(b.offsetLeft + b.offsetWidth / 2)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault(); e.stopPropagation()
      setOpen(false)
    }
    const onPointer = (e: PointerEvent) => {
      const row = button.current?.parentElement
      if (row && !row.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer)
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onPointer) }
  }, [open])

  return (
    <>
      <button ref={button} type="button" className="info-button" aria-expanded={open} aria-label={`${name} help`}
        onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true">i</span>
      </button>
      <p id={id} className={open ? 'info-note' : 'sr-only'} style={open ? { ['--info-arrow-x' as string]: `${arrowX}px` } : undefined}>{children}</p>
    </>
  )
}
