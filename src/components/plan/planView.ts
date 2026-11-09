// Pure derivation of what's on the board at a phase — token definitions,
// effective positions, movement arrows. Shared by the interactive BoardPage
// and the read-only shared-plan viewer (PlanBoardView).
import { MAX_PHASE, posAtTurn, type MoveOrder, type TokenPos, type WaypointMap } from '../../stores/planStore'
import { RING_COLOR, type TokenKind } from '../tokenColors'
import { bossDisplayName } from '../../utils/format'
import type { BossIndex, PrimeIndex, SpawnsData, Unit } from '../../types/units'
import type { ParsedBoard } from '../../services/boards/boardService'
import type { BoardMovement, BoardToken } from '../HexGrid'
import type { HexCoord } from '../../types/strategium'

/** A deployable token's identity (tray chip / board token, minus position). */
export interface TokenDef {
  id: string
  type: TokenKind
  stem: string | null
  name: string
  size: number
  removeAtPrime?: number | null // primes needed to remove this initial add (null = never)
}

export interface TargetDef {
  unitId: string
  name: string
  stem: string | null
  size: number
}

type PositionMap = Record<string, Record<number, TokenPos | null>>
type InstanceMap = Record<string, { unitId: string; side: 'ally' | 'enemy'; removeAtPrime?: number | null }>

/** The fight's primary unit (raid boss or prime), normalised to a token def. */
export function targetDef(
  bossUnitId: string | null,
  targetKind: 'boss' | 'prime',
  bosses: BossIndex | undefined,
  primes: PrimeIndex | undefined,
): TargetDef | null {
  if (!bossUnitId) return null
  if (targetKind === 'prime') {
    const p = primes?.primes.find((x) => x.unitId === bossUnitId)
    return p ? { unitId: p.unitId, name: p.name, stem: p.imageStem, size: p.size ?? 1 } : null
  }
  const b = bosses?.bosses.find((x) => x.unitId === bossUnitId)
  return b
    ? { unitId: b.unitId, name: bossDisplayName(b.bossType, b.name), stem: b.imageStem, size: b.bossSize }
    : null
}

/** Unique deployable tokens: the boss/prime + the squad (no Machine of War —
 *  it's a loadout pick whose summon appears in the Allies palette instead). */
export function uniqueTokenDefs(
  target: TargetDef | null,
  team: (string | null)[],
  unitById: Map<string, Unit>,
): TokenDef[] {
  const list: TokenDef[] = []
  if (target) list.push({ id: target.unitId, type: 'boss', stem: target.stem, name: target.name, size: target.size })
  for (const id of team) {
    if (!id) continue
    const u = unitById.get(id)
    if (u) list.push({ id: u.id, type: 'character', stem: u.stem, name: u.name, size: 1 })
  }
  return list
}

/** Spawn instances (summons / boss minions) as token defs. */
export function instanceTokenDefs(instances: InstanceMap, spawns: SpawnsData | undefined): TokenDef[] {
  return Object.entries(instances).map(([id, inst]) => {
    const u = spawns?.units[inst.unitId]
    return {
      id,
      type: (inst.side === 'ally' ? 'summon' : 'npc') as TokenKind,
      stem: u?.stem ?? null,
      name: u?.name ?? inst.unitId,
      size: u?.size ?? 1,
      removeAtPrime: inst.removeAtPrime,
    }
  })
}

/** Defs still on the field — an initial add is hidden once enough of the
 *  boss's primes are defeated (removeAtPrime ≤ primesDefeated). */
export const visibleTokenDefs = (defs: TokenDef[], primesDefeated: number): TokenDef[] =>
  defs.filter((d) => d.removeAtPrime == null || d.removeAtPrime > primesDefeated)

/** One arrow per leg of a route. Legs sharing a hex pair (A→B→A) are curved so
 *  each stays visible; direction alone puts a return trip on the opposite side. */
function routeLegs(points: HexCoord[], color: string): Omit<BoardMovement, 'endsAtToken'>[] {
  const pair = (a: HexCoord, b: HexCoord) => `${a.q},${a.r}>${b.q},${b.r}`
  const legs = points
    .slice(1)
    .map((to, i) => ({ from: points[i], to }))
    .filter((l) => pair(l.from, l.to) !== pair(l.to, l.from))
  const repeats = new Map<string, number>()
  return legs.map((leg) => {
    const forward = pair(leg.from, leg.to)
    const back = pair(leg.to, leg.from)
    const retraced = legs.some((o) => o !== leg && [forward, back].includes(pair(o.from, o.to)))
    const n = repeats.get(forward) ?? 0
    repeats.set(forward, n + 1)
    return { ...leg, color, curve: retraced ? n + 1 : 0 }
  })
}

