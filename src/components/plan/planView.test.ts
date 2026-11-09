import { describe, expect, it } from 'vitest'
import { deriveBoardView, type TokenDef } from './planView'
import type { ParsedBoard } from '../../services/boards/boardService'

const board = { bossStart: { q: 9, r: 9 }, bossRotation: 0 } as unknown as ParsedBoard
const unit: TokenDef = { id: 'u', type: 'character', stem: null, name: 'U', size: 1 }
const boss: TokenDef = { id: 'b', type: 'boss', stem: null, name: 'B', size: 3 }
const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }
const C = { q: 2, r: 0 }

const legs = (positions: Parameters<typeof deriveBoardView>[1], waypoints = {}, defs = [unit]) =>
  deriveBoardView(defs, positions, 1, board, waypoints).movements

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
