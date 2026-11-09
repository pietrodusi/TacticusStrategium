import { describe, expect, it } from 'vitest'
import { deriveBoardView, phaseStepOrder, stepCursor, type TokenDef } from './planView'
import { MAX_PHASE } from '../../stores/planStore'
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

  it('keeps the unit on the board until its removal is played', () => {
    expect(u(1)?.pos).toMatchObject(B)
    expect(u(2)?.pos).toMatchObject(B)
    expect(u(null)).toBeUndefined()
  })

  it('shows the route of a removed unit, with no token at its end', () => {
    expect(view(null).movements.filter((m) => m.to.q === B.q && m.to.r === B.r)).toMatchObject([
      { from: A, to: B, endsAtToken: false },
    ])
  })

  it('shows a unit removed without moving at its start until the removal', () => {
    const still = { u: { 0: A, 1: null } }
    const order = { moveOrder: { 1: ['u'] } }
    expect(phaseStepOrder([unit], still, 1, board, order)).toEqual(['u'])
    expect(deriveBoardView([unit], still, 1, board, { ...order, step: 0 }).tokens[0].pos).toMatchObject(A)
    expect(deriveBoardView([unit], still, 1, board, order).tokens).toEqual([])
  })

  it('treats a removal from an older plan as the last action of that unit', () => {
    expect(phaseStepOrder(defs, positions, 1, board, { waypoints: data.waypoints })).toEqual(['u', 'u', 'v'])
  })

  it('ignores a unit that was already gone', () => {
    expect(phaseStepOrder([unit], { u: { 0: null, 1: null } }, 1, board, {})).toEqual([])
  })
})
