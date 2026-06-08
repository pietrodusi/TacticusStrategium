import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Turn 0 = deployment ("S"), 1–max = the raid turns. */
export function TurnSelector({
  turn,
  max,
  onChange,
}: {
  turn: number
  max: number
  onChange: (t: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Arrow dir="prev" disabled={turn <= 0} onClick={() => onChange(turn - 1)} />
      <div className="flex gap-1">
        {Array.from({ length: max + 1 }, (_, i) => i).map((i) => {
          const active = i === turn
          const cls = active
            ? i === 0
              ? 'bg-blood text-bone'
              : 'bg-teal text-abyss'
            : 'bg-steel-2 text-ash hover:text-bone'
          return (
            <button
              key={i}
              onClick={() => onChange(i)}
              className={`h-8 w-8 rounded font-mono text-sm font-bold transition-colors ${cls}`}
              title={i === 0 ? 'Deployment' : `Turn ${i}`}
            >
              {i === 0 ? 'S' : i}
            </button>
          )
        })}
      </div>
      <Arrow dir="next" disabled={turn >= max} onClick={() => onChange(turn + 1)} />
    </div>
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
