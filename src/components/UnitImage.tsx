import { useState } from 'react'
import { unitPortraitUrl } from '../services/paths'

/**
 * Unit portrait that degrades gracefully: round portrait → square portrait →
 * initial-letter placeholder. Not every unit has a RoundPortrait_ asset (e.g.
 * the Tervigon bosses), so we fall back instead of showing a broken image.
 */
export function UnitImage({
  stem,
  alt,
  round = true,
  className = '',
}: {
  stem: string | null
  alt: string
  round?: boolean
  className?: string
}) {
  const sources = stem
    ? round
      ? [unitPortraitUrl(stem, true), unitPortraitUrl(stem, false)]
      : [unitPortraitUrl(stem, false)]
    : []

  // Reset the fallback index when the stem changes (derived, no effect).
  const [state, setState] = useState({ stem, idx: 0 })
  const idx = state.stem === stem ? state.idx : 0

  if (sources.length === 0 || idx >= sources.length) {
    return (
      <div className={`grid place-items-center bg-steel-2 text-ash ${className}`} aria-label={alt}>
        {alt.charAt(0)}
      </div>
    )
  }
  return (
    <img
      src={sources[idx]}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setState({ stem, idx: idx + 1 })}
    />
  )
}
