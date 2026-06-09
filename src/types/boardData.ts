// Types for TacticusDB board JSON (game-extracted map definitions).
// Source: https://tacticusdb.com/board/{boardId}.json (see scripts/dump-tacticusdb.mjs)

/** Terrain types from TacticusDB board data. */
export type TerrainType =
  | 'Grass'
  | 'DryBush'
  | 'Swamp'
  | 'Block'
  | 'Water'
  | 'Fire'
  | 'FirstAid'
  | 'Trench'

export interface BoardTile {
  TileId: TerrainType
  Elevation: number
  Rotation: number
  RoomID: number
  ForceUnplayable: number // 0 = playable, 1 = unplayable
}

export interface BoardColumn {
  Tile: BoardTile[]
}

export interface BoardSpawnPoint {
  Column: number
  Row: number
  Direction: number
  Room: number
  SpawnPointType: number
  Tag: string
  SecondarySpawn: number
}

export interface BoardSpawnPointGroup {
  TeamWithPlayerIndex: number
  MachineOfWarPosition: number
  SpawnPoints: BoardSpawnPoint[]
}

/** A starting tile hazard. EffectType: 5 = Fire, 17 = Ice, 1244 = Contaminated. */
export interface BoardTileEffect {
  Column: number
  Row: number
  EffectType: number
  Turns: number
}

export interface BoardSpawnPointSet {
  SpawnPointGroups: BoardSpawnPointGroup[]
  TileEffectSpawnPoints: BoardTileEffect[]
  GameModeTiles: unknown[]
  OverrideDeploymentCameraZ: number
  DeploymentCameraZ: number
}

export interface BoardBossPlatform {
  Size: number // 1, 3, or 7
  Tiles: { Column: number; Row: number }[]
  InitialSpawnPosition: number
  Direction: number
}

/** Full board JSON schema from TacticusDB (extra Unity fields omitted). */
export interface BoardData {
  Id: string
  Width: number // playable columns
  Height: number // playable rows
  Tiles: BoardColumn[]
  SpawnPointSets: BoardSpawnPointSet[]
  BossPlatforms: BoardBossPlatform[]
  fullCols: number
  fullRows: number
  playableColOffset: number
}

/** Per-hex metadata derived from a board. */
export interface HexCellData {
  terrain: TerrainType
  elevation: number
  isPlayable: boolean
  spawnRole?: 'player' | 'boss'
  spawnIndex?: number // 1-5 for player deployment slots
}

/** One board listed in public/data/boards-manifest.json. */
export interface BoardManifestEntry {
  boardId: string
  width: number | null
  height: number | null
  encounterCount: number
  bossTypes: string[]
  types: string[] // "Boss" | "Crystal"
}

export interface BoardsManifest {
  generatedFrom: string
  seasonCount: number
  boardCount: number
  boards: BoardManifestEntry[]
}
