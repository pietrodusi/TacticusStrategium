import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** A token position at one turn (rot = boss rotation in degrees). */
export interface TokenPos {
  q: number
  r: number
  rot?: number
}

const TEAM_SIZE = 5
const HISTORY_MAX = 30
/** Battle phases as a flat index: 0 = S (deployment), then per turn k:
 *  player phase = 2k-1, enemy phase = 2k. The final turn (6) is player-only — no
 *  enemy phase — so S,1,1E,2,2E,…,5,5E,6 → 0..11. */
export const TURN_COUNT = 6
export const MAX_PHASE = TURN_COUNT * 2 - 1 // 11 (last turn has no enemy phase)

/** Rounds still to play at `phase` (1..MAX_PHASE): turn 1/1E → 6 … turn 6 → 1.
 *  Phase 0 (deployment) isn't a round — returns the full TURN_COUNT. */
export const roundsLeftAt = (phase: number): number =>
  TURN_COUNT - Math.ceil(phase / 2) + (phase === 0 ? 0 : 1)
const emptyTeam = (): (string | null)[] => Array(TEAM_SIZE).fill(null)

/**
 * Effective position of a token at `turn` — the most recent entry at or before it.
 * A `null` entry is an explicit "removed from here on" marker.
 */
export function posAtTurn(
  byTurn: Record<number, TokenPos | null> | undefined,
  turn: number,
): TokenPos | null {
  if (!byTurn) return null
  for (let t = turn; t >= 0; t--) if (t in byTurn) return byTurn[t]
  return null
}

/**
 * Visible paint at `phase`. Paint lives for the phase it was made on plus the
 * single following phase, then auto-clears — i.e. it persists through the other
 * side's turn and is gone by the next turn of the same type (paint on turn 1
 * shows on 1 and 1E, clears on turn 2). A `null` entry is a manual erase that
 * masks a hex inherited from the previous phase.
 */
export function paintAtTurn(
  byPhase: Record<number, Record<string, string | null>> | undefined,
  phase: number,
): Record<string, string> {
  const result: Record<string, string> = {}
  if (!byPhase) return result
  const prev = byPhase[phase - 1]
  if (prev) for (const [hex, color] of Object.entries(prev)) if (color !== null) result[hex] = color
  const cur = byPhase[phase]
  if (cur)
    for (const [hex, color] of Object.entries(cur)) {
      if (color === null) delete result[hex]
      else result[hex] = color
    }
  return result
}

type InstanceMap = Record<
  string,
  { unitId: string; side: 'ally' | 'enemy'; removeAtPrime?: number | null }
>

/** The undoable slice of the plan — captured at each gesture boundary. */
interface MapSnapshot {
  currentTurn: number
  positions: Record<string, Record<number, TokenPos | null>>
  paint: Record<number, Record<string, string | null>>
  instances: InstanceMap
  instanceSeq: number
}

interface PlanState {
  // ── Setup ──
  /** The fight's primary unit — a raid boss or a prime (per `targetKind`). */
  bossUnitId: string | null
  /** Whether the fight targets a raid boss or one of its primes (mini-bosses). */
  targetKind: 'boss' | 'prime'
  boardId: string | null
  team: (string | null)[]
  machineOfWar: string | null

  // ── Planning ──
  currentTurn: number
  /** tokenId → (turn → position | null). Sparse; null = removed from that turn on. */
  positions: Record<string, Record<number, TokenPos | null>>
  /** phase → (hexKey → color). Per-phase hex annotations; null = manual erase
   *  marker (masks a hex inherited from the previous phase). See paintAtTurn. */
  paint: Record<number, Record<string, string | null>>
  /** Spawn instances (summons / boss minions). instanceId → its source unit +
   *  side; `removeAtPrime` (initial-deployment adds only) is how many primes must
   *  fall for it to be hidden by the Primes-defeated stepper (null/undef = never). */
  instances: InstanceMap
  instanceSeq: number
  /** Undo snapshots, newest last (gesture boundaries; capped). Not persisted. */
  history: MapSnapshot[]
  /** Board whose initial enemy deployment has been seeded (idempotency guard). */
  seededBoard: string | null
  /** How many of the boss's primes are defeated — hides adds with removeAtPrime ≤ it. */
  primesDefeated: number

  // ── Setup actions ──
  selectBoss: (unitId: string) => void
  /** Select a prime (mini-boss) as the fight target; clears map + plan. */
  selectPrime: (unitId: string) => void
  selectBoard: (boardId: string) => void
  setTeamSlot: (index: number, characterId: string | null) => void
  setMachineOfWar: (id: string | null) => void
  reset: () => void

  // ── Planning actions ──
  setCurrentTurn: (turn: number) => void
  nextTurn: () => void
  prevTurn: () => void
  placeToken: (id: string, pos: TokenPos) => void
  /** Remove a token from the current turn onward; earlier turns keep it. */
  removeFromTurn: (id: string) => void
  /** Create a spawn instance; returns its instanceId. */
  addInstance: (unitId: string, side: 'ally' | 'enemy') => string
  /** Seed a board's initial enemy deployment as turn-0 enemy instances (once). */
  seedDeployment: (
    boardId: string,
    enemies: { unitId: string; q: number; r: number; removeAtPrime: number | null }[],
  ) => void
  /** Set how many of the boss's primes are defeated (hides the matching adds). */
  setPrimesDefeated: (defeated: number) => void
  /** Set a hex colour at the current turn, or erase it when color is null. */
  setPaint: (hexKey: string, color: string | null) => void
  /** Snapshot the map state before a user gesture mutates it (enables undo). */
  checkpoint: () => void
  /** Restore the latest snapshot (also jumps back to that gesture's phase). */
  undo: () => void
  resetPlan: () => void
}

