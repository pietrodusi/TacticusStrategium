import { describe, expect, it } from 'vitest'
import { deriveBoardView, isValidFootprint, overlapsMultiHex, phaseStepOrder, stepCursor, tokenOccupying, type TokenDef } from './planView'
import { getBossOccupiedHexes } from '../../services/hex/hexUtils'
import type { BoardToken } from '../HexGrid'
import { MAX_PHASE, attackEntry } from '../../stores/planStore'
import type { ParsedBoard } from '../../services/boards/boardService'

const board = { bossStart: { q: 9, r: 9 }, bossRotation: 0 } as unknown as ParsedBoard
const unit: TokenDef = { id: 'u', type: 'character', stem: null, name: 'U', size: 1 }
const boss: TokenDef = { id: 'b', type: 'boss', stem: null, name: 'B', size: 3 }
const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }
const C = { q: 2, r: 0 }

const legs = (positions: Parameters<typeof deriveBoardView>[1], waypoints = {}, defs = [unit]) =>
  deriveBoardView(defs, positions, 1, board, { waypoints }).movements

describe('deriveBoardView movement legs', () => {
  it('keeps a plain move as one straight arrow into the token', () => {
    expect(legs({ u: { 0: A, 1: B } })).toMatchObject([{ from: A, to: B, curve: 0, endsAtToken: true }])
  })

  it('chains a stop, with only the last leg ending at the token', () => {
    expect(legs({ u: { 0: A, 1: C } }, { u: { 1: [B] } })).toMatchObject([
      { from: A, to: B, curve: 0, endsAtToken: false },
      { from: B, to: C, curve: 0, endsAtToken: true },
    ])
  })

  it('shows a return trip even though the unit ends where it began', () => {
    expect(legs({ u: { 0: A, 1: A } }, { u: { 1: [B] } })).toMatchObject([
      { from: A, to: B, curve: 1 },
      { from: B, to: A, curve: 1 },
    ])
  })

  it('bows repeated same-direction legs further apart', () => {
    const curves = legs({ u: { 0: A, 1: B } }, { u: { 1: [B, A] } }).map((m) => m.curve)
    expect(curves).toEqual([1, 1, 2])
  })

  it('starts a boss route from its board start until placed', () => {
    expect(legs({ b: { 1: A } }, { b: { 1: [B] } }, [boss])[0].from).toEqual({ q: 9, r: 9 })
  })

  it('draws nothing for a unit that did not move', () => {
    expect(legs({ u: { 0: A } })).toEqual([])
  })
})

describe('turn replay', () => {
  const other: TokenDef = { id: 'v', type: 'character', stem: null, name: 'V', size: 1 }
  const positions = { u: { 0: A, 1: C }, v: { 0: { q: 5, r: 5 }, 1: { q: 6, r: 5 } } }
  const data = { waypoints: { u: { 1: [B] } }, moveOrder: { 1: ['u', 'v', 'u'] } }
  const defs = [unit, other]
  const at = (step: number | null) => {
    const view = deriveBoardView(defs, positions, 1, board, { ...data, step })
    return {
      u: view.tokens.find((t) => t.id === 'u')!.pos,
      v: view.tokens.find((t) => t.id === 'v')!.pos,
      arrows: view.movements.length,
    }
  }

  it('plays steps in the order they were made', () => {
    expect(phaseStepOrder(defs, positions, 1, board, data)).toEqual(['u', 'v', 'u'])
  })

  it('moves one unit by one step per move shown', () => {
    expect(at(1)).toMatchObject({ u: B, v: { q: 5, r: 5 }, arrows: 1 })
    expect(at(2)).toMatchObject({ u: B, v: { q: 6, r: 5 }, arrows: 2 })
    expect(at(null)).toMatchObject({ u: C, v: { q: 6, r: 5 }, arrows: 3 })
  })

  it('points the latest shown arrow at the token', () => {
    const { movements } = deriveBoardView(defs, positions, 1, board, { ...data, step: 1 })
    expect(movements).toMatchObject([{ to: B, endsAtToken: true }])
  })

  it('falls back to unit order for plans with no recorded order', () => {
    expect(phaseStepOrder(defs, positions, 1, board, { waypoints: data.waypoints })).toEqual(['u', 'u', 'v'])
  })

  const counts: Record<number, number> = { 0: 0, 1: 3, 2: 0, 3: 1 }
  const count = (p: number) => counts[p] ?? 0

  it('walks forward through moves, then into the next turn', () => {
    expect(stepCursor({ phase: 1, step: 1 }, 1, count)).toEqual({ phase: 1, step: 2 })
    expect(stepCursor({ phase: 1, step: 2 }, 1, count)).toEqual({ phase: 1, step: null })
    expect(stepCursor({ phase: 0, step: null }, 1, count)).toEqual({ phase: 1, step: 1 })
    expect(stepCursor({ phase: 1, step: null }, 1, count)).toEqual({ phase: 2, step: null })
  })

  it('walks back to the previous turn from its first move', () => {
    expect(stepCursor({ phase: 1, step: null }, -1, count)).toEqual({ phase: 1, step: 2 })
    expect(stepCursor({ phase: 1, step: 1 }, -1, count)).toEqual({ phase: 0, step: null })
    expect(stepCursor({ phase: 3, step: null }, -1, count)).toEqual({ phase: 2, step: null })
  })

  it('stops at both ends of the fight', () => {
    expect(stepCursor({ phase: 0, step: null }, -1, count)).toBeNull()
    expect(stepCursor({ phase: MAX_PHASE, step: null }, 1, count)).toBeNull()
  })
})

