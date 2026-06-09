import { describe, expect, it } from 'vitest'
import { paintAtTurn } from './planStore'

describe('paintAtTurn', () => {
  it('shows paint on the phase it was made', () => {
    const paint = { 1: { '0,0': 'teal' } }
    expect(paintAtTurn(paint, 1)).toEqual({ '0,0': 'teal' })
  })

  it('persists paint into the immediately following phase', () => {
    // Painted on turn 1 (phase 1) → still visible on turn 1E (phase 2).
    const paint = { 1: { '0,0': 'teal' } }
    expect(paintAtTurn(paint, 2)).toEqual({ '0,0': 'teal' })
  })

  it('auto-clears paint two phases later', () => {
    // Painted on turn 1 (phase 1) → gone by turn 2 (phase 3).
    const paint = { 1: { '0,0': 'teal' } }
    expect(paintAtTurn(paint, 3)).toEqual({})
  })

  it('persists enemy-phase paint through the next player phase', () => {
    // Painted on turn 2E (phase 4) → visible on turn 3 (phase 5), gone on 3E (phase 6).
    const paint = { 4: { '1,1': 'red' } }
    expect(paintAtTurn(paint, 5)).toEqual({ '1,1': 'red' })
    expect(paintAtTurn(paint, 6)).toEqual({})
  })

  it('lets the current phase override an inherited colour', () => {
    const paint = { 1: { '0,0': 'teal' }, 2: { '0,0': 'red' } }
    expect(paintAtTurn(paint, 2)).toEqual({ '0,0': 'red' })
  })

  it('masks an inherited hex with a null erase marker', () => {
    const paint = { 1: { '0,0': 'teal' }, 2: { '0,0': null } }
    expect(paintAtTurn(paint, 2)).toEqual({})
    // …without rewriting history: turn 1 still shows it.
    expect(paintAtTurn(paint, 1)).toEqual({ '0,0': 'teal' })
  })

  it('ignores null markers from the previous phase', () => {
    const paint = { 1: { '0,0': null }, 2: { '1,1': 'teal' } }
    expect(paintAtTurn(paint, 2)).toEqual({ '1,1': 'teal' })
  })

  it('returns empty for undefined input', () => {
    expect(paintAtTurn(undefined, 3)).toEqual({})
  })
})
