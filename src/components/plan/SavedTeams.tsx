import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, LogIn, Save, Users } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { usePlanStore } from '../../stores/planStore'
import { useMyTeams, useTeamMutations } from '../../hooks/useTeams'
import { MAX_TEAMS, type SavedTeam } from '../../services/firebase/teams'
import { DataError } from '../DataError'
import { TeamRow } from './TeamRow'
import { TeamEditorModal } from './TeamEditorModal'
import type { Unit } from '../../types/units'

/**
 * "My Raid Teams" section of Setup Step III: apply a saved squad+MoW with a
 * tap, save the current selection under a name, edit or delete old ones.
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
  const [editing, setEditing] = useState<SavedTeam | null>(null)

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
            pressTitle={`Use "${t.name}"`}
            onPress={() => applyTeam(t.members, t.machineOfWar)}
            onEdit={() => setEditing(t)}
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

      {editing && <TeamEditorModal team={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
