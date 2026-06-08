import { useMemo } from 'react'
import type { ParsedBoard, ParsedCell } from '../services/boards/boardService'
import { mapImageUrl, unitPortraitUrl } from '../services/paths'
import { getBossOccupiedHexes, hexKey } from '../services/hex/hexUtils'
import type { HexCoord, Point } from '../types/strategium'
import type { TokenPos } from '../stores/planStore'

export interface BoardToken {
  id: string
  type: 'character' | 'mow' | 'boss'
  stem: string | null
  name: string
  size: number // 1 | 3 | 7
  pos: TokenPos
}

interface Props {
  board: ParsedBoard
  showGrid?: boolean
  tokens?: BoardToken[]
  /** hexKey → color, for the current turn. */
  paint?: Record<string, string>
  selectedTokenId?: string | null
  onHexClick?: (hex: HexCoord) => void
  onTokenClick?: (id: string) => void
}

const GRID_STROKE = 'rgba(255,215,0,0.5)'

export function HexGrid({
  board,
  showGrid = true,
  tokens = [],
  paint,
  selectedTokenId,
  onHexClick,
  onTokenClick,
}: Props) {
  const size = board.imageSize
  const { x, y, w, h } = board.view

  const cellByAxial = useMemo(() => {
    const m = new Map<string, ParsedCell>()
    for (const c of board.cells) m.set(hexKey({ q: c.q, r: c.r }), c)
    return m
  }, [board.cells])

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onHexClick) return
    const svg = e.currentTarget
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const loc = pt.matrixTransform(ctm.inverse())
    // Nearest playable cell within ~one tile.
    let best: ParsedCell | null = null
    let bestD = Infinity
    for (const c of board.cells) {
      if (!c.isPlayable) continue
      const dx = c.center.x - loc.x
      const dy = c.center.y - loc.y
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    if (best && bestD < board.tileSize * board.tileSize) onHexClick({ q: best.q, r: best.r })
  }

  const tokenR = board.tileSize * 0.4

  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      className="block h-full w-full touch-none select-none"
      role="img"
      aria-label={`Map ${board.id}`}
      onClick={handleClick}
    >
      <image href={mapImageUrl(board.id)} x={0} y={0} width={size} height={size} />

      {showGrid && (
        <g>
          {board.cells.map((c) =>
            c.isPlayable ? (
              <polygon
                key={`g-${c.col}-${c.row}`}
                points={pointsOf(c)}
                fill="rgba(255,255,255,0.04)"
                stroke={GRID_STROKE}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            ) : null,
          )}
        </g>
      )}

      {/* Painted hexes */}
      {paint &&
        Object.entries(paint).map(([key, color]) => {
          const c = cellByAxial.get(key)
          return c ? <polygon key={`p-${key}`} points={pointsOf(c)} fill={color} stroke={color} strokeWidth={1.5} /> : null
        })}

      {/* Boss footprints (under markers) */}
      {tokens
        .filter((t) => t.size > 1)
        .map((t) =>
          getBossOccupiedHexes(t.pos, t.size as 1 | 3 | 7, t.pos.rot ?? 0).map((hx) => {
            const c = cellByAxial.get(hexKey(hx))
            return c ? (
              <polygon
                key={`bf-${t.id}-${hx.q}-${hx.r}`}
                points={pointsOf(c)}
                fill="rgba(207,70,50,0.32)"
                stroke="rgba(207,70,50,0.85)"
                strokeWidth={2}
              />
            ) : null
          }),
        )}

      {/* Tokens */}
      {tokens.map((t) => {
        const c = cellByAxial.get(hexKey(t.pos))
        if (!c) return null
        return (
          <TokenMarker
            key={t.id}
            token={t}
            center={c.center}
            r={t.type === 'boss' ? tokenR * 1.15 : tokenR}
            selected={t.id === selectedTokenId}
            onClick={onTokenClick}
          />
        )
      })}
    </svg>
  )
}

function pointsOf(c: ParsedCell): string {
  return c.corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

function TokenMarker({
  token,
  center,
  r,
  selected,
  onClick,
}: {
  token: BoardToken
  center: Point
  r: number
  selected: boolean
  onClick?: (id: string) => void
}) {
  const clipId = `clip-${token.id.replace(/[^a-zA-Z0-9]/g, '')}`
  const ring = token.type === 'boss' ? '#cf4632' : token.type === 'mow' ? '#b88f4d' : '#2cd0d8'
  return (
    <g
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(token.id)
      }}
    >
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
        stroke={selected ? '#66f0f5' : ring}
        strokeWidth={selected ? 4 : 2.5}
      />
    </g>
  )
}
