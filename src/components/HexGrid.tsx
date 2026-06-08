import type { ParsedBoard, ParsedCell } from '../services/boards/boardService'
import { mapImageUrl } from '../services/paths'

/**
 * Read-only render of a parsed board: the map background with the hex grid and
 * spawn markers overlaid. Token placement/movement lands on top of this next.
 */
export function HexGrid({ board, showGrid = true }: { board: ParsedBoard; showGrid?: boolean }) {
  const size = board.imageSize
  const { x, y, w, h } = board.view
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      className="block h-auto w-full touch-none select-none"
      role="img"
      aria-label={`Map ${board.id}`}
    >
      {/* Full image; the viewBox crops to TacticusDB's in-game framing. */}
      <image href={mapImageUrl(board.id)} x={0} y={0} width={size} height={size} />
      {showGrid && (
        <g>
          {board.cells.map((cell) => (
            <HexCell key={`${cell.col},${cell.row}`} cell={cell} />
          ))}
        </g>
      )}
    </svg>
  )
}

function HexCell({ cell }: { cell: ParsedCell }) {
  if (!cell.isPlayable) return null

  const points = cell.corners.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const fill =
    cell.spawnRole === 'boss'
      ? 'rgba(220,38,38,0.30)'
      : cell.spawnRole === 'player'
        ? 'rgba(212,175,55,0.30)'
        : 'rgba(255,255,255,0.04)'

  return (
    <g>
      <polygon
        points={points}
        fill={fill}
        stroke="rgba(212,175,55,0.55)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {cell.spawnRole === 'player' && cell.spawnIndex != null && (
        <Label center={cell.center} text={String(cell.spawnIndex)} />
      )}
      {cell.spawnRole === 'boss' && <Label center={cell.center} text="B" />}
    </g>
  )
}

function Label({ center, text }: { center: { x: number; y: number }; text: string }) {
  return (
    <text
      x={center.x}
      y={center.y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={18}
      fontWeight={700}
      fill="#fff"
      stroke="rgba(0,0,0,0.6)"
      strokeWidth={0.5}
      paintOrder="stroke"
    >
      {text}
    </text>
  )
}
