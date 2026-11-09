import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlanData } from '../services/plans/serialize'
import type { HexCoord } from '../types/strategium'

/** A token position at one turn (rot = boss rotation in degrees). */
export interface TokenPos {
  q: number
  r: number
  rot?: number
}

/** tokenId → (phase → hexes the token stopped on before its final position). */
export type WaypointMap = Record<string, Record<number, HexCoord[]>>

/** phase → token ids, one entry per action, in the order they were made. A unit
 *  removed that phase has one more entry than it has steps: the last is the removal. */
export type MoveOrder = Record<number, string[]>

const sameHex = (a: HexCoord, b: HexCoord) => a.q === b.q && a.r === b.r

const legCount = (points: (HexCoord | null)[]) => {
  const hexes = points.filter((p): p is HexCoord => !!p)
  return hexes.slice(1).filter((p, i) => !sameHex(p, hexes[i])).length
}

/**
 * A token's route for one phase after moving it to `target`. With `addStep` the
 * move is a new step, even back onto an earlier hex. Without it the move edits
 * the current step, and ending where that step began cancels the step. A null
 * `end` means no movement is left this phase.
 */
export function nextRoute(
  start: HexCoord | null,
  stops: HexCoord[],
  end: HexCoord | null,
  target: HexCoord,
  addStep: boolean,
): { stops: HexCoord[]; end: HexCoord | null } {
  if (addStep && end) return { stops: [...stops, { q: end.q, r: end.r }], end: target }
  const origin = stops[stops.length - 1] ?? start
  if (!origin || !sameHex(origin, target)) return { stops, end: target }
  return stops.length > 0 ? { stops: stops.slice(0, -1), end: origin } : { stops: [], end: null }
}

/**
 * Edit a step that isn't the route's last (leg 0 = the first step), keeping the
 * steps after it. Ending where the step began cancels it. A step left with no
 * distance to cover (A→B→A with B cancelled) goes too. `removedLegs` are indices
 * into the route as it was.
 */
export function editRouteStep(
  start: HexCoord | null,
  stops: HexCoord[],
  end: HexCoord,
  leg: number,
  target: HexCoord,
): { stops: HexCoord[]; end: HexCoord | null; removedLegs: number[] } {
  const firstStop = start ? 1 : 0
  const points = [...(start ? [start] : []), ...stops, end]
  const edited = leg + 1 // the point this leg ends on
  const hex = { q: target.q, r: target.r }
  const removedLegs: number[] = []
  const cancels = sameHex(points[edited - 1], hex)
  const anchor = cancels ? points[edited - 1] : hex

  if (cancels) removedLegs.push(leg)
  else points[edited] = hex
  const next = points[edited + 1]
  const nextGoes = !!next && sameHex(anchor, next)
  if (nextGoes) removedLegs.push(leg + 1)

  const kept = points.filter((_, i) => !(cancels && i === edited) && !(nextGoes && i === edited + 1))
  return {
    stops: kept.slice(firstStop, -1),
    end: kept.length > firstStop ? kept[kept.length - 1] : null,
    removedLegs,
  }
}

/** Drop the given legs (nth occurrences of `id`) from a move order. */
function dropLegs(order: string[], id: string, legs: number[]) {
  const occurrences = order.flatMap((x, i) => (x === id ? [i] : []))
  const dropped = legs.map((leg) => occurrences[leg]).filter((i) => i !== undefined)
  return { order: order.filter((_, i) => !dropped.includes(i)), dropped }
}

/** The replay step to keep showing after an edit (null = the whole turn). */
const replayStepAfter = (step: number, total: number) => (step >= total ? null : Math.max(step, 1))

/** What a move made during a replay needs: the order on screen, how many moves
 *  are shown, and how many of them belong to the moved unit. */
