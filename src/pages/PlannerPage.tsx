import { useMemo, useState } from 'react'
import { useBoard, useBoardsManifest } from '../hooks/useBoards'
import { HexGrid } from '../components/HexGrid'

export function PlannerPage() {
  const manifest = useBoardsManifest()
  const [selected, setSelected] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(true)

  const options = useMemo(() => {
    const boards = manifest.data?.boards ?? []
    return [...boards].sort((a, b) => a.boardId.localeCompare(b.boardId))
  }, [manifest.data])

  // Default to the first board until the user picks one (derived, no effect).
  const boardId = selected ?? options[0]?.boardId ?? null
  const board = useBoard(boardId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Map</span>
          <select
            value={boardId ?? ''}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded border border-line bg-panel-2 px-3 py-2 text-sm"
            disabled={!manifest.data}
          >
            {options.map((b) => (
              <option key={b.boardId} value={b.boardId}>
                {b.boardId}
                {b.bossTypes.length ? ` — ${b.bossTypes.join(' / ')}` : ` — ${b.types.join('/')}`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          Show grid
        </label>

        {manifest.data && (
          <span className="ml-auto text-xs text-gray-500">
            {manifest.data.boardCount} maps · {manifest.data.seasonCount} seasons
          </span>
        )}
      </div>

      {manifest.isError && <Notice text="Failed to load the map list." />}
      {board.isError && <Notice text={`Failed to load board ${boardId}.`} />}
      {(manifest.isLoading || board.isLoading) && <Notice text="Loading…" />}

      {board.data && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-line bg-black">
            <HexGrid board={board.data} showGrid={showGrid} />
          </div>
          <p className="text-xs text-gray-500">
            {board.data.width}×{board.data.height} board · boss size {board.data.bossSize} ·
            start ({board.data.bossStart.q},{board.data.bossStart.r}) · rotation{' '}
            {board.data.bossRotation}° — gold = deployment slots, red = boss platform.
          </p>
        </div>
      )}
    </div>
  )
}

function Notice({ text }: { text: string }) {
  return (
    <div className="rounded border border-line bg-panel p-6 text-center text-sm text-gray-400">
      {text}
    </div>
  )
}
