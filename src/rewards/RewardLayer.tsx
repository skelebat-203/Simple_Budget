import { useEffect, useState } from 'react'
import { ANIMATIONS, CHARACTERS, REWARD_EVENT, type Character } from './rewards'

const SHOW_MS = 1800

const pickOne = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

/** Mount once. Shows and sounds a reward (a random character with a random animation) when fireReward() runs and `enabled` (or forced). */
export function RewardLayer({ enabled }: { enabled: boolean }) {
  const [shown, setShown] = useState<{ n: number; who: Character; how: (typeof ANIMATIONS)[number] } | null>(null)

  useEffect(() => {
    let n = 0
    const on = (e: Event) => {
      if (!enabled && !(e as CustomEvent<{ force: boolean }>).detail?.force) return
      const who = pickOne(CHARACTERS)
      setShown({ n: ++n, who, how: pickOne(ANIMATIONS) })
      try {
        const Ctx = window.AudioContext
        if (Ctx) { const ctx = new Ctx(); who.sound(ctx); setTimeout(() => void ctx.close(), 1500) }
      } catch { /* sound unavailable: the image still shows */ }
    }
    window.addEventListener(REWARD_EVENT, on)
    return () => window.removeEventListener(REWARD_EVENT, on)
  }, [enabled])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(null), SHOW_MS)
    return () => clearTimeout(t)
  }, [shown])

  // A new key restarts the animation; one node at a time, so rapid saves don't stack.
  return shown
    ? <div key={shown.n} className={`reward reward-${shown.how.id}`} aria-hidden="true" data-reward={`${shown.who.id} ${shown.how.id}`}>{shown.who.image}{shown.how.extra}</div>
    : null
}
