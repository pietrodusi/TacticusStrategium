import { describe, expect, it } from 'vitest'
import { PLAN_SCHEMA_VERSION, deserializePlan, serializePlan, type PlanData } from './serialize'

const samplePlan = (): PlanData => ({
  bossUnitId: 'GuildBoss1Boss1TyranTervigonLeviathan',
  targetKind: 'boss',
  boardId: 'GB_01',
  team: ['ultraTigurius', 'bloodKharn', null, null, null],
  machineOfWar: null,
  currentTurn: 3,
  positions: {
    ultraTigurius: { 0: { q: 1, r: 2 }, 3: { q: 2, r: 2 } },
    'inst-1': { 1: { q: 4, r: 4 }, 2: null }, // removed-from-here-on marker
    boss: { 0: { q: 5, r: 5, rot: 90 } },
  },
  paint: { 1: { '3,-2': 'rgba(207,70,50,0.5)', '4,-2': null }, 2: { '0,0': 'fire@2' } },
  instances: {
    'inst-1': { unitId: 'tyranTermagant', side: 'enemy', removeAtPrime: 1 },
    'inst-2': { unitId: 'galatianSquad', side: 'ally' },
  },
  instanceSeq: 2,
  seededBoard: 'GB_01',
  primesDefeated: 2,
})

describe('serializePlan / deserializePlan', () => {
  it('round-trips a populated plan', () => {
    const plan = samplePlan()
    const restored = deserializePlan(serializePlan(plan), PLAN_SCHEMA_VERSION)
    expect(restored).toEqual(plan)
  })

  it('only serializes the plan payload fields', () => {
    // Extra store fields (actions, history, cloudRef…) must not leak into the payload.
    const polluted = { ...samplePlan(), history: [{}], cloudRef: { id: 'x' }, undo: () => {} }
    const parsed = JSON.parse(serializePlan(polluted as unknown as PlanData))
    expect(parsed.history).toBeUndefined()
    expect(parsed.cloudRef).toBeUndefined()
    expect(parsed.undo).toBeUndefined()
  })

  it('drops undefined leaves (absent rot) instead of writing them', () => {
    const plan = samplePlan()
    plan.positions.ultraTigurius[0] = { q: 1, r: 2, rot: undefined }
    const restored = deserializePlan(serializePlan(plan), PLAN_SCHEMA_VERSION)
    expect(restored?.positions.ultraTigurius[0]).toEqual({ q: 1, r: 2 })
  })

  it('rejects an unknown schema version', () => {
    const raw = serializePlan(samplePlan())
    expect(deserializePlan(raw, PLAN_SCHEMA_VERSION + 1)).toBeNull()
  })

  it('rejects malformed JSON and wrong shapes', () => {
    expect(deserializePlan('not json{', PLAN_SCHEMA_VERSION)).toBeNull()
    expect(deserializePlan('"a string"', PLAN_SCHEMA_VERSION)).toBeNull()
    expect(deserializePlan('{}', PLAN_SCHEMA_VERSION)).toBeNull()
    const missingBoard = JSON.parse(serializePlan(samplePlan())) as Record<string, unknown>
    delete missingBoard.boardId
    expect(deserializePlan(JSON.stringify(missingBoard), PLAN_SCHEMA_VERSION)).toBeNull()
    const badTeam = { ...samplePlan(), team: ['a', 2, null] }
    expect(deserializePlan(JSON.stringify(badTeam), PLAN_SCHEMA_VERSION)).toBeNull()
  })
})
