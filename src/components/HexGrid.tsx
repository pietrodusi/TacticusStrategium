import { useMemo, useState } from 'react'
import type { ParsedBoard, ParsedCell, TileEffectKind } from '../services/boards/boardService'
import { keywordIconUrl, mapImageUrl, unitPortraitUrl } from '../services/paths'
import { footprintPath } from '../services/boards/footprint'
import { getBossOccupiedHexes, hexKey } from '../services/hex/hexUtils'
import type { HexCoord, Point } from '../types/strategium'
import type { TokenPos } from '../stores/planStore'
import { RING_COLOR, type TokenKind } from './tokenColors'

export interface BoardToken {
  id: string
  type: TokenKind
  stem: string | null
  name: string
  size: number // 1 | 3 | 7
  pos: TokenPos
  /** Initial add that disappears once the boss's primes are defeated. */
  removable?: boolean
}

export interface BoardMovement {
  from: HexCoord
  to: HexCoord
  color: string
}

interface Props {
  board: ParsedBoard
  showGrid?: boolean
  tokens?: BoardToken[]
  movements?: BoardMovement[]
  /** hexKey → color, for the current turn. The sentinel "fire" renders a flame. */
  paint?: Record<string, string>
  /** Tint the player (teal) and boss (purple) starting hexes. */
  showStartHexes?: boolean
  /** Tint every playable hex by its elevation (0–4 heatmap). */
  showElevation?: boolean
  /** Vertical anchoring of the map within its area (top when tools fill the band
   *  below, centered when they're collapsed). */
  vAlign?: 'top' | 'center'
  selectedTokenId?: string | null
  /** When true, dragging paints/erases hexes instead of moving tokens. */
  painting?: boolean
  onHexClick?: (hex: HexCoord) => void
  onTokenClick?: (id: string) => void
  onTokenMove?: (id: string, hex: HexCoord) => void
  onPaint?: (hexKey: string, erase: boolean) => void
}

const GRID_STROKE = 'rgba(255,215,0,0.2)'

/** Elevation heatmap fill by level (0 low → 4 high): green → yellow → orange →
 *  red → brown, at high opacity so adjacent levels are easy to tell apart. */
const ELEV_FILL = [
  'rgba(34,197,94,0.6)', // 0 — green
  'rgba(250,204,21,0.6)', // 1 — yellow
  'rgba(249,115,22,0.62)', // 2 — orange
  'rgba(239,68,68,0.62)', // 3 — red
  'rgba(146,64,14,0.7)', // 4 — brown
]

/** Tile-hazard fills (fire also overlays the bundled flame icon). */
const EFFECT_FILL: Record<TileEffectKind, string> = {
  fire: 'rgba(232,92,30,0.40)',
  ice: 'rgba(120,200,232,0.34)',
  contaminated: 'rgba(120,200,60,0.32)',
}

interface DragState {
  id: string | null // token being dragged, or null for a background gesture
  ix: number
  iy: number // current pointer, image space
  sx: number
  sy: number // start pointer, image space
  moved: boolean
}

