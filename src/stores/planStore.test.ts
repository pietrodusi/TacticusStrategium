import { beforeEach, describe, expect, it } from 'vitest'
import { paintAtTurn, parseHazard, posAtTurn, roundsLeftAt, usePlanStore } from './planStore'

describe('parseHazard', () => {
  it('parses kind@life values', () => {
    expect(parseHazard('fire@1')).toEqual({ kind: 'fire', life: 1 })
    expect(parseHazard('contaminated@2')).toEqual({ kind: 'contaminated', life: 2 })
  })

  it('defaults bare hazard kinds to the full life span', () => {
    expect(parseHazard('ice')).toEqual({ kind: 'ice', life: 2 })
  })

  it('returns null for colours', () => {
    expect(parseHazard('rgba(207,70,50,0.5)')).toBeNull()
  })
})

describe('roundsLeftAt', () => {
  it('counts down per turn, not per phase', () => {
    // S, 1, 1E, 2, 2E, 3, 3E, 4, 4E, 5, 5E, 6 (phases 0..11)
    const expected = [6, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1]
    expect(expected.map((_, phase) => roundsLeftAt(phase))).toEqual(expected)
  })
})

describe('posAtTurn', () => {
  it('returns the most recent entry at or before the turn (carry-forward)', () => {
    const byTurn = { 1: { q: 2, r: 3 } }
    expect(posAtTurn(byTurn, 1)).toEqual({ q: 2, r: 3 })
    expect(posAtTurn(byTurn, 5)).toEqual({ q: 2, r: 3 })
  })

  it('returns null before the first entry', () => {
    expect(posAtTurn({ 2: { q: 0, r: 0 } }, 1)).toBeNull()
  })

  it('treats a null entry as removed from that turn on', () => {
    const byTurn = { 0: { q: 1, r: 1 }, 3: null }
    expect(posAtTurn(byTurn, 2)).toEqual({ q: 1, r: 1 })
    expect(posAtTurn(byTurn, 3)).toBeNull()
    expect(posAtTurn(byTurn, 5)).toBeNull()
  })

  it('returns null for an unknown token', () => {
    expect(posAtTurn(undefined, 3)).toBeNull()
  })
})

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

  it('keeps a hazard alive for its life in rounds, counting down', () => {
    // Painted on turn 1 (phase 1) with 2 rounds: shows 2 through 1E, 1 through
    // 2E, gone on turn 3.
    const paint = { 1: { '0,0': 'fire@2' } }
    expect(paintAtTurn(paint, 1)).toEqual({ '0,0': 'fire@2' })
    expect(paintAtTurn(paint, 2)).toEqual({ '0,0': 'fire@2' })
    expect(paintAtTurn(paint, 3)).toEqual({ '0,0': 'fire@1' })
    expect(paintAtTurn(paint, 4)).toEqual({ '0,0': 'fire@1' })
    expect(paintAtTurn(paint, 5)).toEqual({})
  })

  it('lets a null mask erase a hazard placed phases earlier', () => {
    const paint = { 1: { '0,0': 'fire@2' }, 3: { '0,0': null } }
    expect(paintAtTurn(paint, 3)).toEqual({})
    expect(paintAtTurn(paint, 4)).toEqual({})
    expect(paintAtTurn(paint, 2)).toEqual({ '0,0': 'fire@2' })
  })
})

