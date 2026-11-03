import { useEffect, useState } from 'react'
import { REWARD_EVENT, REWARDS, type RewardDef } from './rewards'

const SHOW_MS = 1800

/** Mount once. Shows and sounds a reward when fireReward() runs and `enabled` (or forced). */
export function RewardLayer({ enabled }: { enabled: boolean }) {
  const [shown, setShown] = useState<{ n: number; def: RewardDef } | null>(null)

  useEffect(() => {
    let n = 0
    const on = (e: Event) => {
      if (!enabled && !(e as CustomEvent<{ force: boolean }>).detail?.force) return
      const def = REWARDS[Math.floor(Math.random() * REWARDS.length)]
      setShown({ n: ++n, def })
      try {
        const Ctx = window.AudioContext
        if (Ctx) { const ctx = new Ctx(); def.sound(ctx); setTimeout(() => void ctx.close(), 1500) }
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
  return shown ? <div key={shown.n} className="reward" aria-hidden="true">{shown.def.image}</div> : null
}
