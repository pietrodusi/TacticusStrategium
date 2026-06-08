// Core geometry + token types for the Strategium planner.

/** Axial coordinate for flat-top hexagons. */
export interface HexCoord {
  q: number // column
  r: number // row
}

/** Pixel point. */
export interface Point {
  x: number
  y: number
}

/** How a hex grid is laid over a map image (all values in image-pixel space). */
export interface HexGridConfig {
  originX: number
  originY: number
  hexSize: number
  verticalScale: number
  rotation: number
  rows: number
  cols: number
  levelYOffset?: number
  hexMargin?: number
}

export type BossSize = 1 | 3 | 7

export type TokenType = 'character' | 'summon' | 'boss'

/** A token's position at a single turn. */
export interface TokenPosition {
  hexCoord: HexCoord
  rotation?: number // for multi-hex bosses (0/60/.../300)
}
