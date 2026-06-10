import { Pencil, Trash2 } from 'lucide-react'
import { RING_COLOR } from '../tokenColors'
import { UnitImage } from '../UnitImage'
import type { SavedTeam } from '../../services/firebase/teams'
import type { Unit } from '../../types/units'

/** One saved raid team: member portrait stack (+ brass-ringed MoW tile),
 *  name, count badge, and edit/delete actions. */
export function TeamRow({
  team,
  unitById,
  pressTitle,
  onPress,
  onEdit,
  onDelete,
}: {
  team: SavedTeam
  unitById: Map<string, Unit>
  /** Tooltip for the main row button (describes what tapping does). */
  pressTitle: string
  onPress: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const mow = team.machineOfWar ? unitById.get(team.machineOfWar) : undefined
  return (
    <div className="flex items-center gap-2 rounded-lg border border-iron bg-steel/30 px-2.5 py-2">
      <button onClick={onPress} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" title={pressTitle}>
        <span className="flex shrink-0 -space-x-2">
          {team.members.filter(Boolean).map((id, i) => {
            const u = unitById.get(id!)
            return (
              <UnitImage
                key={`${id}-${i}`}
                stem={u?.stem ?? null}
                alt={u?.name ?? ''}
                className="h-7 w-7 rounded-full border border-abyss object-cover ring-1 ring-iron"
              />
            )
          })}
          {team.machineOfWar && (
            <UnitImage
              stem={mow?.stem ?? null}
              alt={mow?.name ?? 'Machine of War'}
              className="h-7 w-7 rounded-full border border-abyss object-cover"
              style={{ boxShadow: `0 0 0 1.5px ${RING_COLOR.mow}` }}
            />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-bone">{team.name}</span>
          <span className="block font-mono text-[0.6rem] uppercase tracking-[0.08em] text-ash">
            {team.members.filter(Boolean).length}/5{team.machineOfWar ? ' +MoW' : ''}
          </span>
        </span>
      </button>
      <button
        onClick={onEdit}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-iron text-ash transition-colors hover:border-brass-dim hover:text-bone"
        aria-label={`Edit team ${team.name}`}
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={onDelete}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-iron text-ash transition-colors hover:border-blood hover:text-blood-bright"
        aria-label={`Delete team ${team.name}`}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