describe('removal as a replay action', () => {
  // u moves A→B, then v moves, then u is removed.
  const other: TokenDef = { id: 'v', type: 'character', stem: null, name: 'V', size: 1 }
  const D = { q: 5, r: 5 }
  const E = { q: 6, r: 5 }
  const positions = { u: { 0: A, 1: null }, v: { 0: D, 1: E } }
  const data = { waypoints: { u: { 1: [B] } }, moveOrder: { 1: ['u', 'v', 'u'] } }
  const defs = [unit, other]
  const view = (step: number | null) => deriveBoardView(defs, positions, 1, board, { ...data, step })
  const u = (step: number | null) => view(step).tokens.find((t) => t.id === 'u')

  it('counts the removal as an action', () => {
    expect(phaseStepOrder(defs, positions, 1, board, data)).toEqual(['u', 'v', 'u'])
  })

  it('keeps the unit live until its removal is played, then leaves a ghost', () => {
    expect(u(1)).toMatchObject({ pos: B, ghost: false })
    expect(u(2)).toMatchObject({ pos: B, ghost: false })
    expect(u(null)).toMatchObject({ pos: B, ghost: true })
  })

  it('draws ghosts first so live units stay on top', () => {
    expect(view(null).tokens.map((t) => t.id)).toEqual(['u', 'v'])
    expect(deriveBoardView([other, unit], positions, 1, board, data).tokens[0].id).toBe('u')
  })

  it('shows no ghost on later turns', () => {
    expect(deriveBoardView(defs, positions, 2, board, data).tokens.map((t) => t.id)).toEqual(['v'])
  })

  it('keeps the route of a removed unit, ending at its ghost', () => {
    expect(view(null).movements.filter((m) => m.to.q === B.q && m.to.r === B.r)).toMatchObject([
      { from: A, to: B, endsAtToken: true },
    ])
  })

  it('shows a unit removed without moving at its start until the removal', () => {
    const still = { u: { 0: A, 1: null } }
    const order = { moveOrder: { 1: ['u'] } }
    expect(phaseStepOrder([unit], still, 1, board, order)).toEqual(['u'])
    expect(deriveBoardView([unit], still, 1, board, { ...order, step: 0 }).tokens[0]).toMatchObject({ pos: A, ghost: false })
    expect(deriveBoardView([unit], still, 1, board, order).tokens[0]).toMatchObject({ pos: A, ghost: true })
  })

  it('treats a removal from an older plan as the last action of that unit', () => {
    expect(phaseStepOrder(defs, positions, 1, board, { waypoints: data.waypoints })).toEqual(['u', 'u', 'v'])
  })

  it('ignores a unit that was already gone', () => {
    expect(phaseStepOrder([unit], { u: { 0: null, 1: null } }, 1, board, {})).toEqual([])
  })
})

