import { beforeEach, describe, expect, it } from 'vitest'
import { attackEntry, editRouteStep, insertRouteStep, paintAtTurn, parseHazard, posAtTurn, roundsLeftAt, usePlanStore } from './planStore'

describe('editRouteStep', () => {
  const A = { q: 0, r: 0 }
  const B = { q: 1, r: 0 }
  const C = { q: 2, r: 0 }
  const D = { q: 3, r: 0 }

  it('moves a middle stop', () => {
    expect(editRouteStep(A, [B], C, 0, D)).toEqual({ stops: [D], end: C, removedLegs: [] })
  })

  it('cancels a step moved back to its origin', () => {
    expect(editRouteStep(A, [B], C, 0, A)).toEqual({ stops: [], end: C, removedLegs: [0] })
  })

  it('removes the next step when the edit leaves it no distance', () => {
    expect(editRouteStep(A, [B], C, 0, C)).toEqual({ stops: [], end: C, removedLegs: [1] })
  })

  it('cancels a whole return trip', () => {
    expect(editRouteStep(A, [B], A, 0, A)).toEqual({ stops: [], end: null, removedLegs: [0, 1] })
  })

  it('edits routes with no starting hex (placed this turn)', () => {
    expect(editRouteStep(null, [A, B], C, 0, D)).toEqual({ stops: [A, D], end: C, removedLegs: [] })
  })

  it('drops rotation from an edited stop', () => {
    expect(editRouteStep(A, [B], C, 0, { ...D, rot: 90 } as typeof D).stops).toEqual([D])
  })
})