describe('plan actions', () => {
  beforeEach(() =>
    usePlanStore.setState({
      currentTurn: 0,
      positions: {},
      paint: {},
      instances: {},
      instanceSeq: 0,
      history: [],
      seededBoard: null,
      primesDefeated: 2,
    }),
  )
  const store = () => usePlanStore.getState()

  it('placeToken records the position at the current turn', () => {
    store().setCurrentTurn(3)
    store().placeToken('tok', { q: 1, r: 2 })
    expect(store().positions['tok']).toEqual({ 3: { q: 1, r: 2 } })
  })

  describe('removeFromTurn', () => {
    it('marks a token null from the current turn on, keeping earlier turns', () => {
      store().placeToken('tok', { q: 1, r: 1 }) // turn 0
      store().setCurrentTurn(2)
      store().placeToken('tok', { q: 2, r: 2 })
      store().setCurrentTurn(4)
      store().removeFromTurn('tok')

      const byTurn = store().positions['tok']
      expect(posAtTurn(byTurn, 3)).toEqual({ q: 2, r: 2 })
      expect(posAtTurn(byTurn, 4)).toBeNull()
      expect(byTurn[4]).toBeNull()
    })

    it('drops later placements when removing from an earlier turn', () => {
      store().placeToken('tok', { q: 1, r: 1 }) // turn 0
      store().setCurrentTurn(4)
      store().placeToken('tok', { q: 4, r: 4 })
      store().setCurrentTurn(2)
      store().removeFromTurn('tok')
      expect(posAtTurn(store().positions['tok'], 5)).toBeNull()
    })

    it('deletes a token (and its instance) with no earlier presence', () => {
      const id = store().addInstance('orkBoy', 'enemy')
      store().placeToken(id, { q: 0, r: 0 }) // placed on the current turn only
      store().removeFromTurn(id)
      expect(store().positions[id]).toBeUndefined()
      expect(store().instances[id]).toBeUndefined()
    })
  })

  describe('seedDeployment', () => {
    const enemies = [{ unitId: 'orkBoy', q: 1, r: 1, removeAtPrime: 1 }]

    it('creates turn-0 enemy instances with positions', () => {
      store().seedDeployment('GB_01', enemies)
      const inst = Object.entries(store().instances)
      expect(inst).toHaveLength(1)
      const [id, def] = inst[0]
      expect(def).toEqual({ unitId: 'orkBoy', side: 'enemy', removeAtPrime: 1 })
      expect(store().positions[id]).toEqual({ 0: { q: 1, r: 1 } })
    })

    it('is idempotent per board — a second seed of the same board is a no-op', () => {
      store().seedDeployment('GB_01', enemies)
      store().seedDeployment('GB_01', enemies)
      expect(Object.keys(store().instances)).toHaveLength(1)
      expect(store().seededBoard).toBe('GB_01')
    })
  })

  describe('checkpoint / undo', () => {
    it('undo restores the snapshot, including the phase it was taken on', () => {
      store().setCurrentTurn(2)
      store().checkpoint()
      store().placeToken('tok', { q: 1, r: 1 })
      store().setCurrentTurn(5)
      store().undo()
      expect(store().positions['tok']).toBeUndefined()
      expect(store().currentTurn).toBe(2)
      expect(store().history).toHaveLength(0)
    })

    it('one checkpoint covers a compound gesture (instance + placement)', () => {
      store().checkpoint()
      const id = store().addInstance('orkBoy', 'enemy')
      store().placeToken(id, { q: 0, r: 0 })
      store().undo()
      expect(store().instances[id]).toBeUndefined()
      expect(store().positions[id]).toBeUndefined()
      expect(store().instanceSeq).toBe(0)
    })

    it('undoes steps in reverse order', () => {
      store().checkpoint()
      store().placeToken('a', { q: 1, r: 1 })
      store().checkpoint()
      store().placeToken('b', { q: 2, r: 2 })
      store().undo()
      expect(store().positions['a']).toBeDefined()
      expect(store().positions['b']).toBeUndefined()
      store().undo()
      expect(store().positions['a']).toBeUndefined()
    })

    it('undo with no history is a no-op', () => {
      store().placeToken('tok', { q: 1, r: 1 })
      store().undo()
      expect(store().positions['tok']).toEqual({ 0: { q: 1, r: 1 } })
    })

    it('caps the history depth', () => {
      for (let i = 0; i < 40; i++) store().checkpoint()
      expect(store().history.length).toBe(30)
    })
  })

  describe('paintHazard', () => {
    const visible = () => paintAtTurn(usePlanStore.getState().paint, usePlanStore.getState().currentTurn)

    it('stamps a hazard at full life on an empty hex', () => {
      store().paintHazard('0,0', 'fire')
      expect(visible()).toEqual({ '0,0': 'fire@2' })
    })

    it('repainting the same hazard reduces its life, then erases at 0', () => {
      store().paintHazard('0,0', 'fire')
      store().paintHazard('0,0', 'fire')
      expect(visible()).toEqual({ '0,0': 'fire@1' })
      store().paintHazard('0,0', 'fire')
      expect(visible()).toEqual({})
    })

    it('a different hazard kind replaces at full life', () => {
      store().paintHazard('0,0', 'fire')
      store().paintHazard('0,0', 'ice')
      expect(visible()).toEqual({ '0,0': 'ice@2' })
    })

    it('decrementing an inherited hazard to 0 masks it without rewriting history', () => {
      store().setCurrentTurn(1)
      store().paintHazard('0,0', 'fire')
      store().setCurrentTurn(3) // fire@1 left here
      store().paintHazard('0,0', 'fire')
      expect(visible()).toEqual({})
      expect(paintAtTurn(usePlanStore.getState().paint, 1)).toEqual({ '0,0': 'fire@2' })
    })

    it('decrementing an inherited hazard re-anchors its remaining life', () => {
      store().setCurrentTurn(1)
      store().paintHazard('0,0', 'fire') // fire@2 from phase 1
      store().setCurrentTurn(2)
      store().paintHazard('0,0', 'fire') // showing 2 → drops to 1, anchored at phase 2
      expect(visible()).toEqual({ '0,0': 'fire@1' })
      expect(paintAtTurn(usePlanStore.getState().paint, 3)).toEqual({ '0,0': 'fire@1' })
      expect(paintAtTurn(usePlanStore.getState().paint, 4)).toEqual({})
    })
  })

  describe('setPaint erase semantics', () => {
    it('drops a hex painted on the current phase', () => {
      store().setCurrentTurn(2)
      store().setPaint('0,0', 'teal')
      store().setPaint('0,0', null)
      expect(store().paint[2]).toEqual({})
      expect(paintAtTurn(store().paint, 2)).toEqual({})
    })

    it('masks an inherited hex with a null marker, preserving the earlier phase', () => {
      store().setCurrentTurn(1)
      store().setPaint('0,0', 'teal')
      store().setCurrentTurn(2)
      store().setPaint('0,0', null)
      expect(store().paint[2]['0,0']).toBeNull()
      expect(paintAtTurn(store().paint, 2)).toEqual({})
      expect(paintAtTurn(store().paint, 1)).toEqual({ '0,0': 'teal' })
    })
  })
})
