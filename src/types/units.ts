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

/** public/data/spawns.json — which units each character/boss can spawn. */
export interface SpawnUnit {
  name: string
  faction: string | null
  stem: string | null
  kind: 'summon' | 'npc'
  size: number // 1 or 3 (BigTarget)
  visualId?: string | null // portrait fallback when `stem` is null (enemy NPCs)
}

/** One pre-placed enemy in a board's initial line-up (Legendary tier). */
export interface DeployedEnemy {
  unitId: string
  col: number
  row: number
  deploymentOrder: number | null
  /** Number of primes that must fall for this add to be removed (null = never). */
  removeAtPrime: number | null
}

/** One of a boss's prime mini-bosses (ordered; defeating them removes adds). */
export interface DeploymentPrime {
  unitId: string | null
  name: string
}

/** Initial enemy deployment for a board (keyed by boardId in SpawnsData). */
export interface BoardDeployment {
  bossType: string | null
  bossUnitId: string
  rarity: string | null
  enemies: DeployedEnemy[]
  primes: DeploymentPrime[] // defeating the first k removes adds with removeAtPrime ≤ k
}

export interface SpawnsData {
  byUnit: Record<string, string[]>
  units: Record<string, SpawnUnit>
  deployments: Record<string, BoardDeployment>
}
