import type { TileEffectKind } from '../services/boards/boardService'

/** Tile-hazard fills (each hex also overlays its keyword icon). */
export const EFFECT_FILL: Record<TileEffectKind, string> = {
  fire: 'rgba(232,92,30,0.40)',
  ice: 'rgba(120,200,232,0.34)',
  contaminated: 'rgba(120,200,60,0.32)',
}

/** Bundled keyword-icon stems per hazard (ice really is `uniteffect_ice`). */
export const EFFECT_ICON: Record<TileEffectKind, string> = {
  fire: 'tile_effect_fire',
  ice: 'uniteffect_ice',
  contaminated: 'tile_effect_contaminated',
}
