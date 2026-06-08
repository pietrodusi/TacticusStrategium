import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** A token position at one turn (rot = boss rotation in degrees). */
export interface TokenPos {
  q: number
  r: number
  rot?: number
}

const TEAM_SIZE = 5
export const MAX_TURN = 5 // turn 0 = deployment, 1–5 = the raid turns
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

interface PlanState {
  // ── Setup ──
  bossUnitId: string | null
  boardId: string | null
  team: (string | null)[]
  machineOfWar: string | null

  // ── Planning ──
  currentTurn: number
  /** tokenId → (turn → position | null). Sparse; null = removed from that turn on. */
  positions: Record<string, Record<number, TokenPos | null>>
  /** turn → (hexKey → color). Per-turn hex annotations. */
  paint: Record<number, Record<string, string>>
  /** Spawn instances (summons / boss minions). instanceId → its source unit + side. */
  instances: Record<string, { unitId: string; side: 'ally' | 'enemy' }>
  instanceSeq: number

  // ── Setup actions ──
  selectBoss: (unitId: string) => void
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
  /** Set a hex colour at the current turn, or erase it when color is null. */
  setPaint: (hexKey: string, color: string | null) => void
  resetPlan: () => void
}

const EMPTY_PLAN = { currentTurn: 0, positions: {}, paint: {}, instances: {}, instanceSeq: 0 }

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      bossUnitId: null,
      boardId: null,
      team: emptyTeam(),
      machineOfWar: null,
      ...EMPTY_PLAN,

      // Changing boss clears the map + plan (different battlefield).
      selectBoss: (unitId) =>
        set((s) => (s.bossUnitId === unitId ? s : { bossUnitId: unitId, boardId: null, ...EMPTY_PLAN })),

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
        set({ bossUnitId: null, boardId: null, team: emptyTeam(), machineOfWar: null, ...EMPTY_PLAN }),

      setCurrentTurn: (turn) => set({ currentTurn: Math.max(0, Math.min(MAX_TURN, turn)) }),
      nextTurn: () => set((s) => ({ currentTurn: Math.min(MAX_TURN, s.currentTurn + 1) })),
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

      setPaint: (hexKey, color) =>
        set((s) => {
          const turnPaint = { ...(s.paint[s.currentTurn] ?? {}) }
          if (color === null) delete turnPaint[hexKey]
          else turnPaint[hexKey] = color
          return { paint: { ...s.paint, [s.currentTurn]: turnPaint } }
        }),

      resetPlan: () => set({ ...EMPTY_PLAN }),
    }),
    { name: 'tacticus-strategium-plan' },
  ),
)