const EMPTY_PLAN = {
  currentTurn: 0,
  positions: {},
  paint: {},
  instances: {},
  instanceSeq: 0,
  history: [] as MapSnapshot[],
  seededBoard: null,
  // Default to all primes defeated (the usual plan-the-boss-after-primes case);
  // bosses have at most 2 primes, and the stepper/filter clamp to nPrimes.
  primesDefeated: 2,
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      bossUnitId: null,
      targetKind: 'boss',
      boardId: null,
      team: emptyTeam(),
      machineOfWar: null,
      ...EMPTY_PLAN,

      // Changing the target (boss or prime) clears the map + plan (new battlefield).
      selectBoss: (unitId) =>
        set((s) =>
          s.bossUnitId === unitId && s.targetKind === 'boss'
            ? s
            : { bossUnitId: unitId, targetKind: 'boss', boardId: null, ...EMPTY_PLAN },
        ),
      selectPrime: (unitId) =>
        set((s) =>
          s.bossUnitId === unitId && s.targetKind === 'prime'
            ? s
            : { bossUnitId: unitId, targetKind: 'prime', boardId: null, ...EMPTY_PLAN },
        ),

      // Changing the map clears the plan.
      selectBoard: (boardId) => set({ boardId, ...EMPTY_PLAN }),

      setTeamSlot: (index, characterId) =>
        set((s) => {
          const team = s.team.map((id) => (id === characterId ? null : id))
          team[index] = characterId
          return { team }
        }),

      setMachineOfWar: (id) => set({ machineOfWar: id }),

      reset: () =>
        set({
          bossUnitId: null,
          targetKind: 'boss',
          boardId: null,
          team: emptyTeam(),
          machineOfWar: null,
          ...EMPTY_PLAN,
        }),

      setCurrentTurn: (turn) => set({ currentTurn: Math.max(0, Math.min(MAX_PHASE, turn)) }),
      nextTurn: () => set((s) => ({ currentTurn: Math.min(MAX_PHASE, s.currentTurn + 1) })),
      prevTurn: () => set((s) => ({ currentTurn: Math.max(0, s.currentTurn - 1) })),

      placeToken: (id, pos) =>
        set((s) => ({
          positions: { ...s.positions, [id]: { ...s.positions[id], [s.currentTurn]: pos } },
        })),

      // Remove from the current turn onward. Earlier turns keep the token; if it
      // has no earlier presence, drop it entirely (and its instance, if any).
      removeFromTurn: (id) =>
        set((s) => {
          const byTurn = { ...(s.positions[id] ?? {}) }
          for (const k of Object.keys(byTurn)) {
            if (Number(k) >= s.currentTurn) delete byTurn[Number(k)]
          }
          const hasPast = Object.values(byTurn).some((p) => p !== null)
          if (hasPast) {
            byTurn[s.currentTurn] = null // "removed from here on" marker
            return { positions: { ...s.positions, [id]: byTurn } }
          }
          const positions = { ...s.positions }
          delete positions[id]
          const instances = { ...s.instances }
          delete instances[id]
          return { positions, instances }
        }),

      addInstance: (unitId, side) => {
        const seq = get().instanceSeq + 1
        const id = `inst-${seq}`
        set((s) => ({ instanceSeq: seq, instances: { ...s.instances, [id]: { unitId, side } } }))
        return id
      },

      // Place the board's initial enemy line-up as turn-0 enemy instances. Guarded
      // by seededBoard so it runs once per board (survives reloads via persist).
      seedDeployment: (boardId, enemies) =>
        set((s) => {
          if (s.seededBoard === boardId) return s
          let seq = s.instanceSeq
          const instances = { ...s.instances }
          const positions = { ...s.positions }
          for (const e of enemies) {
            const id = `inst-${++seq}`
            instances[id] = { unitId: e.unitId, side: 'enemy', removeAtPrime: e.removeAtPrime }
            positions[id] = { 0: { q: e.q, r: e.r } }
          }
          return { instanceSeq: seq, instances, positions, seededBoard: boardId }
        }),

      setPrimesDefeated: (defeated) => set({ primesDefeated: defeated }),

      setPaint: (hexKey, color) =>
        set((s) => {
          const P = s.currentTurn
          const turnPaint = { ...(s.paint[P] ?? {}) }
          if (color === null) {
            // Erasing a hex inherited from the previous phase needs a null mask;
            // a hex painted on this phase is just dropped.
            const prev = s.paint[P - 1]
            if (prev && prev[hexKey] != null) turnPaint[hexKey] = null
            else delete turnPaint[hexKey]
          } else {
            turnPaint[hexKey] = color
          }
          return { paint: { ...s.paint, [P]: turnPaint } }
        }),

      checkpoint: () =>
        set((s) => ({
          history: [
            ...s.history.slice(1 - HISTORY_MAX),
            {
              currentTurn: s.currentTurn,
              positions: s.positions,
              paint: s.paint,
              instances: s.instances,
              instanceSeq: s.instanceSeq,
            },
          ],
        })),

      undo: () =>
        set((s) => {
          const prev = s.history[s.history.length - 1]
          return prev ? { ...prev, history: s.history.slice(0, -1) } : s
        }),

      resetPlan: () => set({ ...EMPTY_PLAN }),
    }),
    {
      name: 'tacticus-strategium-plan',
      version: 1,
      // Undo history is session-only — persist it emptied.
      partialize: (s) => ({ ...s, history: [] }),
      // v0 (pre-versioning) has the same shape as v1, so carry it over. Any other
      // mismatch discards the saved plan — plans are cheap to rebuild, while
      // hydrating an incompatible shape can break the board page.
      migrate: (persisted, version) =>
        (version === 0 ? persisted : undefined) as PlanState,
    },
  ),
)