describe('insertRouteStep', () => {
  const A = { q: 0, r: 0 }
  const B = { q: 1, r: 0 }
  const C = { q: 2, r: 0 }

  it('adds a stop ahead of the existing route', () => {
    expect(insertRouteStep(A, [], B, C)).toEqual({ stops: [C], end: B, removedLegs: [] })
  })

  it('replaces the first step when moving onto its hex', () => {
    expect(insertRouteStep(A, [B], C, B)).toEqual({ stops: [B], end: C, removedLegs: [0] })
  })

  it('handles a unit placed this turn', () => {
    expect(insertRouteStep(null, [A], B, C)).toEqual({ stops: [A, C], end: B, removedLegs: [] })
  })
})

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
      waypoints: {},
      moveOrder: {},
      paint: {},
      instances: {},
      instanceSeq: 0,
      history: [],
      seededBoard: null,
      primesDefeated: 2,
    }),
  )
  const store = () => usePlanStore.getState()

  describe('multi-step moves', () => {
    const A = { q: 0, r: 0 }
    const B = { q: 1, r: 0 }
    const C = { q: 2, r: 0 }
    const D = { q: 3, r: 0 }
    const stops = () => store().waypoints.u?.[1] ?? []
    const end = () => store().positions.u?.[1]
    const move = (hex: { q: number; r: number }, addStep = false) => store().moveToken('u', hex, A, addStep)

    beforeEach(() => {
      usePlanStore.setState({ currentTurn: 1, positions: { u: { 0: A } } })
    })

    it('records A→B→C→A, including a step back to the start', () => {
      move(B)
      move(C, true)
      move(A, true)
      expect(stops()).toEqual([B, C])
      expect(end()).toEqual(A)
    })

    it('a move without + corrects the current step', () => {
      move(B)
      move(C, true)
      move(D)
      expect(stops()).toEqual([B])
      expect(end()).toEqual(D)
    })

    it('moving back without + cancels steps one at a time', () => {
      move(B)
      move(C, true)
      move(B)
      expect(stops()).toEqual([])
      expect(end()).toEqual(B)
      move(A)
      expect(end()).toBeUndefined()
      expect(posAtTurn(store().positions.u, 1)).toEqual(A)
    })

    it('a return trip can still be cancelled by moving back without +', () => {
      move(B)
      move(A, true)
      move(B)
      expect(stops()).toEqual([])
      expect(end()).toEqual(B)
    })

    it('cancelling keeps a rotation made this phase', () => {
      usePlanStore.setState({ positions: { u: { 0: { ...A, rot: 0 }, 1: { ...B, rot: 90 } } } })
      store().moveToken('u', { ...A, rot: 90 }, A, false)
      expect(end()).toEqual({ ...A, rot: 90 })
    })

    it('cancelling a step keeps the current rotation, not the stop\'s', () => {
      store().moveToken('u', { ...B, rot: 0 }, A, false)
      store().moveToken('u', { ...C, rot: 0 }, A, true)
      usePlanStore.setState({
        positions: { u: { ...store().positions.u, 1: { ...C, rot: 90 } } },
      })
      store().moveToken('u', { ...B, rot: 90 }, A, false)
      expect(end()).toEqual({ ...B, rot: 90 })
    })

    it('only keeps the steps of the phase they were made on', () => {
      move(B)
      move(C, true)
      usePlanStore.setState({ currentTurn: 2 })
      store().moveToken('u', D, C, false)
      expect(store().waypoints.u[1]).toEqual([B])
      expect(store().waypoints.u[2]).toBeUndefined()
    })

    it('logs one entry per step, in the order made', () => {
      move(B)
      store().moveToken('v', C, D, false)
      move(C, true)
      expect(store().moveOrder[1]).toEqual(['u', 'v', 'u'])
    })

    it('corrections keep the log and cancelling removes the step', () => {
      move(B)
      move(C, true)
      move(D)
      expect(store().moveOrder[1]).toEqual(['u', 'u'])
      move(B)
      expect(store().moveOrder[1]).toEqual(['u'])
      move(A)
      expect(store().moveOrder[1]).toEqual([])
    })

    it('removing a unit clears it from later turns', () => {
      usePlanStore.setState({ moveOrder: { 1: [], 2: ['u', 'v'] } })
      store().removeFromTurn('u')
      expect(store().moveOrder[2]).toEqual(['v'])
    })

    describe('editing during a replay', () => {
      const V = { q: 7, r: 7 }
      // u: A→B→C, v moves in between.
      beforeEach(() => {
        move(B)
        store().moveToken('v', C, V, false)
        move(C, true)
      })
      const replay = (step: number, shown: number) => ({ order: store().moveOrder[1], step, shown })

      it('changes the step on screen and keeps the later ones', () => {
        const step = store().moveToken('u', D, A, false, replay(1, 1))
        expect(stops()).toEqual([D])
        expect(end()).toEqual(C)
        expect(step).toBe(1)
        expect(store().moveOrder[1]).toEqual(['u', 'v', 'u'])
      })

      it('cancels the step when moved back to where it began', () => {
        const step = store().moveToken('u', A, A, false, replay(2, 1))
        expect(stops()).toEqual([])
        expect(end()).toEqual(C)
        expect(store().moveOrder[1]).toEqual(['v', 'u'])
        expect(step).toBe(1)
      })

      it('merges a step edited onto the next stop', () => {
        store().moveToken('u', C, A, false, replay(1, 1))
        expect(stops()).toEqual([])
        expect(end()).toEqual(C)
        expect(store().moveOrder[1]).toEqual(['u', 'v'])
      })

      it('gives a unit that has not acted a move at this point', () => {
        const step = store().moveToken('w', D, V, false, { order: store().moveOrder[1], step: 1, shown: 0 })
        expect(store().positions.w[1]).toEqual(D)
        expect(store().moveOrder[1]).toEqual(['u', 'w', 'v', 'u'])
        expect(step).toBe(2)
      })

      it('inserts ahead of a unit\'s later steps, which carry on from the new hex', () => {
        usePlanStore.setState({ moveOrder: { 1: ['v', 'u', 'u'] } })
        const step = store().moveToken('u', D, A, false, replay(1, 0))
        expect(stops()).toEqual([D, B])
        expect(end()).toEqual(C)
        expect(store().moveOrder[1]).toEqual(['v', 'u', 'u', 'u'])
        expect(step).toBe(2)
      })

      it('moving onto the next stop makes that step happen now', () => {
        usePlanStore.setState({ moveOrder: { 1: ['v', 'u', 'u'] } })
        const step = store().moveToken('u', B, A, false, replay(1, 0))
        expect(stops()).toEqual([B])
        expect(end()).toEqual(C)
        expect(store().moveOrder[1]).toEqual(['v', 'u', 'u'])
        expect(step).toBe(2)
      })

      it('adds on a final step, placing it after the shown moves', () => {
        const step = store().moveToken('v', D, V, true, replay(2, 1))
        expect(store().waypoints.v[1]).toEqual([C])
        expect(store().moveOrder[1]).toEqual(['u', 'v', 'v', 'u'])
        expect(step).toBe(3)
      })

      it('returns to the whole turn when no moves remain beyond the screen', () => {
        expect(store().moveToken('u', D, A, false, replay(3, 2))).toBeNull()
        expect(end()).toEqual(D)
      })
    })

    it('undo restores the previous route', () => {
      move(B)
      store().checkpoint()
      move(C, true)
      store().undo()
      expect(stops()).toEqual([])
      expect(end()).toEqual(B)
    })

    describe('placing after deployment', () => {
      const place = (id: string, hex: { q: number; r: number }, replay?: Parameters<ReturnType<typeof store>['moveToken']>[4]) =>
        store().moveToken(id, hex, null, false, replay)

      it('records the placement as an action', () => {
        move(B)
        place('w', C)
        expect(store().moveOrder[1]).toEqual(['u', 'w'])
        expect(store().positions.w[1]).toEqual(C)
      })

      it('does not record placements during deployment', () => {
        usePlanStore.setState({ currentTurn: 0 })
        place('w', C)
        expect(store().moveOrder[0] ?? []).toEqual([])
      })

      it('correcting a placement keeps one entry', () => {
        place('w', C)
        place('w', D)
        expect(store().moveOrder[1]).toEqual(['w'])
        expect(store().positions.w[1]).toEqual(D)
      })

      it('counts the placement before the unit\'s steps', () => {
        place('w', C)
        store().moveToken('w', D, null, true)
        expect(store().waypoints.w[1]).toEqual([C])
        expect(store().moveOrder[1]).toEqual(['w', 'w'])
      })

      it('cancelling a step keeps the placement', () => {
        place('w', C)
        store().moveToken('w', D, null, true)
        store().moveToken('w', C, null, false)
        expect(store().moveOrder[1]).toEqual(['w'])
        expect(store().positions.w[1]).toEqual(C)
      })

      it('inserts at the replay position', () => {
        move(B)
        store().moveToken('v', C, D, false)
        const step = place('w', A, { order: store().moveOrder[1], step: 1, shown: 0 })
        expect(store().moveOrder[1]).toEqual(['u', 'w', 'v'])
        expect(step).toBe(2)
      })

      it('moving a placement still to come makes it happen at this point', () => {
        move(B)
        store().moveToken('v', C, D, false)
        place('w', A)
        const step = place('w', D, { order: store().moveOrder[1], step: 1, shown: 0 })
        expect(store().moveOrder[1]).toEqual(['u', 'w', 'v'])
        expect(store().positions.w[1]).toEqual(D)
        expect(step).toBe(2)
      })

      it('moving a unit just placed in a replay re-places it, keeping its steps', () => {
        place('w', C)
        store().moveToken('w', D, null, true)
        const step = place('w', A, { order: store().moveOrder[1], step: 1, shown: 1 })
        expect(store().waypoints.w[1]).toEqual([A])
        expect(store().positions.w[1]).toEqual(D)
        expect(store().moveOrder[1]).toEqual(['w', 'w'])
        expect(step).toBe(1)
      })

      it('editing a step of a unit placed this turn targets that step', () => {
        place('w', A)
        store().moveToken('w', B, null, true)
        store().moveToken('w', C, null, true)
        store().moveToken('w', D, null, false, { order: store().moveOrder[1], step: 2, shown: 2 })
        expect(store().waypoints.w[1]).toEqual([A, D])
        expect(store().positions.w[1]).toEqual(C)
      })

      it('removing a unit with no earlier presence removes its placement too', () => {
        place('w', C)
        store().removeFromTurn('w')
        expect(store().positions.w).toBeUndefined()
        expect(store().moveOrder[1]).toEqual([])
      })
    })

    describe('attacks', () => {
      const hit = attackEntry('u', 'v')

      it('adds an attack after all the actions on the whole turn', () => {
        move(B)
        const step = store().toggleAttack('u', 'v', store().moveOrder[1], null)
        expect(store().moveOrder[1]).toEqual(['u', hit])
        expect(step).toBeNull()
      })

      it('inserts at the replay position and advances the replay', () => {
        const step = store().toggleAttack('u', 'v', ['u', 'w'], 1)
        expect(store().moveOrder[1]).toEqual(['u', hit, 'w'])
        expect(step).toBe(2)
      })

      it('takes the attack back when repeated', () => {
        store().toggleAttack('u', 'v', ['u'], null)
        store().toggleAttack('u', 'v', store().moveOrder[1], null)
        expect(store().moveOrder[1]).toEqual(['u'])
      })

      it('does not touch an attack beyond the replay position', () => {
        const step = store().toggleAttack('u', 'v', ['w', 'u', hit], 1)
        expect(store().moveOrder[1]).toEqual(['w', hit, 'u', hit])
        expect(step).toBe(2)
      })

      it('leaves the unit where it is', () => {
        move(B)
        store().toggleAttack('u', 'v', store().moveOrder[1], null)
        expect(end()).toEqual(B)
        expect(stops()).toEqual([])
      })

      it('survives moves, which only count the unit\'s own entries', () => {
        move(B)
        store().toggleAttack('u', 'v', store().moveOrder[1], null)
        move(C, true)
        expect(store().moveOrder[1]).toEqual(['u', hit, 'u'])
        move(B)
        expect(store().moveOrder[1]).toEqual(['u', hit])
      })

      it('undo takes an attack back', () => {
        store().checkpoint()
        store().toggleAttack('u', 'v', [], null)
        store().undo()
        expect(store().moveOrder[1] ?? []).toEqual([])
      })
    })

    describe('removing as an action', () => {
      it('keeps the moves made before the removal', () => {
        move(B)
        move(C, true)
        store().removeFromTurn('u')
        expect(store().positions.u[1]).toBeNull()
        expect(stops()).toEqual([B, C])
        expect(store().moveOrder[1]).toEqual(['u', 'u', 'u'])
      })

      it('records a removal with no moves', () => {
        store().moveToken('v', C, D, false)
        store().removeFromTurn('u')
        expect(stops()).toEqual([])
        expect(store().moveOrder[1]).toEqual(['v', 'u'])
      })

      it('drops later moves when removed mid-replay', () => {
        move(B)
        store().moveToken('v', C, D, false)
        move(C, true)
        const step = store().removeFromTurn('u', { order: store().moveOrder[1], step: 2, shown: 1 })
        expect(stops()).toEqual([B])
        expect(store().moveOrder[1]).toEqual(['u', 'v', 'u'])
        expect(step).toBeNull() // the removal is now the last action
      })

      it('inserts the removal at the replay position and stays in the replay', () => {
        store().moveToken('v', C, D, false)
        store().moveToken('w', B, A, false)
        const step = store().removeFromTurn('u', { order: store().moveOrder[1], step: 1, shown: 0 })
        expect(store().moveOrder[1]).toEqual(['v', 'u', 'w'])
        expect(step).toBe(2)
      })

      it('still drops a unit with no earlier presence entirely', () => {
        usePlanStore.setState({ positions: { u: { 1: B } }, moveOrder: { 1: ['v'] } })
        store().removeFromTurn('u')
        expect(store().positions.u).toBeUndefined()
        expect(store().moveOrder[1]).toEqual(['v'])
      })

      it('undo brings the unit and its route back', () => {
        move(B)
        store().checkpoint()
        store().removeFromTurn('u')
        store().undo()
        expect(end()).toEqual(B)
        expect(store().moveOrder[1]).toEqual(['u'])
      })

      it('editing an earlier step keeps the removal', () => {
        move(B)
        move(C, true)
        store().removeFromTurn('u')
        store().moveToken('u', D, A, false, { order: store().moveOrder[1], step: 1, shown: 1 })
        expect(stops()).toEqual([D, C])
        expect(store().positions.u[1]).toBeNull()
        expect(store().moveOrder[1]).toEqual(['u', 'u', 'u'])
      })

      it('correcting the last step before the removal keeps the removal', () => {
        move(B)
        store().removeFromTurn('u')
        store().moveToken('u', C, A, false, { order: store().moveOrder[1], step: 1, shown: 1 })
        expect(stops()).toEqual([C])
        expect(store().positions.u[1]).toBeNull()
      })

      it('adds a step before a removal that is still to come', () => {
        move(B)
        store().removeFromTurn('u')
        const step = store().moveToken('u', C, A, true, { order: store().moveOrder[1], step: 1, shown: 1 })
        expect(stops()).toEqual([B, C])
        expect(store().positions.u[1]).toBeNull()
        expect(store().moveOrder[1]).toEqual(['u', 'u', 'u'])
        expect(step).toBe(2)
      })

      it('restores a unit with its route', () => {
        move(B)
        move(C, true)
        store().removeFromTurn('u')
        store().restoreToken('u')
        expect(stops()).toEqual([B])
        expect(end()).toEqual(C)
        expect(store().moveOrder[1]).toEqual(['u', 'u'])
      })

      it('restores a unit that never moved to where it was', () => {
        store().removeFromTurn('u')
        store().restoreToken('u')
        expect(end()).toBeUndefined()
        expect(posAtTurn(store().positions.u, 1)).toEqual(A)
        expect(store().moveOrder[1]).toEqual([])
      })

      it('restoring during a replay takes only the removal out of the order', () => {
        move(B)
        store().moveToken('v', C, D, false)
        store().removeFromTurn('u')
        const step = store().restoreToken('u', { order: ['u', 'u', 'v'], step: 2, shown: 2 })
        expect(store().moveOrder[1]).toEqual(['u', 'v'])
        expect(step).toBe(1)
      })

      it('restoring keeps the rotation it had', () => {
        usePlanStore.setState({ positions: { u: { 0: { ...A, rot: 90 }, 1: null } }, waypoints: { u: { 1: [B] } } })
        store().restoreToken('u')
        expect(end()).toEqual({ ...B, rot: 90 })
      })
    })

    it('loading an older plan does not inherit the previous steps', () => {
      move(B)
      move(C, true)
      store().loadPlan(
        {
          bossUnitId: 'b',
          targetKind: 'boss',
          boardId: 'GB_01',
          team: [],
          machineOfWar: null,
          currentTurn: 0,
          positions: {},
          paint: {},
          instances: {},
          instanceSeq: 0,
          seededBoard: null,
          primesDefeated: 0,
        },
        null,
      )
      expect(store().waypoints).toEqual({})
    })
  })

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

  describe('hazard re-stamping', () => {
    it('reapplying a hazard refreshes its full lifespan from the new phase', () => {
      store().setCurrentTurn(1)
      store().setPaint('0,0', 'fire@2')
      store().setCurrentTurn(3) // showing fire@1 here…
      store().setPaint('0,0', 'fire@2') // …reapplied: a fresh tile, 2 rounds again
      const paint = usePlanStore.getState().paint
      expect(paintAtTurn(paint, 3)).toEqual({ '0,0': 'fire@2' })
      expect(paintAtTurn(paint, 5)).toEqual({ '0,0': 'fire@1' })
      expect(paintAtTurn(paint, 7)).toEqual({})
    })

    it('the rubber (setPaint null) erases a live hazard from this phase on', () => {
      store().setCurrentTurn(1)
      store().setPaint('0,0', 'fire@2')
      store().setCurrentTurn(2)
      store().setPaint('0,0', null)
      const paint = usePlanStore.getState().paint
      expect(paintAtTurn(paint, 2)).toEqual({})
      expect(paintAtTurn(paint, 1)).toEqual({ '0,0': 'fire@2' })
    })
  })

  describe('applyTeam', () => {
    it('replaces squad + MoW, normalised to 5 slots, without touching the plan', () => {
      store().placeToken('tok', { q: 1, r: 1 })
      store().setCloudRef({ id: 'doc1', name: 'Alpha' })
      store().applyTeam(['a', 'b', 'c'], 'mowX')
      expect(store().team).toEqual(['a', 'b', 'c', null, null])
      expect(store().machineOfWar).toBe('mowX')
      expect(store().positions['tok']).toBeDefined()
      expect(store().cloudRef).toEqual({ id: 'doc1', name: 'Alpha' })
    })

    it('truncates oversized member lists and clears the MoW when null', () => {
      store().applyTeam(['a', 'b', 'c', 'd', 'e', 'f', 'g'], null)
      expect(store().team).toEqual(['a', 'b', 'c', 'd', 'e'])
      expect(store().machineOfWar).toBeNull()
    })
  })

  describe('cloud plan load / linkage', () => {
    const cloudData = {
      bossUnitId: 'bossX',
      targetKind: 'prime' as const,
      boardId: 'GB_07',
      team: ['charA', null, null, null, null],
      machineOfWar: null,
      currentTurn: 4,
      positions: { charA: { 0: { q: 1, r: 1 } } },
      paint: { 1: { '0,0': 'teal' } },
      instances: { 'inst-1': { unitId: 'orkBoy', side: 'enemy' as const } },
      instanceSeq: 1,
      seededBoard: 'GB_07',
      primesDefeated: 0,
    }

    it('loadPlan replaces the whole plan, clears history and links the doc', () => {
      store().placeToken('old', { q: 9, r: 9 })
      store().checkpoint()
      store().loadPlan(cloudData, { id: 'doc1', name: 'Alpha' })
      expect(store().bossUnitId).toBe('bossX')
      expect(store().targetKind).toBe('prime')
      expect(store().boardId).toBe('GB_07')
      expect(store().positions).toEqual(cloudData.positions)
      expect(store().history).toHaveLength(0)
      expect(store().cloudRef).toEqual({ id: 'doc1', name: 'Alpha' })
      // seededBoard came with the payload — deployment must not re-seed.
      expect(store().seededBoard).toBe('GB_07')
    })

    it('loadPlan opens on deployment regardless of the saved turn', () => {
      store().setCurrentTurn(7)
      store().loadPlan(cloudData, { id: 'doc1', name: 'Alpha' })
      expect(store().currentTurn).toBe(0)
    })

    it('changing the target or map unlinks the cloud doc', () => {
      store().loadPlan(cloudData, { id: 'doc1', name: 'Alpha' })
      store().selectBoard('GB_99')
      expect(store().cloudRef).toBeNull()

      store().setCloudRef({ id: 'doc2', name: 'Beta' })
      store().selectBoss('someBoss')
      expect(store().cloudRef).toBeNull()
    })

    it('resetPlan (board exit) unlinks the cloud doc', () => {
      store().loadPlan(cloudData, { id: 'doc1', name: 'Alpha' })
      store().resetPlan()
      expect(store().cloudRef).toBeNull()
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