export function HexGrid({
  board,
  showGrid = true,
  tokens = [],
  movements = [],
  paint,
  showStartHexes = false,
  showElevation = false,
  vAlign = 'top',
  selectedTokenId,
  painting = false,
  onHexClick,
  onTokenClick,
  onTokenMove,
  onPaint,
}: Props) {
  const size = board.imageSize
  const { x, y, w, h } = board.view
  const tokenR = board.tileSize * 0.4

  const cellByAxial = useMemo(() => {
    const m = new Map<string, ParsedCell>()
    for (const c of board.cells) m.set(hexKey({ q: c.q, r: c.r }), c)
    return m
  }, [board.cells])

  const [drag, setDrag] = useState<DragState | null>(null)
  const [paintStroke, setPaintStroke] = useState<{ erase: boolean; last: string | null } | null>(null)

  const toImage = (e: React.PointerEvent<SVGSVGElement>): Point | null => {
    const ctm = e.currentTarget.getScreenCTM()
    if (!ctm) return null
    const pt = e.currentTarget.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  const nearestCell = (p: Point): ParsedCell | null => {
    let best: ParsedCell | null = null
    let bestD = Infinity
    for (const c of board.cells) {
      if (!c.isPlayable) continue
      const dx = c.center.x - p.x
      const dy = c.center.y - p.y
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    return best && bestD < board.tileSize * board.tileSize ? best : null
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toImage(e)
    if (!p) return
    e.currentTarget.setPointerCapture(e.pointerId)
    if (painting) {
      const cell = nearestCell(p)
      const key = cell ? hexKey({ q: cell.q, r: cell.r }) : null
      // The whole stroke erases if it starts on a painted hex, else it paints.
      const erase = key ? !!paint?.[key] : false
      setPaintStroke({ erase, last: key })
      if (key) onPaint?.(key, erase)
      return
    }
    const tokenId =
      (e.target as Element).closest('[data-token-id]')?.getAttribute('data-token-id') ?? null
    setDrag({ id: tokenId, ix: p.x, iy: p.y, sx: p.x, sy: p.y, moved: false })
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toImage(e)
    if (!p) return
    if (painting) {
      if (!paintStroke) return
      const cell = nearestCell(p)
      if (!cell) return
      const key = hexKey({ q: cell.q, r: cell.r })
      if (key !== paintStroke.last) {
        onPaint?.(key, paintStroke.erase)
        setPaintStroke({ ...paintStroke, last: key })
      }
      return
    }
    if (!drag) return
    const moved = drag.moved || Math.hypot(p.x - drag.sx, p.y - drag.sy) > board.tileSize * 0.35
    setDrag({ ...drag, ix: p.x, iy: p.y, moved })
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (painting) {
      setPaintStroke(null)
      return
    }
    if (!drag) return
    const cell = nearestCell({ x: drag.ix, y: drag.iy })
    if (drag.id) {
      if (!drag.moved) onTokenClick?.(drag.id)
      else if (cell) onTokenMove?.(drag.id, { q: cell.q, r: cell.r })
    } else if (!drag.moved && cell) {
      onHexClick?.({ q: cell.q, r: cell.r })
    }
    setDrag(null)
  }

  const draggingId = drag?.moved ? drag.id : null
  const previewHex = draggingId ? nearestCell({ x: drag!.ix, y: drag!.iy }) : null

  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      preserveAspectRatio={vAlign === 'center' ? 'xMidYMid meet' : 'xMidYMin meet'}
      className="block h-full w-full touch-none select-none"
      role="img"
      aria-label={`Map ${board.id}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        setDrag(null)
        setPaintStroke(null)
      }}
    >
      <image href={mapImageUrl(board.id)} x={0} y={0} width={size} height={size} />

      {showGrid && (
        <g>
          {board.cells.map((c) =>
            c.isPlayable ? (
              <polygon
                key={`g-${c.col}-${c.row}`}
                points={pointsOf(c)}
                fill="rgba(255,255,255,0.02)"
                stroke={GRID_STROKE}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            ) : null,
          )}
        </g>
      )}

      {/* Elevation heatmap */}
      {showElevation &&
        board.cells.map((c) =>
          c.isPlayable ? (
            <polygon key={`el-${c.col}-${c.row}`} points={pointsOf(c)} fill={ELEV_FILL[c.elevation] ?? 'none'} stroke="none" />
          ) : null,
        )}

      {/* Starting tile hazards (fire / ice / contaminated) */}
      {board.cells.map((c) =>
        c.effect ? <EffectHex key={`fx-${c.col}-${c.row}`} cell={c} kind={c.effect} tileSize={board.tileSize} /> : null,
      )}

      {/* Starting hexes: player deployment (teal) + boss platform(s) (purple) */}
      {showStartHexes &&
        board.cells.map((c) =>
          c.spawnRole ? (
            <polygon
              key={`s-${c.col}-${c.row}`}
              points={pointsOf(c)}
              fill={c.spawnRole === 'player' ? 'rgba(44,208,216,0.22)' : 'rgba(168,85,247,0.22)'}
              stroke={c.spawnRole === 'player' ? '#2cd0d8' : '#a855f7'}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ) : null,
        )}

      {/* Painted hexes (the "fire" sentinel paints a flame instead of a colour) */}
      {paint &&
        Object.entries(paint).map(([key, color]) => {
          const c = cellByAxial.get(key)
          if (!c) return null
          if (color === 'fire') return <EffectHex key={`p-${key}`} cell={c} kind="fire" tileSize={board.tileSize} />
          return <polygon key={`p-${key}`} points={pointsOf(c)} fill={color} stroke={color} strokeWidth={1.5} />
        })}

      {/* Boss footprints — merged into one uniform shape (single closed path,
          junction gaps bridged). Follows the pointer while dragging. */}
      {tokens
        .filter((t) => t.size > 1)
        .map((t) => {
          const hex =
            draggingId === t.id && previewHex ? { q: previewHex.q, r: previewHex.r } : t.pos
          const cells = getBossOccupiedHexes(hex, t.size as 1 | 3 | 7, t.pos.rot ?? 0)
            .map((hx) => cellByAxial.get(hexKey(hx)))
            .filter((c): c is ParsedCell => !!c)
          if (cells.length === 0) return null
          const color = RING_COLOR[t.type]
          return (
            <path
              key={`bf-${t.id}`}
              d={footprintPath(cells)}
              fill={color}
              fillOpacity={0.3}
              stroke={color}
              strokeOpacity={0.9}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
          )
        })}

      {/* Movement arrows */}
      {movements.map((m, i) => {
        const from = cellByAxial.get(hexKey(m.from))?.center
        const to = cellByAxial.get(hexKey(m.to))?.center
        return from && to ? <Arrow key={`mv-${i}`} from={from} to={to} color={m.color} shorten={tokenR} /> : null
      })}

      {/* Tokens */}
      {tokens.map((t) => {
        const dragging = draggingId === t.id
        const center = dragging ? { x: drag!.ix, y: drag!.iy } : cellByAxial.get(hexKey(t.pos))?.center
        if (!center) return null
        return (
          <TokenMarker
            key={t.id}
            token={t}
            center={center}
            r={t.type === 'boss' ? tokenR * 1.15 : tokenR}
            selected={t.id === selectedTokenId}
            dragging={dragging}
          />
        )
      })}
    </svg>
  )
}

function pointsOf(c: ParsedCell): string {
  return cornersToPoints(c.corners)
}

/** A tile hazard on one hex: tinted fill, plus the flame icon for fire. */
function EffectHex({ cell, kind, tileSize }: { cell: ParsedCell; kind: TileEffectKind; tileSize: number }) {
  const s = tileSize * 0.72
  return (
    <g pointerEvents="none">
      <polygon points={pointsOf(cell)} fill={EFFECT_FILL[kind]} stroke="none" />
      {kind === 'fire' && (
        <image
          href={keywordIconUrl('tile_effect_fire')}
          x={cell.center.x - s / 2}
          y={cell.center.y - s / 2}
          width={s}
          height={s}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
    </g>
  )
}

function cornersToPoints(corners: Point[]): string {
  return corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

function Arrow({ from, to, color, shorten }: { from: Point; to: Point; color: string; shorten: number }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  // Start at the (previous) hex centre; stop short of the target token.
  const sx = from.x
  const sy = from.y
  const ex = to.x - ux * shorten
  const ey = to.y - uy * shorten
  const head = shorten * 0.95
  const ang = Math.atan2(ey - sy, ex - sx)
  const p1 = `${ex - head * Math.cos(ang - 0.45)},${ey - head * Math.sin(ang - 0.45)}`
  const p2 = `${ex - head * Math.cos(ang + 0.45)},${ey - head * Math.sin(ang + 0.45)}`
  return (
    <g stroke={color} fill={color} opacity={0.92}>
      <line x1={sx} y1={sy} x2={ex} y2={ey} strokeWidth={3.5} strokeLinecap="round" />
      <polygon points={`${ex},${ey} ${p1} ${p2}`} stroke="none" />
    </g>
  )
}

function TokenMarker({
  token,
  center,
  r,
  selected,
  dragging,
}: {
  token: BoardToken
  center: Point
  r: number
  selected: boolean
  dragging: boolean
}) {
  const clipId = `clip-${token.id.replace(/[^a-zA-Z0-9]/g, '')}`
  const ring = RING_COLOR[token.type]
  return (
    <g data-token-id={token.id} className="cursor-grab" style={{ opacity: dragging ? 0.85 : 1 }}>
      <circle cx={center.x} cy={center.y} r={r} fill="#0b0d11" />
      {token.stem && (
        <>
          <clipPath id={clipId}>
            <circle cx={center.x} cy={center.y} r={r - 1} />
          </clipPath>
          <image
            href={unitPortraitUrl(token.stem, false)}
            x={center.x - r}
            y={center.y - r}
            width={r * 2}
            height={r * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      )}
      <circle
        cx={center.x}
        cy={center.y}
        r={r}
        fill="none"
        stroke={selected || dragging ? '#66f0f5' : ring}
        strokeWidth={selected || dragging ? 4 : 2.5}
      />
      {token.removable && <RemovableBadge cx={center.x + r * 0.72} cy={center.y - r * 0.72} r={r * 0.4} />}
    </g>
  )
}

/** Red ⊗ badge marking an add that's removed when the boss's primes are defeated. */
function RemovableBadge({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const d = r * 0.5
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={r} fill="#cf4632" stroke="#0b0d11" strokeWidth={1.5} />
      <path
        d={`M ${cx - d} ${cy - d} L ${cx + d} ${cy + d} M ${cx - d} ${cy + d} L ${cx + d} ${cy - d}`}
        stroke="#fff"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  )
}
