import { Navigate, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { usePlanStore } from '../stores/planStore'
import { useBosses } from '../hooks/useGameData'
import { useBoard } from '../hooks/useBoards'
import { HexGrid } from '../components/HexGrid'
import { bossDisplayName } from '../utils/format'

/**
 * Full-bleed planning board (rendered outside the app Layout).
 * Step 3 adds the scroll-lock polish + foldable control dock + tokens; for now
 * it shows the chosen map fit-to-width so the setup→board flow works end to end.
 */
export function BoardPage() {
  const navigate = useNavigate()
  const { bossUnitId, boardId } = usePlanStore()
  const bosses = useBosses()
  const board = useBoard(boardId)

  if (!bossUnitId || !boardId) return <Navigate to="/plan" replace />

  const boss = bosses.data?.bosses.find((b) => b.unitId === bossUnitId)

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-abyss" style={{ height: '100dvh' }}>
      {/* slim top bar */}
      <div
        className="z-10 flex items-center justify-between gap-3 border-b border-iron bg-abyss/85 px-3 py-2 backdrop-blur"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate('/plan')}
          className="flex items-center gap-1.5 text-sm text-ash transition-colors hover:text-teal-bright"
        >
          <LogOut size={16} className="rotate-180" />
          <span className="uppercase tracking-[0.1em]">Exit</span>
        </button>
        <span className="data text-xs">
          {boss ? bossDisplayName(boss.bossType, boss.name) : ''} // {boardId}
        </span>
      </div>

      {/* board, fit to width, centered */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {board.isLoading && <p className="font-mono text-sm text-ash">Acquiring auspex feed…</p>}
        {board.data && (
          <div className="h-full w-full">
            <HexGrid board={board.data} />
          </div>
        )}
      </div>

      <p className="py-1.5 text-center font-mono text-[0.62rem] uppercase tracking-[0.2em] text-ash/40">
        Controls — next deployment
      </p>
    </div>
  )
}
