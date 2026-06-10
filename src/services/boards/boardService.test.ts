import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBoard, type ParsedBoard, type ParsedCell } from './boardService'
import type { BoardData } from '../../types/boardData'

// Regression lock for the grid calibration (verified visually against the
// pre-rendered board images — see CLAUDE.md "Grid calibration"). Parses real
// bundled boards covering both geometry profiles (13×15, 13×14) and all boss
// sizes, and snapshots the probe values that would shift if the math drifted.

const loadBoard = (id: string): BoardData =>
  JSON.parse(readFileSync(resolve(__dirname, `../../../public/data/boards/${id}.json`), 'utf8'))

const r1 = (n: number) => Math.round(n * 10) / 10
const roundPoint = (p: { x: number; y: number }) => ({ x: r1(p.x), y: r1(p.y) })

/** The calibration-sensitive essentials of a parsed board. */
function summarize(b: ParsedBoard) {
  const playable = b.cells.filter((c) => c.isPlayable)
  const probe = (col: number, row: number) => {
    const c = b.cells.find((x) => x.col === col && x.row === row) as ParsedCell
    return { axial: { q: c.q, r: c.r }, elevation: c.elevation, center: roundPoint(c.center) }
  }
  const cols = playable.map((c) => c.col)
  const rows = playable.map((c) => c.row)
  return {
    tileSize: b.tileSize,
    view: { x: r1(b.view.x), y: r1(b.view.y), w: r1(b.view.w), h: r1(b.view.h) },
    boss: { size: b.bossSize, start: b.bossStart, rotation: b.bossRotation },
    counts: {
      cells: b.cells.length,
      playable: playable.length,
      playerSpawns: b.cells.filter((c) => c.spawnRole === 'player').length,
      bossCells: b.cells.filter((c) => c.spawnRole === 'boss').length,
      effects: b.cells.filter((c) => c.effect).length,
    },
    // Opposite corners of the playable area + the highest playable cell
    // (locks offsets, row direction, even-column shift, and elevationFactor).
    lowCorner: probe(Math.min(...cols), Math.min(...rows)),
    highCorner: probe(Math.max(...cols), Math.max(...rows)),
    peak: (() => {
      const top = playable.reduce((a, c) => (c.elevation > a.elevation ? c : a))
      return { col: top.col, row: top.row, ...probe(top.col, top.row) }
    })(),
  }
}

describe('parseBoard calibration', () => {
  it('GB_01 — 13×15 profile, size-3 boss', () => {
    expect(summarize(parseBoard(loadBoard('GB_01')))).toMatchInlineSnapshot(`
      {
        "boss": {
          "rotation": 90,
          "size": 3,
          "start": {
            "q": 1,
            "r": 1,
          },
        },
        "counts": {
          "bossCells": 6,
          "cells": 70,
          "effects": 0,
          "playable": 66,
          "playerSpawns": 5,
        },
        "highCorner": {
          "axial": {
            "q": 6,
            "r": -3,
          },
          "center": {
            "x": 718.3,
            "y": 189,
          },
          "elevation": 2,
        },
        "lowCorner": {
          "axial": {
            "q": 0,
            "r": 9,
          },
          "center": {
            "x": 301.3,
            "y": 827,
          },
          "elevation": 2,
        },
        "peak": {
          "axial": {
            "q": 5,
            "r": 2,
          },
          "center": {
            "x": 648.8,
            "y": 486,
          },
          "col": 5,
          "elevation": 4,
          "row": 5,
        },
        "tileSize": 69.5,
        "view": {
          "h": 954.5,
          "w": 625.5,
          "x": 199.3,
          "y": 34.8,
        },
      }
    `)
  })

  it('GB_Dakka_support_01 — 13×14 profile, size-1 boss', () => {
    expect(summarize(parseBoard(loadBoard('GB_Dakka_support_01')))).toMatchInlineSnapshot(`
      {
        "boss": {
          "rotation": 0,
          "size": 1,
          "start": {
            "q": 3,
            "r": -1,
          },
        },
        "counts": {
          "bossCells": 1,
          "cells": 63,
          "effects": 0,
          "playable": 57,
          "playerSpawns": 5,
        },
        "highCorner": {
          "axial": {
            "q": 6,
            "r": -3,
          },
          "center": {
            "x": 745.3,
            "y": 208,
          },
          "elevation": 2,
        },
        "lowCorner": {
          "axial": {
            "q": 0,
            "r": 8,
          },
          "center": {
            "x": 280.3,
            "y": 840.4,
          },
          "elevation": 2,
        },
        "peak": {
          "axial": {
            "q": 3,
            "r": -1,
          },
          "center": {
            "x": 512.8,
            "y": 225.5,
          },
          "col": 3,
          "elevation": 4,
          "row": 8,
        },
        "tileSize": 77.5,
        "view": {
          "h": 946.5,
          "w": 697.5,
          "x": 163.3,
          "y": 38.8,
        },
      }
    `)
  })

  it('GB_Khaine_01 — size-7 boss (anchor = centre of the 7-hex platform)', () => {
    expect(summarize(parseBoard(loadBoard('GB_Khaine_01')))).toMatchInlineSnapshot(`
      {
        "boss": {
          "rotation": 0,
          "size": 7,
          "start": {
            "q": 3,
            "r": 3,
          },
        },
        "counts": {
          "bossCells": 7,
          "cells": 63,
          "effects": 5,
          "playable": 59,
          "playerSpawns": 6,
        },
        "highCorner": {
          "axial": {
            "q": 6,
            "r": -3,
          },
          "center": {
            "x": 745.3,
            "y": 197,
          },
          "elevation": 3,
        },
        "lowCorner": {
          "axial": {
            "q": 0,
            "r": 8,
          },
          "center": {
            "x": 280.3,
            "y": 862.4,
          },
          "elevation": 0,
        },
        "peak": {
          "axial": {
            "q": 3,
            "r": 7,
          },
          "center": {
            "x": 512.8,
            "y": 879.9,
          },
          "col": 3,
          "elevation": 2,
          "row": 0,
        },
        "tileSize": 77.5,
        "view": {
          "h": 946.5,
          "w": 697.5,
          "x": 163.3,
          "y": 38.8,
        },
      }
    `)
  })
})

describe('parseBoard invariants', () => {
  const board = parseBoard(loadBoard('GB_01'))

  it('axial coordinates are unique across cells', () => {
    const keys = new Set(board.cells.map((c) => `${c.q},${c.r}`))
    expect(keys.size).toBe(board.cells.length)
  })

  it('player deployment has 5 indexed slots', () => {
    const slots = board.cells.filter((c) => c.spawnRole === 'player').map((c) => c.spawnIndex)
    expect(slots.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('the boss anchor is one of the boss platform cells', () => {
    const bossCells = board.cells.filter((c) => c.spawnRole === 'boss')
    expect(
      bossCells.some((c) => c.q === board.bossStart.q && c.r === board.bossStart.r),
    ).toBe(true)
  })
})
