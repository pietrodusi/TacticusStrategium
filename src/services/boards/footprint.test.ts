import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBoard, type ParsedCell } from './boardService'
import { footprintPath } from './footprint'
import { getBossOccupiedHexes, hexKey } from '../hex/hexUtils'
import type { BoardData } from '../../types/boardData'

const loadBoard = (id: string): BoardData =>
  JSON.parse(readFileSync(resolve(__dirname, `../../../public/data/boards/${id}.json`), 'utf8'))

/** Resolve a footprint's cells the same way HexGrid does. */
function cellsFor(boardId: string, size: 1 | 3 | 7) {
  const board = parseBoard(loadBoard(boardId))
  const byAxial = new Map(board.cells.map((c) => [hexKey({ q: c.q, r: c.r }), c]))
  return getBossOccupiedHexes(board.bossStart, size, board.bossRotation)
    .map((h) => byAxial.get(hexKey(h)))
    .filter((c): c is ParsedCell => !!c)
}

const pathPoints = (d: string) =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))

describe('footprintPath', () => {
  it('returns empty for no cells', () => {
    expect(footprintPath([])).toBe('')
  })

  it('merges a 3-hex boss into one closed loop', () => {
    const cells = cellsFor('GB_01', 3)
    expect(cells).toHaveLength(3)
    const d = footprintPath(cells)
    // A single subpath: one M, closed with Z.
    expect(d.match(/M/g)).toHaveLength(1)
    expect(d.endsWith('Z')).toBe(true)
    // The 3-hex triangle shares 3 edges → 18 − 2·3 = 12 boundary vertices.
    expect(pathPoints(d)).toHaveLength(12)
  })

  it('merges a 7-hex boss into one closed loop', () => {
    const cells = cellsFor('GB_Khaine_01', 7)
    expect(cells).toHaveLength(7)
    const d = footprintPath(cells)
    expect(d.match(/M/g)).toHaveLength(1)
    // Flower: 7·6 edges − 2·12 shared = 18 boundary vertices.
    expect(pathPoints(d)).toHaveLength(18)
  })

  it('bridges junction gaps — consecutive vertices are never closer than a real corner step', () => {
    const cells = cellsFor('GB_Khaine_01', 7)
    const pts = pathPoints(footprintPath(cells))
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      // Every step along the outline is a genuine hex edge (~half a tile or
      // more) — tiny steps would mean an unbridged junction gap survived.
      expect(dist).toBeGreaterThan(20)
    }
  })

  it('keeps cells at different elevations in a single loop', () => {
    // Place a 7-hex footprint over uneven ground: find an anchor whose
    // neighbourhood spans ≥ 2 elevation levels on a real board.
    const board = parseBoard(loadBoard('GB_01'))
    const byAxial = new Map(board.cells.map((c) => [hexKey({ q: c.q, r: c.r }), c]))
    const uneven = board.cells.find((c) => {
      const cells = getBossOccupiedHexes({ q: c.q, r: c.r }, 7, 0)
        .map((h) => byAxial.get(hexKey(h)))
        .filter((x): x is ParsedCell => !!x)
      return cells.length === 7 && new Set(cells.map((x) => x.elevation)).size >= 2
    })
    expect(uneven).toBeDefined()
    const cells = getBossOccupiedHexes({ q: uneven!.q, r: uneven!.r }, 7, 0)
      .map((h) => byAxial.get(hexKey(h)))
      .filter((x): x is ParsedCell => !!x)
    const d = footprintPath(cells)
    expect(d.match(/M/g)).toHaveLength(1)
    expect(pathPoints(d)).toHaveLength(18)
  })
})
