import type { ReactNode } from 'react'

// Reward hooks (0008 §7). A reward is a character (an image and a sound) shown with one of the
// animations; fireReward() picks both at random. To add one, add an entry to CHARACTERS or
// ANIMATIONS (the keyframes live in App.css as `.reward-{id}`).

export interface Character {
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

/** Reward art colors (the images are decorative; contrast rules don't apply to them). */
const INK = '#3b2314'
const BLUSH = '#ff9aa2'
const WHITE = '#ffffff'
const GOLD = '#ffd54a'
const GOLD_EDGE = '#e0a800'
const PINK_EAR = '#f7b3c2'
const CATS = {
  ginger: { fur: '#f4a259', stripe: '#c8702a' },
  gray: { fur: '#a7b0bd', stripe: '#6d7684' },
  calico: { fur: '#fff3e0', stripe: '#d9822b' },
}
const HEROES = {
  crimson: { suit: '#d64045', cape: '#1d4e89', skin: '#8d5524', hair: '#2b1a10', mask: '#1d4e89' },
  emerald: { suit: '#2e9e6a', cape: '#6a3d9a', skin: '#f1c27d', hair: '#e0a800', mask: '#6a3d9a' },
}
const STROKE = 3

const face = (
  <>
    <circle cx="38" cy="50" r="4" fill={INK} /><circle cx="58" cy="50" r="4" fill={INK} />
    <path d="M38 60 Q48 70 58 60" fill="none" stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
    <circle cx="30" cy="58" r="4" fill={BLUSH} opacity="0.7" /><circle cx="66" cy="58" r="4" fill={BLUSH} opacity="0.7" />
  </>
)

/** Big chibi eyes with a shine, at x = cx ± 10. */
const chibiEyes = (cx: number, cy: number) => (
  <>
    {[cx - 10, cx + 10].map(x => (
      <g key={x}><ellipse cx={x} cy={cy} rx="4.5" ry="6" fill={INK} /><circle cx={x + 1.5} cy={cy - 2.5} r="1.6" fill={WHITE} /></g>
    ))}
  </>
)

/** A chibi cat: a big round head with ears, a small body and a curled tail. */
function cat({ fur, stripe }: { fur: string; stripe: string }) {
  return (
    <svg viewBox="0 0 96 96" width="96" height="96" focusable="false">
      <path d="M64 82 Q86 78 80 58" fill="none" stroke={fur} strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="48" cy="78" rx="18" ry="14" fill={fur} />
      <ellipse cx="40" cy="90" rx="6" ry="4" fill={fur} /><ellipse cx="56" cy="90" rx="6" ry="4" fill={fur} />
      <path d="M22 34 L26 8 L44 22 Z M74 34 L70 8 L52 22 Z" fill={fur} />
      <path d="M27 28 L29 15 L38 22 Z M69 28 L67 15 L58 22 Z" fill={PINK_EAR} />
      <circle cx="48" cy="44" r="28" fill={fur} />
      <path d="M42 18 L44 26 M48 17 L48 26 M54 18 L52 26" stroke={stripe} strokeWidth={STROKE} strokeLinecap="round" />
      {chibiEyes(48, 46)}
      <path d="M45.5 53 L50.5 53 L48 56 Z" fill={BLUSH} />
      <path d="M43 58 Q45.5 61 48 58 Q50.5 61 53 58" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M30 52 L18 50 M30 56 L18 58 M66 52 L78 50 M66 56 L78 58" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="31" cy="58" r="3.5" fill={BLUSH} opacity="0.7" /><circle cx="65" cy="58" r="3.5" fill={BLUSH} opacity="0.7" />
    </svg>
  )
}

/** A generic chibi superhero: cape, mask and a star on the chest (no real hero's marks). */
function hero({ suit, cape, skin, hair, mask }: { suit: string; cape: string; skin: string; hair: string; mask: string }) {
  return (
    <svg viewBox="0 0 96 96" width="96" height="96" focusable="false">
      <path d="M32 58 L16 92 L80 92 L64 58 Z" fill={cape} />
      <rect x="34" y="58" width="28" height="30" rx="10" fill={suit} />
      <path d="M48 64 L50.5 70 L57 70 L52 74 L54 80 L48 76.5 L42 80 L44 74 L39 70 L45.5 70 Z" fill={GOLD} />
      <rect x="34" y="80" width="28" height="4" fill={GOLD_EDGE} />
      <path d="M34 64 L24 52 M62 64 L72 52" stroke={suit} strokeWidth="7" strokeLinecap="round" />
      <circle cx="23" cy="50" r="4.5" fill={skin} /><circle cx="73" cy="50" r="4.5" fill={skin} />
      <circle cx="48" cy="36" r="25" fill={skin} />
      <path d="M23 34 Q24 10 48 10 Q72 10 73 34 Q64 22 48 22 Q32 22 23 34 Z" fill={hair} />
      <rect x="26" y="31" width="44" height="13" rx="6.5" fill={mask} />
      <ellipse cx="38" cy="37.5" rx="5.5" ry="4" fill={WHITE} /><ellipse cx="58" cy="37.5" rx="5.5" ry="4" fill={WHITE} />
      <circle cx="38.5" cy="37.5" r="2.4" fill={INK} /><circle cx="58.5" cy="37.5" r="2.4" fill={INK} />
      <path d="M41 50 Q48 56 55 50" fill="none" stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
      <circle cx="31" cy="47" r="3.5" fill={BLUSH} opacity="0.6" /><circle cx="65" cy="47" r="3.5" fill={BLUSH} opacity="0.6" />
    </svg>
  )
}

const meow = (ctx: AudioContext) => chime(ctx, [[880, 0, 0.12], [1175, 0.1, 0.12], [988, 0.2, 0.3]])
const fanfare = (ctx: AudioContext) => chime(ctx, [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.4]])

