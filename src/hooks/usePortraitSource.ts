import { useState } from 'react'
import { unitPortraitSources } from '../services/paths'

/**
 * Walks a unit's portrait URLs as each one fails to load. `src` is null when
 * there is no stem or every source has failed, so callers can draw a placeholder.
 */
export function usePortraitSource(stem: string | null, round = false) {
  const sources = stem ? unitPortraitSources(stem, round) : []

  // Reset the fallback index when the stem changes (derived, no effect).
  const [state, setState] = useState({ stem, idx: 0 })
  const idx = state.stem === stem ? state.idx : 0

  return {
    src: sources[idx] ?? null,
    onError: () => setState({ stem, idx: idx + 1 }),
  }
}
