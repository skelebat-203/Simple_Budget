import type { ReactNode } from 'react'

export type BannerKind = 'info' | 'warn' | 'error' | 'success'

/** Decorative icons (0012 §7): lightbulb, triangle, octagon, thumbs up. The shape carries the kind, so colour is never the only cue. */
const ICONS: Record<BannerKind, ReactNode> = {
  info: <path d="M9 21h6M10 17.5h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z" />,
  warn: <><path d="M12 3 2 21h20L12 3z" /><path d="M12 10v5M12 18v.01" /></>,
  error: <><path d="M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7L8.5 3z" /><path d="M12 8v5M12 16v.01" /></>,
  success: <path d="M7 11v9H4v-9h3zM7 11l4-8c1.6 0 2.6 1.1 2.3 2.7L12.6 9H19a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7" />,
}

/** The decorative icon of a banner kind, for use beside other text (a warning line). */
export const BannerIcon = ({ kind }: { kind: BannerKind }) => (
  <svg className="banner-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{ICONS[kind]}</svg>
)

/** Banner with an icon beside its title. Text is plain; announce the message with `announce`/`useAnnounce`, not a live role. */
export function Banner({ kind, title, id, children }: { kind: BannerKind; title: string; id?: string; children?: ReactNode }) {
  return (
    <div id={id} className={`banner banner-${kind}`}>
      <h3 className="banner-title">
        <svg className="banner-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{ICONS[kind]}</svg>
        <span>{title}</span>
      </h3>
      {children}
    </div>
  )
}
