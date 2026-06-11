import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, Plus, Users } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useMyTeams, useTeamMutations } from '../hooks/useTeams'
import { useRoster } from '../hooks/useGameData'
import { MAX_TEAMS, type SavedTeam } from '../services/firebase/teams'
import { TeamRow } from '../components/plan/TeamRow'
import { TeamEditorModal } from '../components/plan/TeamEditorModal'
import { DataError } from '../components/DataError'
import { useConfirm } from '../hooks/useConfirm'
import type { Unit } from '../types/units'

/** Manage saved raid teams: edit composition/name, delete. */
export function TeamsPage() {
  const { user, status } = useAuthStore()
  const teams = useMyTeams()
  const { remove } = useTeamMutations()
  const { roster, machinesOfWar } = useRoster()
  const [editing, setEditing] = useState<SavedTeam | 'new' | null>(null)
  const { askConfirm, confirmDialog } = useConfirm()

  const unitById = useMemo(() => {
    const m = new Map<string, Unit>()
    for (const u of [...roster, ...machinesOfWar]) m.set(u.id, u)
    return m
  }, [roster, machinesOfWar])

  if (status === 'loading')
    return <p className="pt-8 text-center font-mono text-sm text-ash">Verifying credentials…</p>

  if (!user) {
    return (
      <div className="mx-auto max-w-sm pt-8">
        <div className="panel space-y-3 p-5 text-center">
          <p className="eyebrow">++ Access Restricted ++</p>
          <p className="text-sm text-ash">Sign in to save raid teams and refill your squad with one tap.</p>
          <Link to="/signin" state={{ next: '/teams' }} className="btn btn-primary justify-center">
            <LogIn size={16} />
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-10">
      <header className="mb-1">
        <p className="eyebrow">++ Muster Rolls ++</p>
        <h1 className="display text-2xl font-bold uppercase tracking-[0.1em] text-bone sm:text-3xl">My Teams</h1>
      </header>

      {teams.isLoading && <p className="font-mono text-sm text-ash">Consulting the muster rolls…</p>}
      {teams.isError && <DataError what="your saved teams" onRetry={() => void teams.refetch()} />}
      {teams.data?.length === 0 && (
        <div className="panel p-5 text-center">
          <Users size={22} className="mx-auto mb-2 text-ash" />
          <p className="text-sm text-ash">
            No saved teams yet — create one below, or save your squad from the{' '}
            <Link to="/plan" className="text-teal-bright">Battle-Plan</Link> wizard.
          </p>
        </div>
      )}

      {teams.data?.map((t) => (
        <TeamRow
          key={t.id}
          team={t}
          unitById={unitById}
          pressTitle={`Edit "${t.name}"`}
          onPress={() => setEditing(t)}
          onEdit={() => setEditing(t)}
          onDelete={() =>
            askConfirm({
              title: 'Delete team',
              body: `Delete team "${t.name}"?`,
              confirmLabel: 'Delete',
              danger: true,
              onConfirm: () => remove.mutate(t.id),
            })
          }
        />
      ))}

      {teams.data && (
        <button
          onClick={() => setEditing('new')}
          disabled={teams.data.length >= MAX_TEAMS}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-iron px-2.5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ash transition-colors hover:border-teal hover:text-teal-bright disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={15} />
          New team
        </button>
      )}
      {teams.data && teams.data.length >= MAX_TEAMS && (
        <p className="text-xs text-blood-bright">Team archive full ({MAX_TEAMS}) — delete one first.</p>
      )}

      {editing && (
        <TeamEditorModal team={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}

      {confirmDialog}
    </div>
  )
}
