import { useMemo, useState } from 'react'
import { Mountain } from 'lucide-react'
import { paintAtTurn, roundsLeftAt } from '../../stores/planStore'
import { useBosses, usePrimes, useRoster, useSpawns } from '../../hooks/useGameData'
import { useBoard } from '../../hooks/useBoards'
import { HexGrid } from '../HexGrid'
import { DataError } from '../DataError'
import { TurnSelector } from './TurnSelector'
import { RoundsCounter } from './RoundsCounter'
import {
  deriveBoardView,
  instanceTokenDefs,
  targetDef,
  uniqueTokenDefs,
  visibleTokenDefs,
} from './planView'
import type { PlanData } from '../../services/plans/serialize'
import type { Unit } from '../../types/units'

/**
 * Read-only board viewer for a shared plan: same rendering as BoardPage
 * (tokens, footprints, paint, movement arrows) but driven by a PlanData
 * payload and a local phase — zero store writes, no editing affordances.
 */
export function PlanBoardView({ plan }: { plan: PlanData }) {
  const bosses = useBosses()
  const primes = usePrimes()
  const spawns = useSpawns()
  const { roster, machinesOfWar } = useRoster()
  const board = useBoard(plan.boardId)

  const [phase, setPhase] = useState(0)
  const [showElevation, setShowElevation] = useState(false)

  const unitById = useMemo(() => {
    const m = new Map<string, Unit>()
    for (const u of [...roster, ...machinesOfWar]) m.set(u.id, u)
    return m
  }, [roster, machinesOfWar])

  const target = useMemo(
    () => targetDef(plan.bossUnitId, plan.targetKind, bosses.data, primes.data),
    [plan.bossUnitId, plan.targetKind, bosses.data, primes.data],
  )

  const defs = useMemo(
    () =>
      visibleTokenDefs(
        [...uniqueTokenDefs(target, plan.team, unitById), ...instanceTokenDefs(plan.instances, spawns.data)],
        plan.primesDefeated,
      ),
    [target, plan.team, plan.instances, plan.primesDefeated, unitById, spawns.data],
  )

  const { tokens, movements } = useMemo(
    () =>
      board.data
        ? deriveBoardView(defs, plan.positions, phase, board.data)
        : { tokens: [], movements: [] },
    [defs, plan.positions, phase, board.data],
  )

  const visiblePaint = useMemo(() => paintAtTurn(plan.paint, phase), [plan.paint, phase])

  return (
    <>
      <div className="relative flex min-h-0 flex-1 items-start justify-center overflow-hidden">
        {board.isLoading && <p className="font-mono text-sm text-ash">Acquiring auspex feed…</p>}
        {board.isError && (
          <div className="mt-8 max-w-xs">
            <DataError what={`map ${plan.boardId}`} onRetry={() => void board.refetch()} />
          </div>
        )}
        {phase > 0 && board.data && <RoundsCounter left={roundsLeftAt(phase)} />}
        {board.data && (
          <HexGrid
            board={board.data}
            tokens={tokens}
            movements={movements}
            paint={visiblePaint}
            phase={phase}
            showStartHexes={phase === 0}
            showElevation={showElevation}
            vAlign="center"
          />
        )}
      </div>

      <div
        className="z-10 flex items-center justify-between gap-3 border-t border-iron bg-abyss/95 px-3 py-2 backdrop-blur"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={() => setShowElevation((v) => !v)}
          title="Show elevation"
          className={`flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] transition-colors ${showElevation ? 'text-teal-bright' : 'text-ash hover:text-bone'}`}
        >
          <Mountain size={16} />
          Elevation
        </button>
        <TurnSelector phase={phase} onChange={setPhase} />
      </div>
    </>
  )
}
