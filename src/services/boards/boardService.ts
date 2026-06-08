import type { BoardData } from '../../types/boardData'
import type { BossSize, HexCoord, HexGridConfig, Point } from '../../types/strategium'
import { hexCorners, hexKey, hexToPixel } from '../hex/hexUtils'

// ─── Coordinate system ───────────────────────────────────────────────
// TacticusDB boards use OFFSET coordinates (col, row) with row 0 = bottom
// (player side) and odd columns shifted down. Our renderer uses AXIAL (q, r)
// with row 0 at the top. We flip rows then convert offset→axial:
//   flippedRow = (Height - 1) - row
//   q = col, r = flippedRow - floor(col / 2)
// ─────────────────────────────────────────────────────────────────────

// Calibration constants measured at 1024×1024 image scale (TacticusDB's render size).
const IMAGE_SIZE = 1024
const HEX_SIZE = 46.25
const VERTICAL_SCALE = 0.885
const LEVEL_Y_OFFSET = 11.0
const ORIGIN_X = 301.24
const BASE_Y_ELEV0 = 849.0

export interface ParsedCell {
  q: number
  r: number
  center: Point
  corners: Point[]
  terrain: BoardData['Tiles'][number]['Tile'][number]['TileId']
  elevation: number
  isPlayable: boolean
  spawnRole?: 'player' | 'boss'
  spawnIndex?: number
}

export interface ParsedBoard {
  id: string
  width: number
  height: number
  imageSize: number
  hexGrid: HexGridConfig
  bossSize: BossSize
  bossStart: HexCoord
  bossRotation: number
  cells: ParsedCell[]
}

function tdbToAxial(col: number, row: number, boardHeight: number): HexCoord {
  const flippedRow = boardHeight - 1 - row
  return { q: col, r: flippedRow - Math.floor(col / 2) }
}

function deriveHexGridConfig(board: BoardData): HexGridConfig {
  const rowSpacing = HEX_SIZE * Math.sqrt(3) * VERTICAL_SCALE
  const originY = BASE_Y_ELEV0 - rowSpacing * (board.Height - 1)
  return {
    originX: ORIGIN_X,
    originY,
    hexSize: HEX_SIZE,
    verticalScale: VERTICAL_SCALE,
    rotation: 0,
    rows: board.Height,
    cols: board.Width,
    levelYOffset: LEVEL_Y_OFFSET,
    hexMargin: 1.0,
  }
}

/** For 3-hex bosses, find which neighbor direction the wing tiles point. */
function deriveBossRotation(center: HexCoord, others: HexCoord[], bossSize: number): number {
  if (bossSize !== 3 || others.length < 2) return 0
  const directions: HexCoord[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ]
  for (let i = 0; i < directions.length; i++) {
    const nq = center.q + directions[i].q
    const nr = center.r + directions[i].r
    if (others.some((h) => h.q === nq && h.r === nr)) return i * 60
  }
  return 0
}

function coerceBossSize(n: number): BossSize {
  return n === 7 ? 7 : n === 1 ? 1 : 3
}

/** Parse a raw TacticusDB board into render-ready geometry + per-hex metadata. */
export function parseBoard(board: BoardData): ParsedBoard {
  const hexGrid = deriveHexGridConfig(board)
  const origin: Point = { x: hexGrid.originX, y: hexGrid.originY }
  const margin = hexGrid.hexMargin ?? 1

  const cellMap = new Map<string, ParsedCell>()
  board.Tiles.forEach((col, colIdx) => {
    col.Tile.forEach((tile, rowIdx) => {
      const coord = tdbToAxial(colIdx, rowIdx, board.Height)
      const center = hexToPixel(coord, HEX_SIZE, origin, VERTICAL_SCALE, tile.Elevation, LEVEL_Y_OFFSET)
      const isBlock = tile.TileId === 'Block'
      const isUnplayable = tile.ForceUnplayable === 1
      cellMap.set(hexKey(coord), {
        q: coord.q,
        r: coord.r,
        center,
        corners: hexCorners(center, HEX_SIZE * margin, VERTICAL_SCALE),
        terrain: tile.TileId,
        elevation: tile.Elevation,
        isPlayable: !isBlock && !isUnplayable,
      })
    })
  })

  // Player deployment slots (first spawn set / first group).
  const spawnGroup = board.SpawnPointSets?.[0]?.SpawnPointGroups?.[0]
  spawnGroup?.SpawnPoints.forEach((sp, idx) => {
    const cell = cellMap.get(hexKey(tdbToAxial(sp.Column, sp.Row, board.Height)))
    if (cell) {
      cell.spawnRole = 'player'
      cell.spawnIndex = idx + 1
    }
  })

  // Boss platform → start position, rotation, size.
  let bossSize: BossSize = 3
  let bossStart: HexCoord = { q: Math.floor(board.Width / 2), r: 0 }
  let bossRotation = 0
  const platform = board.BossPlatforms?.[0]
  if (platform && platform.Tiles.length > 0) {
    bossSize = coerceBossSize(platform.Size)
    const centerTile = platform.Tiles[platform.InitialSpawnPosition] ?? platform.Tiles[0]
    bossStart = tdbToAxial(centerTile.Column, centerTile.Row, board.Height)
    const axialTiles = platform.Tiles.map((t) => tdbToAxial(t.Column, t.Row, board.Height))
    const others = axialTiles.filter((h) => h.q !== bossStart.q || h.r !== bossStart.r)
    bossRotation = deriveBossRotation(bossStart, others, platform.Size)
    for (const t of platform.Tiles) {
      const cell = cellMap.get(hexKey(tdbToAxial(t.Column, t.Row, board.Height)))
      if (cell) cell.spawnRole = 'boss'
    }
  }

  return {
    id: board.Id,
    width: board.Width,
    height: board.Height,
    imageSize: IMAGE_SIZE,
    hexGrid,
    bossSize,
    bossStart,
    bossRotation,
    cells: [...cellMap.values()],
  }
}
