import { Plus, X } from 'lucide-react'
import type { Unit } from '../../types/units'
import { UnitImage } from '../UnitImage'

/** A squad/MoW slot tile: filled (portrait + clear ×) or an empty add button. */
export function UnitSlot({
  unit,
  label,
  variant,
  onClick,
  onClear,
}: {
  unit?: Unit
  label: string
  variant?: 'mow'
  onClick: () => void
  onClear: () => void
}) {
  if (unit) {
    return (
      <div className="relative">
        <button
          onClick={onClick}
          className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-brass-dim bg-steel p-1"
        >
          <UnitImage stem={unit.stem} alt={unit.name} className="h-10 w-10 rounded-full object-cover" />
          <span className="line-clamp-1 w-full px-0.5 text-center text-[0.6rem] leading-tight text-bone">
            {unit.name}
          </span>
        </button>
        <button
          onClick={onClear}
          className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-iron bg-abyss text-ash transition-colors hover:text-blood-bright"
          aria-label="Clear slot"
        >
          <X size={12} />
        </button>
      </div>
    )
  }
  return (
    <button
      onClick={onClick}
      className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-ash transition-colors hover:border-teal hover:text-teal-bright ${
        variant === 'mow' ? 'border-blood/50' : 'border-iron'
      }`}
    >
      <Plus size={18} />
      <span className="text-[0.6rem] uppercase tracking-wide">{label}</span>
    </button>
  )
}