export const CHARACTERS: Character[] = [
  {
    id: 'happy-star',
    image: (
      <svg viewBox="0 0 96 96" width="96" height="96" focusable="false">
        <path d="M48 6 L59 34 L90 36 L66 56 L74 86 L48 69 L22 86 L30 56 L6 36 L37 34 Z" fill={GOLD} stroke={GOLD_EDGE} strokeWidth={STROKE} strokeLinejoin="round" />
        {face}
      </svg>
    ),
    sound: ctx => chime(ctx, [[660, 0, 0.18], [880, 0.12, 0.18], [1175, 0.24, 0.35]]),
  },
  {
    id: 'happy-coin',
    image: (
      <svg viewBox="0 0 96 96" width="96" height="96" focusable="false">
        <circle cx="48" cy="48" r="40" fill={GOLD} stroke={GOLD_EDGE} strokeWidth="4" />
        <circle cx="48" cy="48" r="31" fill="none" stroke={GOLD_EDGE} strokeWidth="2" strokeDasharray="3 4" />
        {face}
      </svg>
    ),
    sound: ctx => chime(ctx, [[784, 0, 0.12], [1047, 0.1, 0.4]]),
  },
  { id: 'cat-ginger', image: cat(CATS.ginger), sound: meow },
  { id: 'cat-gray', image: cat(CATS.gray), sound: meow },
  { id: 'cat-calico', image: cat(CATS.calico), sound: meow },
  { id: 'hero-crimson', image: hero(HEROES.crimson), sound: fanfare },
  { id: 'hero-emerald', image: hero(HEROES.emerald), sound: fanfare },
]

/** A thumbs-up hand that pops in beside the character (the "thumbs" animation). */
const thumb = (
  <svg className="reward-thumb" viewBox="0 0 48 48" width="48" height="48" focusable="false">
    <path d="M14 22 L22 8 Q26 4 28 10 L26 20 L38 20 Q43 21 42 26 L39 38 Q38 42 34 42 L14 42 Z" fill={GOLD} stroke={GOLD_EDGE} strokeWidth={STROKE} strokeLinejoin="round" />
    <rect x="5" y="21" width="9" height="22" rx="2" fill={GOLD_EDGE} />
  </svg>
)

/** Animations (human, 2026-11-26): the original pop, plus dance, fly, thumbs up and spin. `extra` is drawn beside the character. */
export const ANIMATIONS: { id: string; extra?: ReactNode }[] = [
  { id: 'pop' }, { id: 'dance' }, { id: 'fly' }, { id: 'thumbs', extra: thumb }, { id: 'spin' },
]

export const REWARD_EVENT = 'simple-budget:reward'

/** Play a reward. `force` plays it even when Rewards is off (the Preview button in Budget setup). */
export const fireReward = (force = false) => window.dispatchEvent(new CustomEvent(REWARD_EVENT, { detail: { force } }))
