import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MAX_PHASE } from '../../stores/planStore'

type Kind = 'deploy' | 'player' | 'enemy'

/**
 * Phase timeline: S (deploy) → turn 1 (player) → turn 1 enemy → turn 2 → … → 6.
 * `phase` is the flat index 0..MAX_PHASE. Only the current phase is shown — `S`
 * (green), `k` for a player turn (blue) or `kE` for an enemy turn (red). The
 * arrows step through the sequence; tapping the current phase toggles
 * player ↔ enemy for that turn.
 */
export function TurnSelector({ phase, onChange }: { phase: number; onChange: (p: number) => void }) {
  const turn = phase === 0 ? 0 : Math.ceil(phase / 2)
  const enemy = phase >= 2 && phase % 2 === 0
  const kind: Kind = phase === 0 ? 'deploy' : enemy ? 'enemy' : 'player'
  const label = phase === 0 ? 'S' : `${turn}${enemy ? 'E' : ''}`
  const title =
    phase === 0 ? 'Deployment' : `Turn ${turn} — ${enemy ? 'enemy' : 'player'} (tap to toggle)`

  // Tap the current phase to swap player ↔ enemy for this turn (no enemy phase
  // exists on the final turn, so it stays player-only).
  const toggle = () => {
    if (turn === 0) return
    if (enemy) onChange(2 * turn - 1)
    else if (2 * turn <= MAX_PHASE) onChange(2 * turn)
  }

  return (
    <div className="flex items-center gap-1.5">
      <Arrow dir="prev" disabled={phase <= 0} onClick={() => onChange(phase - 1)} />
      <PhaseBtn kind={kind} title={title} onClick={toggle}>
        {label}
      </PhaseBtn>
      <Arrow dir="next" disabled={phase >= MAX_PHASE} onClick={() => onChange(phase + 1)} />
    </div>
  )
}

function PhaseBtn({
  kind,
  title,
  onClick,
  children,
}: {
  kind: Kind
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  const color =
    kind === 'deploy'
      ? 'bg-[#22c55e] text-abyss'
      : kind === 'player'
        ? 'bg-teal text-abyss'
        : 'bg-blood-bright text-bone'
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-8 min-w-[2.5rem] rounded px-2 font-mono text-sm font-bold transition-colors ${color}`}
    >
      {children}
    </button>
  )
}

function Arrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-7 place-items-center rounded bg-steel-2 text-ash transition-colors hover:text-bone disabled:opacity-30"
    >
      {dir === 'prev' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  )
}
