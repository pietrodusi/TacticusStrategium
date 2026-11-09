// Pure derivation of what's on the board at a phase — token definitions,
// effective positions, movement arrows. Shared by the interactive BoardPage
// and the read-only shared-plan viewer (PlanBoardView).
import { MAX_PHASE, parseAttack, posAtTurn, type MoveOrder, type TokenPos, type WaypointMap } from '../../stores/planStore'
import { RING_COLOR, type TokenKind } from '../tokenColors'
import { bossDisplayName } from '../../utils/format'
import type { BossIndex, PrimeIndex, SpawnsData, Unit } from '../../types/units'
import type { ParsedBoard } from '../../services/boards/boardService'
import type { BoardMovement, BoardToken } from '../HexGrid'
import { getBossOccupiedHexes } from '../../services/hex/hexUtils'
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
  const legs = points.slice(1).map((to, i) => ({ from: points[i], to }))
  return withCurves(legs.filter((l) => l.from.q !== l.to.q || l.from.r !== l.to.r), color)
}

function withCurves(legs: { from: HexCoord; to: HexCoord }[], color: string): Omit<BoardMovement, 'endsAtToken'>[] {
  const pair = (a: HexCoord, b: HexCoord) => `${a.q},${a.r}>${b.q},${b.r}`
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

const ATTACK_COLOR = '#ef4444'

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
  const placedHere = phase > 0 && !prev && (positions[d.id]?.[phase] != null || stops.length > 0)
  const points = [...(prev ? [prev] : []), ...stops, ...(pos && phase > 0 ? [pos] : [])]
  return {
    pos,
    from: prev ?? stops[0] ?? null,
    removedHere,
    placed: placedHere ? 1 : 0,
    legs: routeLegs(points.map(({ q, r }) => ({ q, r })), RING_COLOR[d.type]),
  }
}

type TokenRoute = ReturnType<typeof tokenRoute>

const tokenRoutes = (defs: TokenDef[], positions: PositionMap, phase: number, board: ParsedBoard, data: RouteData) =>
  new Map(defs.map((d) => [d.id, tokenRoute(d, positions, phase, board, data)]))

/** Where a unit stands after `actions` of its actions; null once it's gone. */
function hexAfter(route: TokenRoute, actions: number): HexCoord | null {
  if (route.placed && actions === 0) return null
  const steps = actions - route.placed
  if (route.removedHere && steps > route.legs.length) return null
  return route.legs[Math.min(steps, route.legs.length) - 1]?.to ?? route.legs[0]?.from ?? route.pos ?? route.from
}

/** One entry per action of `phase` (placements, steps, removals, attacks), in replay order: the
 *  order they were made, then any unrecorded (older plans) unit by unit. */
