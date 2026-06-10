import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, LogIn, Save, Trash2, Users } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { usePlanStore } from '../../stores/planStore'
import { useMyTeams, useTeamMutations } from '../../hooks/useTeams'
import { MAX_TEAMS, type SavedTeam } from '../../services/firebase/teams'
import { UnitImage } from '../UnitImage'
import { DataError } from '../DataError'
import type { Unit } from '../../types/units'

/**
 * "My Raid Teams" section of Setup Step III: apply a saved squad+MoW with a
 * tap, save the current selection under a name, delete old ones.
 */
export function SavedTeams({ unitById }: { unitById: Map<string, Unit> }) {
  const { user, status } = useAuthStore()
  const team = usePlanStore((s) => s.team)
  const machineOfWar = usePlanStore((s) => s.machineOfWar)
  const applyTeam = usePlanStore((s) => s.applyTeam)
  const teams = useMyTeams()
  const { create, remove } = useTeamMutations()

  const [name, setName] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  if (status === 'loading') return null

  const heading = <p className="eyebrow mb-2 mt-5">My Raid Teams</p>

  if (!user) {
    return (
      <>
        {heading}
        <p className="text-xs text-ash">
          <Link to="/signin" state={{ next: '/plan' }} className="inline-flex items-center gap-1 text-teal-bright">
            <LogIn size={12} /> Sign in
          </Link>{' '}
          to save squads and refill them with one tap.
        </p>
      </>
    )
  }

  const teamCount = team.filter(Boolean).length
  const atCap = (teams.data?.length ?? 0) >= MAX_TEAMS
  const firstName = team.map((id) => (id ? unitById.get(id)?.name : null)).find(Boolean)

  const saveCurrent = () => {
    const trimmed = (name.trim() || `${firstName ?? 'New'} team`).slice(0, 40)
    setName('') // clear optimistically; restored on failure
    create.mutate(
      { uid: user.uid, name: trimmed, members: team, machineOfWar },
      {
        onSuccess: () => {
          setSavedFlash(true)
          setTimeout(() => setSavedFlash(false), 1500)
        },
        onError: () => setName(trimmed),
      },
    )
  }

  return (
    <>
      {heading}
      {teams.isError && <DataError compact what="your saved teams" onRetry={() => void teams.refetch()} />}
      <div className="space-y-2">
        {teams.data?.map((t) => (
          <TeamRow
            key={t.id}
            team={t}
            unitById={unitById}
            onApply={() => applyTeam(t.members, t.machineOfWar)}
            onDelete={() => confirm(`Delete team "${t.name}"?`) && remove.mutate(t.id)}
          />
        ))}
        {teams.data?.length === 0 && (
          <p className="text-xs text-ash">No saved teams yet — muster a squad above and save it.</p>
        )}

        {/* Save the current selection */}
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-iron px-2.5 py-2">
          <Users size={15} className="shrink-0 text-ash" />
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={teamCount ? `${firstName} team` : 'Pick a squad first…'}
            disabled={!teamCount}
            className="input min-w-0 flex-1 px-2 py-1 text-xs"
          />
          <button
            onClick={saveCurrent}
            disabled={!teamCount || atCap || create.isPending}
            className="btn shrink-0 px-2.5 py-1.5 text-xs"
            title="Save current team"
          >
            {savedFlash ? <Check size={14} /> : <Save size={14} />}
            Save
          </button>
        </div>
        {atCap && <p className="text-xs text-blood-bright">Team archive full ({MAX_TEAMS}) — delete one first.</p>}
        {create.isError && <p className="text-xs text-blood-bright">Save failed — check your connection and retry.</p>}
      </div>
    </>
  )
}

function TeamRow({
  team,
  unitById,
  onApply,
  onDelete,
}: {
  team: SavedTeam
  unitById: Map<string, Unit>
  onApply: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-iron bg-steel/30 px-2.5 py-2">
      <button onClick={onApply} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" title={`Use "${team.name}"`}>
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
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-bone">{team.name}</span>
          <span className="block font-mono text-[0.6rem] uppercase tracking-[0.08em] text-ash">
            {team.members.filter(Boolean).length}/5{team.machineOfWar ? ' +MoW' : ''}
          </span>
        </span>
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