describe('attacks', () => {
  const other: TokenDef = { id: 'v', type: 'npc', stem: null, name: 'V', size: 1 }
  const D = { q: 5, r: 5 }
  const E = { q: 6, r: 5 }
  const defs = [unit, other]
  const hit = attackEntry('u', 'v')
  const red = '#ef4444'
  const positions = { u: { 0: A, 1: B }, v: { 0: D } }
  const view = (order: string[], step: number | null = null, pos: Parameters<typeof deriveBoardView>[1] = positions) =>
    deriveBoardView(defs, pos, 1, board, { moveOrder: { 1: order }, step })
  const attacks = (order: string[], step: number | null = null, pos?: Parameters<typeof deriveBoardView>[1]) =>
    view(order, step, pos).movements.filter((m) => m.color === red)

  it('draws a red arrow to the target and marks the attacker', () => {
    expect(attacks(['u', hit])).toMatchObject([{ from: B, to: D, endsAtToken: true }])
    const v = view(['u', hit])
    expect(v.tokens.find((t) => t.id === 'u')?.attacked).toBe(true)
    expect(v.tokens.find((t) => t.id === 'v')?.attacked).toBe(false)
  })

  it('starts from where the attacker stood when it attacked', () => {
    expect(attacks([hit, 'u'])).toMatchObject([{ from: A, to: D }])
  })

  it('points at where the target stood at that moment', () => {
    const moved = { u: { 0: A }, v: { 0: D, 1: E } }
    expect(attacks([hit, 'v'], null, moved)).toMatchObject([{ from: A, to: D }])
    expect(attacks(['v', hit], null, moved)).toMatchObject([{ from: A, to: E }])
  })

  it('counts as its own replay action', () => {
    expect(phaseStepOrder(defs, positions, 1, board, { moveOrder: { 1: ['u', hit] } })).toEqual(['u', hit])
    expect(attacks(['u', hit, 'v'], 1)).toEqual([])
    expect(view(['u', hit, 'v'], 1).tokens.find((t) => t.id === 'u')?.attacked).toBe(false)
    expect(attacks(['u', hit, 'v'], 2)).toHaveLength(1)
  })

  it('curves repeated attacks along the same line apart', () => {
    expect(attacks([hit, hit]).map((m) => m.curve)).toEqual([1, 2])
  })

  it('drops an attack on a target already removed at that point', () => {
    const gone = { u: { 0: A }, v: { 0: D, 1: null } }
    expect(phaseStepOrder(defs, gone, 1, board, { moveOrder: { 1: [hit, 'v'] } })).toEqual([hit, 'v'])
    expect(phaseStepOrder(defs, gone, 1, board, { moveOrder: { 1: ['v', hit] } })).toEqual(['v'])
  })

  it('drops an attack by a unit no longer in the plan', () => {
    expect(phaseStepOrder([unit], { u: { 0: A } }, 1, board, { moveOrder: { 1: [hit] } })).toEqual([])
  })
})

describe('multi-hex occupancy', () => {
  const token = (id: string, q: number, r: number, size: number, extra: Partial<BoardToken> = {}): BoardToken => ({
    id,
    type: 'character',
    stem: null,
    name: id,
    size,
    pos: { q, r, rot: 0 },
    ...extra,
  })
  const big = token('big', 3, 3, 3)
  const cover = getBossOccupiedHexes(big.pos, 3, 0)
  const offAnchor = cover.find((h) => h.q !== 3 || h.r !== 3)!
  const free = { q: 9, r: 9 }

  it('refuses a single-hex unit on any hex of a multi-hex unit', () => {
    expect(overlapsMultiHex([big], 'u', offAnchor, 1, 0)).toBe(true)
    expect(overlapsMultiHex([big], 'u', big.pos, 1, 0)).toBe(true)
    expect(overlapsMultiHex([big], 'u', free, 1, 0)).toBe(false)
  })

  it('refuses a multi-hex unit covering a single-hex unit', () => {
    const small = token('s', offAnchor.q, offAnchor.r, 1)
    expect(overlapsMultiHex([small], 'big', big.pos, 3, 0)).toBe(true)
  })

  it('ignores the moving unit itself', () => {
    expect(overlapsMultiHex([big], 'big', offAnchor, 3, 0)).toBe(false)
  })

  it('does not treat two single-hex units as a multi-hex overlap', () => {
    expect(overlapsMultiHex([token('s', 1, 1, 1)], 'u', { q: 1, r: 1 }, 1, 0)).toBe(false)
  })

  it('treats a ghost hex as free', () => {
    expect(overlapsMultiHex([token('big', 3, 3, 3, { ghost: true })], 'u', offAnchor, 1, 0)).toBe(false)
    expect(tokenOccupying([token('big', 3, 3, 3, { ghost: true })], 'u', offAnchor)).toBeUndefined()
  })

  describe('isValidFootprint', () => {
    const cell = (q: number, r: number, elevation = 0, isPlayable = true) => ({ q, r, elevation, isPlayable })
    const onCover = (overrides: Record<string, Partial<ReturnType<typeof cell>>> = {}) => ({
      cells: cover.map((h) => ({ ...cell(h.q, h.r), ...overrides[`${h.q},${h.r}`] })),
    }) as unknown as Pick<ParsedBoard, 'cells'>
    const key = `${offAnchor.q},${offAnchor.r}`

    it('accepts a footprint fully on the map at one height', () => {
      expect(isValidFootprint(onCover(), big.pos, 3, 0)).toBe(true)
    })

    it('accepts raised ground as long as every hex matches', () => {
      const raised = Object.fromEntries(cover.map((h) => [`${h.q},${h.r}`, { elevation: 2 }]))
      expect(isValidFootprint(onCover(raised), big.pos, 3, 0)).toBe(true)
    })

    it('refuses a footprint across different heights', () => {
      expect(isValidFootprint(onCover({ [key]: { elevation: 1 } }), big.pos, 3, 0)).toBe(false)
    })

    it('refuses a footprint on an unplayable hex', () => {
      expect(isValidFootprint(onCover({ [key]: { isPlayable: false } }), big.pos, 3, 0)).toBe(false)
    })

    it('refuses a footprint running off the map', () => {
      expect(isValidFootprint({ cells: onCover().cells.slice(0, 2) }, big.pos, 3, 0)).toBe(false)
    })

    it('does not constrain single-hex units', () => {
      expect(isValidFootprint({ cells: [] }, free, 1, 0)).toBe(true)
    })
  })

  it('finds the unit on any hex of its footprint', () => {
    expect(tokenOccupying([big], 'u', offAnchor)?.id).toBe('big')
    expect(tokenOccupying([big], 'big', offAnchor)).toBeUndefined()
  })
})

