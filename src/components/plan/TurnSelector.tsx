import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { MAX_PHASE } from '../../stores/planStore'

type Kind = 'deploy' | 'player' | 'enemy'

/**
 * Battle timeline in game terms: a fight is 6 *rounds*, each round = a player
 * *turn* then an enemy *turn*. S (deploy) → round 1 player → round 1 enemy →
 * round 2 → … → 6. `phase` is the internal flat index 0..MAX_PHASE. Only the
 * current step is shown — `S` (green), `k` for round k's player turn (blue) or
 * `kE` for its enemy turn (red). The double arrows jump a whole turn; the single
 * arrows replay one unit's single move at a time. The chip is a plain indicator.
 */
export function TurnSelector({
  phase,
  onChange,
  onStep,
  canStepBack,
  canStepForward,
}: {
  phase: number
  onChange: (p: number) => void
  onStep: (dir: 1 | -1) => void
  canStepBack: boolean
  canStepForward: boolean
}) {
  const round = phase === 0 ? 0 : Math.ceil(phase / 2)
  const enemy = phase >= 2 && phase % 2 === 0
  const kind: Kind = phase === 0 ? 'deploy' : enemy ? 'enemy' : 'player'
  const label = phase === 0 ? 'S' : `${round}${enemy ? 'E' : ''}`
  const title = phase === 0 ? 'Deployment' : `Round ${round} — ${enemy ? 'enemy' : 'player'} turn`

  return (
    <div className="flex items-center gap-1">
      <Arrow label="Previous turn" disabled={phase <= 0} onClick={() => onChange(phase - 1)}>
        <ChevronsLeft size={20} />
      </Arrow>
      <Arrow label="Previous move" disabled={!canStepBack} onClick={() => onStep(-1)}>
        <ChevronLeft size={20} />
      </Arrow>
      <PhaseChip kind={kind} title={title}>
        {label}
      </PhaseChip>
      <Arrow label="Next move" disabled={!canStepForward} onClick={() => onStep(1)}>
        <ChevronRight size={20} />
      </Arrow>
      <Arrow label="Next turn" disabled={phase >= MAX_PHASE} onClick={() => onChange(phase + 1)}>
        <ChevronsRight size={20} />
      </Arrow>
    </div>
  )
}

function PhaseChip({
  kind,
  title,
  children,
}: {
  kind: Kind
  title: string
  children: React.ReactNode
}) {
  const color =
    kind === 'deploy'
      ? 'bg-[#22c55e] text-abyss'
      : kind === 'player'
        ? 'bg-teal text-abyss'
        : 'bg-blood-bright text-bone'
  return (
    <span
      title={title}
      className={`grid h-9 min-w-[2.5rem] place-items-center rounded px-2 font-mono text-sm font-bold transition-colors ${color}`}
    >
      {children}
    </span>
  )
}

function Arrow({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-9 w-8 place-items-center rounded bg-steel-2 text-ash transition-colors hover:text-bone disabled:opacity-30"
    >
      {children}
    </button>
  )
}
