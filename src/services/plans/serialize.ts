import type { TokenPos } from '../../stores/planStore'

/** Cloud payload format version (the `schemaVersion` field on plan docs).
 *  Bump together with a `deserializePlan` migration whenever the persisted
 *  plan shape changes (see also the planStore persist version). */
export const PLAN_SCHEMA_VERSION = 1

/** Everything the planStore persists except undo history and cloudRef —
 *  the self-contained payload stored as a JSON string on the plan doc. */
export interface PlanData {
  bossUnitId: string
  targetKind: 'boss' | 'prime'
  boardId: string
  team: (string | null)[]
  machineOfWar: string | null
  currentTurn: number
  positions: Record<string, Record<number, TokenPos | null>>
  paint: Record<number, Record<string, string | null>>
  instances: Record<string, { unitId: string; side: 'ally' | 'enemy'; removeAtPrime?: number | null }>
  instanceSeq: number
  seededBoard: string | null
  primesDefeated: number
}

const PLAN_KEYS: (keyof PlanData)[] = [
  'bossUnitId', 'targetKind', 'boardId', 'team', 'machineOfWar', 'currentTurn',
  'positions', 'paint', 'instances', 'instanceSeq', 'seededBoard', 'primesDefeated',
]

/** Serialize the plan slice of a (store) state to the cloud JSON payload.
 *  JSON.stringify drops `undefined` leaves (e.g. an absent boss `rot`). */
export function serializePlan(s: PlanData): string {
  const picked: Record<string, unknown> = {}
  for (const k of PLAN_KEYS) picked[k] = s[k]
  return JSON.stringify(picked)
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Parse + validate a cloud payload. Returns null when the payload was written
 * by a newer app version (unknown schemaVersion) or doesn't hold together —
 * callers surface that as "can't load this plan", never a broken board.
 */
export function deserializePlan(raw: string, schemaVersion: number): PlanData | null {
  if (schemaVersion !== PLAN_SCHEMA_VERSION) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  const p = parsed
  const valid =
    typeof p.bossUnitId === 'string' &&
    (p.targetKind === 'boss' || p.targetKind === 'prime') &&
    typeof p.boardId === 'string' &&
    Array.isArray(p.team) && p.team.every((t) => t === null || typeof t === 'string') &&
    (p.machineOfWar === null || typeof p.machineOfWar === 'string') &&
    typeof p.currentTurn === 'number' &&
    isRecord(p.positions) &&
    isRecord(p.paint) &&
    isRecord(p.instances) &&
    typeof p.instanceSeq === 'number' &&
    (p.seededBoard === null || typeof p.seededBoard === 'string') &&
    typeof p.primesDefeated === 'number'
  return valid ? (p as unknown as PlanData) : null
}
