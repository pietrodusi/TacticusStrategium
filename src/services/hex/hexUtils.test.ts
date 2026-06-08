import { describe, expect, it } from 'vitest'
import {
  getBossOccupiedHexes,
  hexDistance,
  hexEquals,
  hexKey,
  hexNeighbors,
  hexRound,
  hexToPixel,
  pixelToHex,
} from './hexUtils'
import type { HexCoord, Point } from '../../types/strategium'

const ORIGIN: Point = { x: 100, y: 200 }

describe('hexToPixel / pixelToHex', () => {
  it('places hex (0,0) at the origin', () => {
    expect(hexToPixel({ q: 0, r: 0 }, 40, ORIGIN)).toEqual(ORIGIN)
  })

  it('round-trips a range of hexes back to themselves', () => {
    for (let q = -4; q <= 4; q++) {
      for (let r = -4; r <= 4; r++) {
        const hex: HexCoord = { q, r }
        const px = hexToPixel(hex, 40, ORIGIN, 0.885)
        expect(pixelToHex(px, 40, ORIGIN, 0.885)).toEqual(hex)
      }
    }
  })

  it('lifts elevated hexes up the screen', () => {
    const ground = hexToPixel({ q: 1, r: 1 }, 40, ORIGIN, 0.885, 0, 11)
    const raised = hexToPixel({ q: 1, r: 1 }, 40, ORIGIN, 0.885, 2, 11)
    expect(raised.y).toBeCloseTo(ground.y - 22)
  })
})

describe('hexDistance', () => {
  it('is 0 for the same hex and 1 for neighbors', () => {
    const c: HexCoord = { q: 2, r: -1 }
    expect(hexDistance(c, c)).toBe(0)
    for (const n of hexNeighbors(c)) expect(hexDistance(c, n)).toBe(1)
  })
})

describe('getBossOccupiedHexes', () => {
  const center: HexCoord = { q: 3, r: 3 }

  it('returns a single hex for size 1', () => {
    expect(getBossOccupiedHexes(center, 1)).toEqual([center])
  })

  it('returns 7 hexes (center + 6 neighbors) for size 7', () => {
    const hexes = getBossOccupiedHexes(center, 7)
    expect(hexes).toHaveLength(7)
    expect(hexes[0]).toEqual(center)
    expect(new Set(hexes.map(hexKey)).size).toBe(7)
  })

  it('returns 3 contiguous hexes for size 3 and rotates with the angle', () => {
    const a = getBossOccupiedHexes(center, 3, 0)
    const b = getBossOccupiedHexes(center, 3, 180)
    expect(a).toHaveLength(3)
    expect(b).toHaveLength(3)
    // Center is shared; the two wings differ between opposite rotations.
    expect(a.every((h) => hexDistance(center, h) <= 1)).toBe(true)
    expect(a.slice(1).some((h) => b.slice(1).some((g) => hexEquals(h, g)))).toBe(false)
  })

  it('normalizes negative rotations', () => {
    expect(getBossOccupiedHexes(center, 3, -360)).toEqual(getBossOccupiedHexes(center, 3, 0))
  })
})

describe('hexRound', () => {
  it('snaps fractional coordinates to a valid hex', () => {
    expect(hexRound({ q: 0.2, r: -0.1 })).toEqual({ q: 0, r: 0 })
  })
})
