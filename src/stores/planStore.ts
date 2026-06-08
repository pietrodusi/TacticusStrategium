import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const TEAM_SIZE = 5
const emptyTeam = (): (string | null)[] => Array(TEAM_SIZE).fill(null)

interface PlanState {
  /** Selected boss unitId (from bosses.json). */
  bossUnitId: string | null
  /** Selected board/map id. */
  boardId: string | null
  /** 5 character slots (character ids, or null). */
  team: (string | null)[]
  /** Machine-of-War character id, or null. */
  machineOfWar: string | null

  selectBoss: (unitId: string) => void
  selectBoard: (boardId: string) => void
  setTeamSlot: (index: number, characterId: string | null) => void
  setMachineOfWar: (id: string | null) => void
  reset: () => void
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      bossUnitId: null,
      boardId: null,
      team: emptyTeam(),
      machineOfWar: null,

      // Changing boss clears the map (maps are boss-specific).
      selectBoss: (unitId) =>
        set((s) => (s.bossUnitId === unitId ? s : { bossUnitId: unitId, boardId: null })),

      selectBoard: (boardId) => set({ boardId }),

      // Fill a slot, removing the same character from any other slot (no dupes).
      setTeamSlot: (index, characterId) =>
        set((s) => {
          const team = s.team.map((id) => (id === characterId ? null : id))
          team[index] = characterId
          return { team }
        }),

      setMachineOfWar: (id) => set({ machineOfWar: id }),

      reset: () => set({ bossUnitId: null, boardId: null, team: emptyTeam(), machineOfWar: null }),
    }),
    { name: 'tacticus-strategium-plan' },
  ),
)