export function phaseStepOrder(
  defs: TokenDef[],
  positions: PositionMap,
  phase: number,
  board: ParsedBoard,
  data: RouteData,
): string[] {
  const routes = tokenRoutes(defs, positions, phase, board, data)
  const left = new Map([...routes].map(([id, r]) => [id, r.placed + r.legs.length + (r.removedHere ? 1 : 0)]))
  const done = new Map<string, number>()
  const order: string[] = []
  const take = (id: string) => {
    if (!left.get(id)) return false
    left.set(id, left.get(id)! - 1)
    done.set(id, (done.get(id) ?? 0) + 1)
    order.push(id)
    return true
  }
  const onBoard = (id: string) => {
    const route = routes.get(id)
    return !!route && !!hexAfter(route, done.get(id) ?? 0)
  }
  for (const entry of data.moveOrder?.[phase] ?? []) {
    const attack = parseAttack(entry)
    if (!attack) take(entry)
    // An attack only happens if both units are still on the board at that point.
    else if (onBoard(attack.id) && onBoard(attack.target)) order.push(entry)
  }
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
  const routes = tokenRoutes(defs, positions, phase, board, data)
  const order = phaseStepOrder(defs, positions, phase, board, data)
  const replayed = data.step == null ? order : order.slice(0, data.step)

  // Walk the actions on screen: unit positions at each attack, and who has attacked.
  const counts = new Map<string, number>()
  const attackers = new Set<string>()
  const attackLegs: { from: HexCoord; to: HexCoord }[] = []
  for (const entry of replayed) {
    const attack = parseAttack(entry)
    if (!attack) {
      counts.set(entry, (counts.get(entry) ?? 0) + 1)
      continue
    }
    const from = hexAfter(routes.get(attack.id)!, counts.get(attack.id) ?? 0)
    const to = hexAfter(routes.get(attack.target)!, counts.get(attack.target) ?? 0)
    attackers.add(attack.id)
    if (from && to) attackLegs.push({ from: { q: from.q, r: from.r }, to: { q: to.q, r: to.r } })
  }

  const tokens: BoardToken[] = []
  const ghosts: BoardToken[] = []
  const movements: BoardMovement[] = []
  for (const d of defs) {
    const { pos, from, legs, removedHere, placed } = routes.get(d.id)!
    const actions = counts.get(d.id) ?? 0
    const steps = Math.max(actions - placed, 0)
    const shown = legs.slice(0, steps)
    const ghost = removedHere && steps > legs.length
    const base = pos ?? from
    // A token sits at the end of its last shown leg (or where it began).
    const at = shown[shown.length - 1]?.to ?? legs[0]?.from ?? base
    if (at && (pos || removedHere) && !(placed && actions === 0)) {
      const token = {
        ...d,
        pos: { ...base, q: at.q, r: at.r },
        removable: d.removeAtPrime != null,
        ghost,
        attacked: attackers.has(d.id),
      }
      if (ghost) ghosts.push(token)
      else tokens.push(token)
    }
    movements.push(...shown.map((leg, i) => ({ ...leg, endsAtToken: i === shown.length - 1 })))
  }
  movements.push(...withCurves(attackLegs, ATTACK_COLOR).map((leg) => ({ ...leg, endsAtToken: true })))
  // Ghosts first, so a live unit sharing the hex stays on top and grabbable.
  return { tokens: [...ghosts, ...tokens], movements }
}

const footprintOf = (hex: HexCoord, size: number, rot: number) =>
  getBossOccupiedHexes(hex, size as 1 | 3 | 7, rot)

/** The live token (other than `id`) standing on `hex`, counting whole footprints. */
export const tokenOccupying = (tokens: BoardToken[], id: string, hex: HexCoord) =>
  tokens.find(
    (t) =>
      t.id !== id &&
      !t.ghost &&
      footprintOf(t.pos, t.size, t.pos.rot ?? 0).some((h) => h.q === hex.q && h.r === hex.r),
  )

/** Can a unit of `size` stand on `hex`? A multi-hex unit needs every hex on the
 *  playable map and all at the same height. */
export function isValidFootprint(board: Pick<ParsedBoard, 'cells'>, hex: HexCoord, size: number, rot: number): boolean {
  if (size <= 1) return true
  const cells = footprintOf(hex, size, rot).map((h) => board.cells.find((c) => c.q === h.q && c.r === h.r))
  return cells.every((c) => c?.isPlayable && c.elevation === cells[0]?.elevation)
}

/** Would a unit of `size` landing on `hex` share a hex with a multi-hex unit (or,
 *  being multi-hex itself, with any unit)? `id` is the unit moving, if already placed. */
export function overlapsMultiHex(
  tokens: BoardToken[],
  id: string | null,
  hex: HexCoord,
  size: number,
  rot: number,
): boolean {
  const landing = footprintOf(hex, size, rot)
  return tokens.some(
    (t) =>
      t.id !== id &&
      !t.ghost &&
      (size > 1 || t.size > 1) &&
      footprintOf(t.pos, t.size, t.pos.rot ?? 0).some((h) => landing.some((l) => l.q === h.q && l.r === h.r)),
  )
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
