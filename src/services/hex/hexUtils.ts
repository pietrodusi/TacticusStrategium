import type { HexCoord, Point } from '../../types/strategium'

/**
 * Convert axial hex coordinates to pixel position (center of hex).
 * Flat-top hexagon orientation with isometric vertical scaling.
 */
export function hexToPixel(
  hex: HexCoord,
  size: number,
  origin: Point,
  verticalScale: number = 1,
  level: number = 0,
  levelYOffset: number = 0,
): Point {
  // Flat-top axial layout: x = size * 3/2 * q ; y = size * sqrt(3) * (r + q/2)
  const x = size * 1.5 * hex.q
  const y = size * Math.sqrt(3) * (hex.r + hex.q / 2) * verticalScale

  // Higher elevation lifts the hex up the screen (smaller y).
  const offset = level * levelYOffset

  return {
    x: origin.x + x,
    y: origin.y + y - offset,
  }
}

/** Convert a pixel position to the nearest hex coordinate. */
export function pixelToHex(
  point: Point,
  size: number,
  origin: Point,
  verticalScale: number = 1,
): HexCoord {
  const x = point.x - origin.x
  const y = (point.y - origin.y) / verticalScale

  const q = ((2 / 3) * x) / size
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size

  return hexRound({ q, r })
}

/** Round fractional hex coordinates to the nearest hex (via cube coords). */
export function hexRound(hex: { q: number; r: number }): HexCoord {
  const x = hex.q
  const z = hex.r
  const y = -x - z

  let rx = Math.round(x)
  let ry = Math.round(y)
  let rz = Math.round(z)

  const xDiff = Math.abs(rx - x)
  const yDiff = Math.abs(ry - y)
  const zDiff = Math.abs(rz - z)

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz
  } else if (yDiff > zDiff) {
    ry = -rx - rz
  } else {
    rz = -rx - ry
  }

  // Normalize -0 to 0 so coordinates compare/serialize cleanly.
  return { q: rx || 0, r: rz || 0 }
}

/** The 6 corner points of a hexagon (flat-top, isometric-scaled). */
export function hexCorners(center: Point, size: number, verticalScale: number = 1): Point[] {
  const corners: Point[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    corners.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle) * verticalScale,
    })
  }
  return corners
}

/** Hex distance (number of steps) between two hexes. */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const ax = a.q
  const az = a.r
  const ay = -ax - az

  const bx = b.q
  const bz = b.r
  const by = -bx - bz

  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz))
}

/** The 6 neighboring hexes. */
export function hexNeighbors(hex: HexCoord): HexCoord[] {
  const directions: HexCoord[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ]
  return directions.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }))
}

/**
 * All hexes occupied by a boss token. `center` is the anchor (where the image
 * sits — the bottom-left hex). +q is right, +r is down.
 * - size 1: just the anchor.
 * - size 3: two 90° orientations (toggled by rotation % 180):
 *     A (0°)  — anchor + the hex above + the upper-right hex → 2 left, 1 right.
 *     B (90°) — anchor + the two right-column hexes          → 1 left, 2 right.
 * - size 7: anchor + all 6 neighbours (flower).
 */
export function getBossOccupiedHexes(
  center: HexCoord,
  size: 1 | 3 | 7,
  rotation: number = 0,
): HexCoord[] {
  if (size === 1) return [center]

  if (size === 3) {
    if (rotation % 180 === 0) {
      return [center, { q: center.q, r: center.r - 1 }, { q: center.q + 1, r: center.r - 1 }]
    }
    return [center, { q: center.q + 1, r: center.r }, { q: center.q + 1, r: center.r - 1 }]
  }

  // size === 7: center + all 6 neighbours.
  const directions: HexCoord[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ]
  return [center, ...directions.map((d) => ({ q: center.q + d.q, r: center.r + d.r }))]
}

export function hexEquals(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r
}

export function hexKey(hex: HexCoord): string {
  return `${hex.q},${hex.r}`
}