export interface ReplayEdit {
  order: string[]
  step: number
  shown: number
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

// ── Hazard paint values ──
// A painted hazard is stored as `kind@life` (e.g. "fire@2"): its kind plus the
// rounds it had left when written. A round is a 2-phase period (player + enemy,
// in either order) starting at the phase it was painted on.
export const HAZARD_KINDS = ['fire', 'ice', 'contaminated'] as const
export type HazardKind = (typeof HAZARD_KINDS)[number]
/** Default hazard life span, in rounds. */
export const HAZARD_LIFE = 2

export const hazardValue = (kind: HazardKind, life: number): string => `${kind}@${life}`

/** Parse a paint value as a hazard (`kind` or `kind@life`); null for colours. */
export function parseHazard(value: string): { kind: HazardKind; life: number } | null {
  const [kind, life] = value.split('@')
  if (!(HAZARD_KINDS as readonly string[]).includes(kind)) return null
  return { kind: kind as HazardKind, life: life ? Number(life) : HAZARD_LIFE }
}

/**
 * Visible paint at `phase`: per hex, the latest entry at or before it wins,
 * judged by its own lifetime. Colours live for the phase they were made on
 * plus the single following phase (a mark on turn 1 shows through 1E, gone by
 * turn 2). Hazards live `life` rounds (2 phases each) with the remaining
 * rounds re-encoded into the result (`fire@1`). A `null` entry is a manual
 * erase masking anything older.
 */
export function paintAtTurn(
  byPhase: Record<number, Record<string, string | null>> | undefined,
  phase: number,
): Record<string, string> {
  const latest: Record<string, { at: number; value: string | null }> = {}
  for (const [key, marks] of Object.entries(byPhase ?? {})) {
    const at = Number(key)
    if (at > phase) continue
    for (const [hex, value] of Object.entries(marks)) {
      if (!latest[hex] || at >= latest[hex].at) latest[hex] = { at, value }
    }
  }
  const result: Record<string, string> = {}
  for (const [hex, { at, value }] of Object.entries(latest)) {
    if (value === null) continue
    const hazard = parseHazard(value)
    if (hazard) {
      const left = hazard.life - Math.floor((phase - at) / 2)
      if (left > 0) result[hex] = hazardValue(hazard.kind, left)
    } else if (phase - at <= 1) {
      result[hex] = value
    }
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
  waypoints: WaypointMap
  moveOrder: MoveOrder
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
  /** Intermediate stops of multi-step moves; `positions` keeps the final hex. */
  waypoints: WaypointMap
  /** The order steps were made in each phase, for replaying a turn move by move. */
  moveOrder: MoveOrder
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
  /** The cloud doc this local plan came from (enables "Overwrite"). Cleared
   *  whenever the plan is cleared (new target/map, reset, exit). */
  cloudRef: { id: string; name: string } | null

  // ── Setup actions ──
  selectBoss: (unitId: string) => void
  /** Select a prime (mini-boss) as the fight target; clears map + plan. */
  selectPrime: (unitId: string) => void
  selectBoard: (boardId: string) => void
  setTeamSlot: (index: number, characterId: string | null) => void
  setMachineOfWar: (id: string | null) => void
  /** Fill the whole squad + MoW from a saved raid team (keeps the plan). */
  applyTeam: (members: (string | null)[], machineOfWar: string | null) => void
  reset: () => void

  // ── Planning actions ──
  setCurrentTurn: (turn: number) => void
  nextTurn: () => void
  prevTurn: () => void
  placeToken: (id: string, pos: TokenPos) => void
  /** Move a token; `start` is where it began this phase, if anywhere. During a
   *  replay, returns the step to keep showing (null = the whole turn). */
  moveToken: (
    id: string,
    pos: TokenPos,
    start: HexCoord | null,
    addStep: boolean,
    replay?: ReplayEdit,
  ) => number | null
  /** Remove a token from the current turn onward, recorded as an action after the
   *  moves it made; earlier turns keep it. Returns the replay step, as moveToken. */
  removeFromTurn: (id: string, replay?: ReplayEdit) => number | null
  /** Create a spawn instance; returns its instanceId. */
  addInstance: (unitId: string, side: 'ally' | 'enemy') => string
  /** Seed a board's initial enemy deployment as turn-0 enemy instances (once). */
  seedDeployment: (
    boardId: string,
    enemies: { unitId: string; q: number; r: number; removeAtPrime: number | null }[],
  ) => void
  /** Set how many of the boss's primes are defeated (hides the matching adds). */
  setPrimesDefeated: (defeated: number) => void
  /** Set a hex value at the current turn (colour or `kind@life` hazard), or
   *  erase it when null. Re-stamping a hazard refreshes its full lifespan. */
  setPaint: (hexKey: string, color: string | null) => void
  /** Snapshot the map state before a user gesture mutates it (enables undo). */
  checkpoint: () => void
  /** Restore the latest snapshot (also jumps back to that gesture's phase). */
  undo: () => void
  resetPlan: () => void

  // ── Cloud actions ──
  /** Replace the whole local plan (setup + map) with a cloud payload. */
  loadPlan: (data: PlanData, cloudRef: { id: string; name: string } | null) => void
  /** Link/unlink the current local plan to a cloud doc (after save / rename). */
  setCloudRef: (ref: { id: string; name: string } | null) => void
}

const EMPTY_PLAN = {
  currentTurn: 0,
  positions: {},
  waypoints: {} as WaypointMap,
  moveOrder: {} as MoveOrder,
  paint: {},
  instances: {},
  instanceSeq: 0,
  history: [] as MapSnapshot[],
  seededBoard: null,
  // Default to all primes defeated (the usual plan-the-boss-after-primes case);
  // bosses have at most 2 primes, and the stepper/filter clamp to nPrimes.
  primesDefeated: 2,
  cloudRef: null as { id: string; name: string } | null,
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

      applyTeam: (members, machineOfWar) =>
        set({
          team: Array.from({ length: TEAM_SIZE }, (_, i) => members[i] ?? null),
          machineOfWar,
        }),

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

      moveToken: (id, pos, start, addStep, replay) => {
        const s = get()
        const P = s.currentTurn
        const rawStops = s.waypoints[id]?.[P] ?? []
        const wasRemoved = s.positions[id]?.[P] === null
        // Mid-replay, a unit removed later this turn is still on the board: its
        // last stop is its position. Once it's gone, placing it again undoes that.
        const beforeRemoval = wasRemoved && !!replay && replay.shown <= legCount([start, ...rawStops])
        const reinstated = wasRemoved && !beforeRemoval
        const prevStops = beforeRemoval ? rawStops.slice(0, -1) : reinstated ? [] : rawStops
        const prevEnd = beforeRemoval ? (rawStops[rawStops.length - 1] ?? null) : (s.positions[id]?.[P] ?? null)
        const prevLegs = legCount([start, ...prevStops, prevEnd])
        const edit =
          replay && prevEnd && replay.shown < prevLegs
            ? editRouteStep(start, prevStops, prevEnd, replay.shown - 1, pos)
            : null
        const route = edit ?? nextRoute(start, prevStops, prevEnd, pos, addStep)
        const nextLegs = legCount([start, ...route.stops, route.end])
        const added = nextLegs > prevLegs

        // One log entry per step: added or cancelled steps change it, corrections
        // don't. During a replay a new step goes right after the moves on screen.
        const base = replay?.order ?? s.moveOrder[P] ?? []
        const removedLegs = reinstated
          ? base.filter((x) => x === id).map((_, i) => i)
          : edit
            ? edit.removedLegs
            : nextLegs < prevLegs
              ? [prevLegs - 1]
              : []
        const { order, dropped } = dropLegs(base, id, removedLegs)
        const at = replay ? replay.step - dropped.filter((i) => i < replay.step).length : order.length
        if (added) order.splice(at, 0, id)

        const stops = beforeRemoval
          ? [...route.stops, ...(route.end ? [{ q: route.end.q, r: route.end.r }] : [])]
          : route.stops
        const stopsByTurn = { ...s.waypoints[id] }
        if (stops.length > 0) stopsByTurn[P] = stops
        else delete stopsByTurn[P]

        const byTurn = { ...s.positions[id] }
        if (beforeRemoval) {
          // Still removed at the end of the turn.
        } else if (route.end) {
          byTurn[P] = { ...pos, ...route.end }
        } else if (pos.rot !== posAtTurn(byTurn, P - 1)?.rot) {
          byTurn[P] = pos // movement cancelled, but keep a rotation made this phase
        } else {
          delete byTurn[P]
        }
        set({
          positions: { ...s.positions, [id]: byTurn },
          waypoints: { ...s.waypoints, [id]: stopsByTurn },
          moveOrder: { ...s.moveOrder, [P]: order },
        })

        return replay ? replayStepAfter(at + (added ? 1 : 0), order.length) : null
      },

      // Remove from the current turn onward. Earlier turns keep the token, and this
      // turn keeps the moves made before the removal (the steps on screen, during a
      // replay). With no earlier presence, drop it entirely (and its instance, if any).
      removeFromTurn: (id, replay) => {
        const s = get()
        const P = s.currentTurn
        const byTurn = { ...(s.positions[id] ?? {}) }
        const stopsByTurn = { ...s.waypoints[id] }
        const start = posAtTurn(byTurn, P - 1)
        const route = [start, ...(stopsByTurn[P] ?? []), byTurn[P] ?? null].filter((p): p is TokenPos => !!p)
        const points = route.filter((p, i) => i === 0 || !sameHex(p, route[i - 1]))
        for (const k of Object.keys(byTurn)) if (Number(k) >= P) delete byTurn[Number(k)]
        for (const k of Object.keys(stopsByTurn)) if (Number(k) >= P) delete stopsByTurn[Number(k)]
        const hasPast = Object.values(byTurn).some((p) => p !== null)

        const legsKept = hasPast ? Math.min(replay?.shown ?? Infinity, Math.max(points.length - 1, 0)) : 0
        const base = replay?.order ?? s.moveOrder[P] ?? []
        const total = base.filter((x) => x === id).length
        const { order, dropped } = dropLegs(
          base,
          id,
          Array.from({ length: Math.max(total - legsKept, 0) }, (_, i) => legsKept + i),
        )
        const at = replay ? replay.step - dropped.filter((i) => i < replay.step).length : order.length
        if (hasPast) order.splice(at, 0, id)
        const moveOrder = Object.fromEntries(
          Object.entries(s.moveOrder).map(([k, ids]) => [k, Number(k) > P ? ids.filter((x) => x !== id) : ids]),
        )
        moveOrder[P] = order

        if (hasPast) {
          byTurn[P] = null // "removed from here on" marker
          const stops = points.slice(start ? 1 : 0, legsKept + 1).map(({ q, r }) => ({ q, r }))
          if (stops.length > 0) stopsByTurn[P] = stops
          set({
            positions: { ...s.positions, [id]: byTurn },
            waypoints: { ...s.waypoints, [id]: stopsByTurn },
            moveOrder,
          })
        } else {
          const positions = { ...s.positions }
          delete positions[id]
          const waypoints = { ...s.waypoints }
          delete waypoints[id]
          const instances = { ...s.instances }
          delete instances[id]
          set({ positions, waypoints, moveOrder, instances })
        }
        return replay ? replayStepAfter(at + (hasPast ? 1 : 0), order.length) : null
      },

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
            // Drop this phase's entry; if an earlier phase still shows through
            // (colours 1 phase back, hazards up to their life), mask it.
            delete turnPaint[hexKey]
            if (paintAtTurn({ ...s.paint, [P]: turnPaint }, P)[hexKey]) turnPaint[hexKey] = null
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
              waypoints: s.waypoints,
              moveOrder: s.moveOrder,
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

      loadPlan: (data, cloudRef) =>
        // Always open on deployment, whichever turn the plan was saved on.
        // Plans saved before multi-step moves have no waypoints or move order.
        set({
          ...data,
          waypoints: data.waypoints ?? {},
          moveOrder: data.moveOrder ?? {},
          currentTurn: 0,
          history: [],
          cloudRef,
        }),

      setCloudRef: (cloudRef) => set({ cloudRef }),
    }),
    {
      name: 'tacticus-strategium-plan',
      version: 2,
      // Undo history is session-only — persist it emptied.
      partialize: (s) => ({ ...s, history: [] }),
      // v0/v1 → v2 adds cloudRef (v0, pre-versioning, has the v1 shape). Any
      // other mismatch discards the saved plan — plans are cheap to rebuild,
      // while hydrating an incompatible shape can break the board page.
      migrate: (persisted, version) =>
        (version <= 1
          ? { ...(persisted as PlanState), cloudRef: null }
          : undefined) as PlanState,
    },
  ),
)
