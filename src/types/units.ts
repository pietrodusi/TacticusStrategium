// Plan-feature unit + index types (back the boss picker and team muster).

/** One entry in public/data/bosses.json. */
export interface BossIndexEntry {
  unitId: string
  bossType: string | null
  name: string
  faction: string | null
  bossSize: number // 1 | 3 | 7
  imageStem: string | null
  boardIds: string[]
}

export interface BossIndex {
  generatedFrom: string
  bossCount: number
  bosses: BossIndexEntry[]
}

/** public/data/imageStems.json — unitId → portrait stem, by unit type. */
export interface ImageStems {
  character: Record<string, string>
  summon: Record<string, string>
  boss: Record<string, string>
  npc: Record<string, string>
  ability?: Record<string, string>
}

/** A selectable roster / Machine-of-War unit (for slots + pickers). */
export interface Unit {
  id: string
  name: string
  faction: string | null
  stem: string | null
}
