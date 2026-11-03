import type { ReactNode } from 'react'

// Reward hooks (0008 §7). The final design waits on user testing: to add one, add an
// entry to REWARDS (an image and a sound). fireReward() plays one at random.

export interface RewardDef {
  id: string
  /** Decorative image, drawn in a 96×96 box. */
  image: ReactNode
  /** Short sound; `ctx` is a running AudioContext. */
  sound: (ctx: AudioContext) => void
}

/** Plays notes in a row: [frequency Hz, start s, length s]. Quiet, short, soft attack. */
function chime(ctx: AudioContext, notes: [number, number, number][]) {
  for (const [freq, at, len] of notes) {
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.type = 'sine'; osc.frequency.value = freq
    const t = ctx.currentTime + at
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t); osc.stop(t + len + 0.05)
  }
}

const face = (
  <>
    <circle cx="38" cy="50" r="4" fill="#3b2314" /><circle cx="58" cy="50" r="4" fill="#3b2314" />
    <path d="M38 60 Q48 70 58 60" fill="none" stroke="#3b2314" strokeWidth="3" strokeLinecap="round" />
    <circle cx="30" cy="58" r="4" fill="#ff9aa2" opacity="0.7" /><circle cx="66" cy="58" r="4" fill="#ff9aa2" opacity="0.7" />
  </>
)

export const REWARDS: RewardDef[] = [
  {
    id: 'happy-star',
    image: (
      <svg viewBox="0 0 96 96" width="96" height="96" focusable="false">
        <path d="M48 6 L59 34 L90 36 L66 56 L74 86 L48 69 L22 86 L30 56 L6 36 L37 34 Z" fill="#ffd54a" stroke="#e0a800" strokeWidth="3" strokeLinejoin="round" />
        {face}
      </svg>
    ),
    sound: ctx => chime(ctx, [[660, 0, 0.18], [880, 0.12, 0.18], [1175, 0.24, 0.35]]),
  },
  {
    id: 'happy-coin',
    image: (
      <svg viewBox="0 0 96 96" width="96" height="96" focusable="false">
        <circle cx="48" cy="48" r="40" fill="#ffd54a" stroke="#e0a800" strokeWidth="4" />
        <circle cx="48" cy="48" r="31" fill="none" stroke="#e0a800" strokeWidth="2" strokeDasharray="3 4" />
        {face}
      </svg>
    ),
    sound: ctx => chime(ctx, [[784, 0, 0.12], [1047, 0.1, 0.4]]),
  },
]

export const REWARD_EVENT = 'simple-budget:reward'

/** Play a reward. `force` plays it even when Rewards is off (the Preview button in Budget setup). */
export const fireReward = (force = false) => window.dispatchEvent(new CustomEvent(REWARD_EVENT, { detail: { force } }))
