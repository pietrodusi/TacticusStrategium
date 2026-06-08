import { useMemo, useState } from 'react'
import { ChevronDown, LoaderCircle, TriangleAlert } from 'lucide-react'
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

  const boardId = selected ?? options[0]?.boardId ?? null
  const board = useBoard(boardId)

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">++ Tactica Console ++</p>
          <h1 className="display text-2xl font-bold uppercase tracking-[0.1em] text-bone sm:text-3xl">
            Battle-Plan
          </h1>
        </div>
        {manifest.data && (
          <p className="data hidden text-right text-xs leading-relaxed sm:block">
            {manifest.data.boardCount} maps
            <br />
            {manifest.data.seasonCount} seasons
          </p>
        )}
      </header>

      {/* Console controls */}
      <div className="panel riveted flex flex-wrap items-center gap-4 p-4">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="eyebrow text-brass-dim">Auspex Target</span>
          <div className="relative">
            <select
              value={boardId ?? ''}
              onChange={(e) => setSelected(e.target.value)}
              disabled={!manifest.data}
              className="input w-full appearance-none pr-9 font-mono text-sm"
            >
              {options.map((b) => (
                <option key={b.boardId} value={b.boardId}>
                  {b.boardId}
                  {b.bossTypes.length ? ` — ${b.bossTypes.join(' / ')}` : ` — ${b.types.join('/')}`}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-brass"
            />
          </div>
        </label>

        <label className="flex cursor-pointer select-none items-center gap-2 self-end pb-2 text-sm text-ash">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="h-4 w-4 accent-teal"
          />
          <span className="uppercase tracking-[0.12em]">Grid</span>
        </label>
      </div>

      {manifest.isError && <Notice icon="warn" text="Vox-link failed — could not load the map list." />}
      {board.isError && <Notice icon="warn" text={`Auspex error — could not load board ${boardId}.`} />}
      {(manifest.isLoading || board.isLoading) && <Notice icon="load" text="Acquiring auspex feed…" />}

      {board.data && (
        <div className="space-y-3">
          <div className="panel panel-glow relative overflow-hidden p-1">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="data text-xs">AUSPEX FEED // {board.data.id}</span>
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-blood-bright">
                ● Live
              </span>
            </div>
            <HexGrid board={board.data} showGrid={showGrid} />
          </div>

          {/* Readout + legend */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="data text-xs">
              {board.data.width}×{board.data.height} · boss {board.data.bossSize}-hex · start (
              {board.data.bossStart.q},{board.data.bossStart.r}) · rot {board.data.bossRotation}°
            </p>
            <div className="flex items-center gap-4 text-xs text-ash">
              <Legend color="rgba(212,175,55,0.8)" label="Deployment" />
              <Legend color="rgba(220,38,38,0.8)" label="Boss platform" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Notice({ icon, text }: { icon: 'warn' | 'load'; text: string }) {
  return (
    <div className="panel flex items-center justify-center gap-2.5 p-6 text-sm text-ash">
      {icon === 'load' ? (
        <LoaderCircle size={16} className="animate-spin text-teal" />
      ) : (
        <TriangleAlert size={16} className="text-blood-bright" />
      )}
      <span className="font-mono tracking-wide">{text}</span>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 border border-white/20" style={{ background: color }} />
      <span className="uppercase tracking-[0.1em]">{label}</span>
    </span>
  )
}
