import type { BoardData } from '../../types/boardData'
import type { BossSize, HexCoord, Point } from '../../types/strategium'

// ─── Calibration ─────────────────────────────────────────────────────
// Replicates TacticusDB's own hex overlay (gamemodes/GR map component) so
// our grid lands exactly on the pre-rendered board images.
//
// Placement (in 1024px image space) for a tile at (col, row):
//   V    = tileSize                       // column spacing
//   q    = 1.02 * tileSize                // row spacing
//   left = (col + playableColOffset) * V + offsetLeft
//   top  = (Height - 1 - row) * q + offsetTop
//          - (col even ? q/2 : 0)         // even columns shift up half a row
//          - Elevation * elevationFactor  // higher ground lifts up-screen
//   cell box is V × q; center = (left + V/2, top + q/2)
//
// tileSize/offsets/elevationFactor are picked per board *full* geometry.
// All 108 current Guild Raid boards are 13×15 or 13×14.
// ─────────────────────────────────────────────────────────────────────

const IMAGE_SIZE = 1024
const ROW_FACTOR = 1.02 // q = ROW_FACTOR * tileSize
// The hex cell is drawn slightly larger than its V×q box (Tailwind scale-x-125 / scale-y-110).
const HEX_SCALE_X = 1.25
const HEX_SCALE_Y = 1.1
// Shrinks each cell toward its center so adjacent hexes don't touch/overlap.
// 1.0 = TacticusDB's exact interlocking shape; lower = visible gap between hexes.
const HEX_PADDING = 0.92

interface Calibration {
  tileSize: number
  offsetLeft: number
  offsetTop: number
  elevationFactor: number
}

function getCalibration(fullCols: number, fullRows: number): Calibration {
  if (fullCols === 13 && fullRows === 15)
    return { tileSize: 69.5, offsetLeft: 58, offsetTop: 211, elevationFactor: 11 }
  if (fullCols === 13 && fullRows === 14)
    return { tileSize: 77.5, offsetLeft: 9, offsetTop: 230, elevationFactor: 11 }
  if (fullCols === 11 && fullRows === 12)
    return { tileSize: 88, offsetLeft: 30, offsetTop: 253, elevationFactor: 11 }
  // Fallback (matches TacticusDB's default branch).
  return { tileSize: IMAGE_SIZE / fullCols, offsetLeft: 0, offsetTop: 0, elevationFactor: 5 }
}

export interface ParsedCell {
  /** Offset coordinates (as stored in the board JSON). */
  col: number
  row: number
  /** Axial coordinates for adjacency / boss-footprint math. */
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

/** Crop rectangle (in image-pixel space) for the trimmed in-game view. */
export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

export interface ParsedBoard {
  id: string
  width: number
  height: number
  imageSize: number
  /** Column spacing / approximate hex pitch in image-pixel space. */
  tileSize: number
  /** Centered crop matching TacticusDB's in-game framing (trims decorative margins). */
  view: ViewBox
  bossSize: BossSize
  bossStart: HexCoord
  bossRotation: number
  cells: ParsedCell[]
}

/** Offset (col, row) → axial (q, r) with rows flipped (row 0 = bottom). */
function tdbToAxial(col: number, row: number, boardHeight: number): HexCoord {
  const flippedRow = boardHeight - 1 - row
  return { q: col, r: flippedRow - Math.floor(col / 2) }
}

/**
 * Hexagon corners for a cell box of w × h centered at (cx, cy), matching
 * TacticusDB's `.hexagonal` clip-path
 *   polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0 50%)
 * i.e. side points at ±0.5w, top/bottom edges at ±0.25w inset to ±0.433h,
 * then scaled by HEX_PADDING so neighbours don't overlap.
 */
function hexBoxCorners(cx: number, cy: number, w: number, h: number): Point[] {
  const sx = 0.5 * HEX_PADDING // left/right side points
  const tx = 0.25 * HEX_PADDING // top/bottom edge half-width
  const ty = 0.433 * HEX_PADDING // top/bottom edge inset (6.7% from box edge)
  return [
    { x: cx - tx * w, y: cy - ty * h },
    { x: cx + tx * w, y: cy - ty * h },
    { x: cx + sx * w, y: cy },
    { x: cx + tx * w, y: cy + ty * h },
    { x: cx - tx * w, y: cy + ty * h },
    { x: cx - sx * w, y: cy },
  ]
}

function coerceBossSize(n: number): BossSize {
  return n === 7 ? 7 : n === 1 ? 1 : 3
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

/**
 * Parse a raw TacticusDB board into render-ready cells (with image-aligned
 * pixel centers) plus boss/spawn metadata.
 *
 * @param spawnPointsSet which spawn-point set to apply (per-encounter; default 0).
 */
export function parseBoard(board: BoardData, spawnPointsSet = 0): ParsedBoard {
  const cal = getCalibration(board.fullCols, board.fullRows)
  const V = cal.tileSize
  const q = ROW_FACTOR * V
  const hexW = V * HEX_SCALE_X
  const hexH = q * HEX_SCALE_Y

  // In-game framing: center-crop to (Width+2) columns wide, full height minus
  // one tile (half a tile trimmed top and bottom). Matches TacticusDB's GR view.
  const cropW = (board.Width + 2) * V
  const cropH = IMAGE_SIZE - V
  const view: ViewBox = { x: (IMAGE_SIZE - cropW) / 2, y: V / 2, w: cropW, h: cropH }

  const byOffset = new Map<string, ParsedCell>()

  board.Tiles.forEach((col, c) => {
    col.Tile.forEach((tile, r) => {
      const left = (c + board.playableColOffset) * V + cal.offsetLeft
      const top =
        (board.Height - 1 - r) * q +
        cal.offsetTop -
        (c % 2 === 0 ? q / 2 : 0) -
        tile.Elevation * cal.elevationFactor
      const center: Point = { x: left + V / 2, y: top + q / 2 }

      const axial = tdbToAxial(c, r, board.Height)
      const isBlock = tile.TileId === 'Block'
      const isUnplayable = tile.ForceUnplayable === 1

      byOffset.set(`${c},${r}`, {
        col: c,
        row: r,
        q: axial.q,
        r: axial.r,
        center,
        corners: hexBoxCorners(center.x, center.y, hexW, hexH),
        terrain: tile.TileId,
        elevation: tile.Elevation,
        isPlayable: !isBlock && !isUnplayable,
      })
    })
  })

  // Player deployment slots (team index 1) from the chosen spawn set.
  const spawnSet = board.SpawnPointSets?.[spawnPointsSet] ?? board.SpawnPointSets?.[0]
  for (const group of spawnSet?.SpawnPointGroups ?? []) {
    if (group.TeamWithPlayerIndex !== 1) continue
    let idx = 0
    for (const sp of group.SpawnPoints) {
      if (sp.SpawnPointType === 10) continue // not a deployment slot
      idx += 1
      const cell = byOffset.get(`${sp.Column},${sp.Row}`)
      if (cell) {
        cell.spawnRole = 'player'
        cell.spawnIndex = idx
      }
    }
  }

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
      const cell = byOffset.get(`${t.Column},${t.Row}`)
      if (cell) cell.spawnRole = 'boss'
    }
  }

  return {
    id: board.Id,
    width: board.Width,
    height: board.Height,
    imageSize: IMAGE_SIZE,
    tileSize: V,
    view,
    bossSize,
    bossStart,
    bossRotation,
    cells: [...byOffset.values()],
  }
}
