import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MAX_PHASE, TURN_COUNT } from '../../stores/planStore'

type Kind = 'deploy' | 'player' | 'enemy' | 'idle'

/**
 * Phase timeline: S (deploy) → turn 1 (player) → turn 1 enemy → turn 2 → … → 5E.
 * `phase` is the flat index 0..MAX_PHASE. A number button is blue on its player
 * phase, red on its enemy phase; pressing the active number toggles the two, and
 * advancing steps player → enemy → next player.
 */
export function TurnSelector({ phase, onChange }: { phase: number; onChange: (p: number) => void }) {
  const turn = phase === 0 ? 0 : Math.ceil(phase / 2)
  const enemy = phase >= 2 && phase % 2 === 0

  const pressTurn = (k: number) => {
    if (turn !== k) onChange(2 * k - 1) // jump to this turn's player phase
    else if (enemy) onChange(2 * k - 1) // enemy → player
    else if (2 * k <= MAX_PHASE) onChange(2 * k) // player → enemy (when that phase exists)
    // else: last turn, player-only — no toggle
  }

  return (
    <div className="flex items-center gap-1">
      <Arrow dir="prev" disabled={phase <= 0} onClick={() => onChange(phase - 1)} />
      <PhaseBtn kind={phase === 0 ? 'deploy' : 'idle'} title="Deployment" onClick={() => onChange(0)}>
        S
      </PhaseBtn>
      {Array.from({ length: TURN_COUNT }, (_, i) => i + 1).map((k) => {
        const kind: Kind = turn === k ? (enemy ? 'enemy' : 'player') : 'idle'
        return (
          <PhaseBtn
            key={k}
            kind={kind}
            title={`Turn ${k}${kind === 'enemy' ? ' — enemy' : kind === 'player' ? ' — player' : ''}`}
            onClick={() => pressTurn(k)}
          >
            {k}
          </PhaseBtn>
        )
      })}
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
        : kind === 'enemy'
          ? 'bg-blood-bright text-bone'
          : 'bg-steel-2 text-ash hover:text-bone'
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-8 w-8 rounded font-mono text-sm font-bold transition-colors ${color}`}
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
