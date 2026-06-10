// Pure derivation of what's on the board at a phase — token definitions,
// effective positions, movement arrows. Shared by the interactive BoardPage
// and the read-only shared-plan viewer (PlanBoardView).
import { posAtTurn, type TokenPos } from '../../stores/planStore'
import { RING_COLOR, type TokenKind } from '../tokenColors'
import { bossDisplayName } from '../../utils/format'
import type { BossIndex, PrimeIndex, SpawnsData, Unit } from '../../types/units'
import type { ParsedBoard } from '../../services/boards/boardService'
import type { BoardMovement, BoardToken } from '../HexGrid'

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

/** Effective tokens + movement arrows at `phase`. The boss falls back to its
 *  board start hex until placed; arrows point prev-phase → current. */
export function deriveBoardView(
  defs: TokenDef[],
  positions: PositionMap,
  phase: number,
  board: ParsedBoard,
): { tokens: BoardToken[]; movements: BoardMovement[] } {
  const tokens: BoardToken[] = []
  const movements: BoardMovement[] = []
  for (const d of defs) {
    const fallback =
      d.type === 'boss' ? { q: board.bossStart.q, r: board.bossStart.r, rot: board.bossRotation } : null
    const pos = posAtTurn(positions[d.id], phase) ?? fallback
    if (pos) tokens.push({ ...d, pos, removable: d.removeAtPrime != null })
    if (phase > 0) {
      const prev = posAtTurn(positions[d.id], phase - 1) ?? fallback
      if (pos && prev && (pos.q !== prev.q || pos.r !== prev.r)) {
        movements.push({ from: { q: prev.q, r: prev.r }, to: { q: pos.q, r: pos.r }, color: RING_COLOR[d.type] })
      }
    }
  }
  return { tokens, movements }
}
