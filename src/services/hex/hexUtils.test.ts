import { describe, expect, it } from 'vitest'
import {
  getBossOccupiedHexes,
  hexDistance,
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

  it('size 3 has two 90° orientations anchored on the same hex', () => {
    const a = getBossOccupiedHexes(center, 3, 0)
    const b = getBossOccupiedHexes(center, 3, 90)
    expect(a).toHaveLength(3)
    expect(b).toHaveLength(3)
    // The anchor (image hex) is shared; both stay adjacent to it.
    expect(a[0]).toEqual(center)
    expect(b[0]).toEqual(center)
    expect(a.every((h) => hexDistance(center, h) <= 1)).toBe(true)
    expect(b.every((h) => hexDistance(center, h) <= 1)).toBe(true)
    const set = (hs: HexCoord[]) => new Set(hs.map(hexKey))
    expect(set(a)).not.toEqual(set(b))
  })

  it('size 3 rotation is a 180°-periodic toggle', () => {
    expect(getBossOccupiedHexes(center, 3, 180)).toEqual(getBossOccupiedHexes(center, 3, 0))
    expect(getBossOccupiedHexes(center, 3, 270)).toEqual(getBossOccupiedHexes(center, 3, 90))
  })
})

describe('hexRound', () => {
  it('snaps fractional coordinates to a valid hex', () => {
    expect(hexRound({ q: 0.2, r: -0.1 })).toEqual({ q: 0, r: 0 })
  })
})