interface RouteData {
  waypoints?: WaypointMap
  moveOrder?: MoveOrder
}

/** A token's final position at `phase` (null once removed), the legs that got it
 *  there, and whether it was removed this phase. `from` is where it began. The
 *  boss falls back to its board start hex until placed. */
function tokenRoute(d: TokenDef, positions: PositionMap, phase: number, board: ParsedBoard, data: RouteData) {
  const fallback =
    d.type === 'boss' ? { q: board.bossStart.q, r: board.bossStart.r, rot: board.bossRotation } : null
  const pos = posAtTurn(positions[d.id], phase) ?? fallback
  const prev = phase > 0 ? (posAtTurn(positions[d.id], phase - 1) ?? fallback) : null
  const stops = phase > 0 ? (data.waypoints?.[d.id]?.[phase] ?? []) : []
  const removedHere = phase > 0 && positions[d.id]?.[phase] === null && (!!prev || stops.length > 0)
  const points = [...(prev ? [prev] : []), ...stops, ...(pos && phase > 0 ? [pos] : [])]
  return {
    pos,
    from: prev,
    removedHere,
    legs: routeLegs(points.map(({ q, r }) => ({ q, r })), RING_COLOR[d.type]),
  }
}

/** One token id per action of `phase` (each step, then any removal), in replay
 *  order: the order they were made, then any unrecorded (older plans) unit by unit. */
export function phaseStepOrder(
  defs: TokenDef[],
  positions: PositionMap,
  phase: number,
  board: ParsedBoard,
  data: RouteData,
): string[] {
  const left = new Map(
    defs.map((d) => {
      const { legs, removedHere } = tokenRoute(d, positions, phase, board, data)
      return [d.id, legs.length + (removedHere ? 1 : 0)]
    }),
  )
  const order: string[] = []
  const take = (id: string) => {
    if (!left.get(id)) return false
    left.set(id, left.get(id)! - 1)
    order.push(id)
    return true
  }
  for (const id of data.moveOrder?.[phase] ?? []) take(id)
  for (const d of defs) while (take(d.id));
  return order
}

/** Effective tokens + movement arrows at `phase`; arrows chain prev-phase →
 *  stops → current. A `step` shows the turn after only that many moves. */
export function deriveBoardView(
  defs: TokenDef[],
  positions: PositionMap,
  phase: number,
  board: ParsedBoard,
  data: RouteData & { step?: number | null } = {},
): { tokens: BoardToken[]; movements: BoardMovement[] } {
  const replayed = data.step == null ? null : phaseStepOrder(defs, positions, phase, board, data).slice(0, data.step)
  const tokens: BoardToken[] = []
  const movements: BoardMovement[] = []
  for (const d of defs) {
    const { pos, from, legs, removedHere } = tokenRoute(d, positions, phase, board, data)
    const actions = replayed ? replayed.filter((id) => id === d.id).length : Infinity
    const shown = legs.slice(0, actions)
    const onBoard = removedHere ? actions <= legs.length : !!pos
    const base = pos ?? from
    if (onBoard && base) {
      // Mid-replay a token sits at the end of its last shown leg (or where it began).
      const at = replayed && (legs.length > 0 || removedHere) ? (shown[shown.length - 1]?.to ?? legs[0]?.from ?? base) : base
      tokens.push({ ...d, pos: { ...base, q: at.q, r: at.r }, removable: d.removeAtPrime != null })
    }
    movements.push(...shown.map((leg, i) => ({ ...leg, endsAtToken: onBoard && i === shown.length - 1 })))
  }
  return { tokens, movements }
}

/** Where the board is: a phase, and how many of its moves are shown (null = all). */
export interface ReplayCursor {
  phase: number
  step: number | null
}

/**
 * One move forward or back, crossing into the neighbouring turn at either end;
 * null when there's nowhere left to go. Every press changes something: going
 * forward lands on a turn's first move and going back on the previous turn's last.
 */
export function stepCursor(
  { phase, step }: ReplayCursor,
  dir: 1 | -1,
  stepCount: (phase: number) => number,
): ReplayCursor | null {
  const total = stepCount(phase)
  const shown = step ?? total
  if (dir === 1) {
    if (shown < total) return { phase, step: shown + 1 === total ? null : shown + 1 }
    if (phase >= MAX_PHASE) return null
    return { phase: phase + 1, step: stepCount(phase + 1) > 1 ? 1 : null }
  }
  if (shown > 1) return { phase, step: shown - 1 }
  return phase > 0 ? { phase: phase - 1, step: null } : null
}