describe('placement as a replay action', () => {
  const other: TokenDef = { id: 'v', type: 'character', stem: null, name: 'V', size: 1 }
  const D = { q: 5, r: 5 }
  const defs = [unit, other]
  const positions = { u: { 0: A, 1: B }, v: { 1: D } }
  const data = { moveOrder: { 1: ['u', 'v'] } }
  const present = (step: number | null) =>
    deriveBoardView(defs, positions, 1, board, { ...data, step }).tokens.map((t) => t.id)

  it('counts the placement as an action', () => {
    expect(phaseStepOrder(defs, positions, 1, board, data)).toEqual(['u', 'v'])
  })

  it('shows the unit only once its placement is played', () => {
    expect(present(1)).toEqual(['u'])
    expect(present(null)).toEqual(['u', 'v'])
  })

  it('draws no arrow for a placement', () => {
    expect(deriveBoardView(defs, positions, 1, board, data).movements).toHaveLength(1)
  })

  it('offsets later steps by the placement', () => {
    const moved = { v: { 1: B } }
    const route = { waypoints: { v: { 1: [A] } }, moveOrder: { 1: ['v', 'v'] } }
    const v = (step: number | null) => deriveBoardView([other], moved, 1, board, { ...route, step })
    expect(v(1).tokens[0].pos).toMatchObject(A)
    expect(v(1).movements).toHaveLength(0)
    expect(v(null).tokens[0].pos).toMatchObject(B)
    expect(v(null).movements).toHaveLength(1)
  })

  it('leaves a ghost on the placement hex of a unit that only attacked', () => {
    const fallen = { u: { 0: A }, v: { 1: null } }
    const hit = attackEntry('v', 'u')
    const route = { waypoints: { v: { 1: [D] } }, moveOrder: { 1: ['v', hit, 'v'] } }
    const v = deriveBoardView(defs, fallen, 1, board, route).tokens.find((t) => t.id === 'v')
    expect(v).toMatchObject({ pos: D, ghost: true, attacked: true })
  })

  it('has no action on later turns', () => {
    expect(phaseStepOrder(defs, { v: { 1: D } }, 2, board, {})).toEqual([])
  })

  it('does not count deployment placements', () => {
    expect(phaseStepOrder(defs, { v: { 0: D } }, 0, board, {})).toEqual([])
  })

  it('drops an attack on a unit not yet placed', () => {
    const hit = attackEntry('u', 'v')
    expect(phaseStepOrder(defs, positions, 1, board, { moveOrder: { 1: [hit, 'u', 'v'] } })).toEqual(['u', 'v'])
    expect(phaseStepOrder(defs, positions, 1, board, { moveOrder: { 1: ['v', hit, 'u'] } })).toEqual(['v', hit, 'u'])
  })
})
