import { useMemo, useState } from 'react'
import { Save, X } from 'lucide-react'
import { useRoster } from '../../hooks/useGameData'
import { useTeamMutations } from '../../hooks/useTeams'
import type { SavedTeam } from '../../services/firebase/teams'
import type { Unit } from '../../types/units'
import { UnitSlot } from './UnitSlot'
import { UnitPickerModal } from './UnitPickerModal'

type PickerTarget = { kind: 'member'; index: number } | { kind: 'mow' }

/** Edit a saved raid team: name, the 5 squad slots and the Machine of War. */
export function TeamEditorModal({ team, onClose }: { team: SavedTeam; onClose: () => void }) {
  const { roster, machinesOfWar } = useRoster()
  const { update } = useTeamMutations()

  const [name, setName] = useState(team.name)
  const [members, setMembers] = useState<(string | null)[]>(() =>
    Array.from({ length: 5 }, (_, i) => team.members[i] ?? null),
  )
  const [machineOfWar, setMachineOfWar] = useState(team.machineOfWar)
  const [picker, setPicker] = useState<PickerTarget | null>(null)
  const [error, setError] = useState(false)

  const unitById = useMemo(() => {
    const m = new Map<string, Unit>()
    for (const u of [...roster, ...machinesOfWar]) m.set(u.id, u)
    return m
  }, [roster, machinesOfWar])

  const setMember = (index: number, id: string | null) =>
    setMembers((cur) => {
      const next = cur.map((m) => (m === id ? null : m)) // dedup like setTeamSlot
      next[index] = id
      return next
    })

  const save = () => {
    setError(false)
    update.mutate(
      { id: team.id, name: name.trim().slice(0, 40) || team.name, members, machineOfWar },
      { onSuccess: onClose, onError: () => setError(true) },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-start bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel panel-glow mx-auto flex w-full max-w-md flex-col gap-3 p-4"
        style={{ maxHeight: '88dvh', marginTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="display text-base font-bold uppercase tracking-[0.1em] text-bone">Edit Team</h3>
          <button onClick={onClose} className="text-ash transition-colors hover:text-teal-bright" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <label className="block">
          <span className="eyebrow mb-1 block">Name</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="input w-full" />
        </label>

        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ash/60">Squad — up to 5</p>
          <div className="grid grid-cols-5 gap-2">
            {members.map((id, i) => (
              <UnitSlot
                key={i}
                unit={id ? unitById.get(id) : undefined}
                label={`${i + 1}`}
                onClick={() => setPicker({ kind: 'member', index: i })}
                onClear={() => setMember(i, null)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ash/60">Machine of War</p>
          <div className="max-w-[5.5rem]">
            <UnitSlot
              unit={machineOfWar ? unitById.get(machineOfWar) : undefined}
              label="MoW"
              variant="mow"
              onClick={() => setPicker({ kind: 'mow' })}
              onClear={() => setMachineOfWar(null)}
            />
          </div>
        </div>

        {error && <p className="text-xs text-blood-bright">Save failed — check your connection and retry.</p>}

        <div className="flex justify-end gap-2 border-t border-iron/50 pt-3">
          <button onClick={onClose} className="btn px-3 py-1.5 text-xs">Cancel</button>
          <button onClick={save} disabled={update.isPending} className="btn btn-primary px-3 py-1.5 text-xs">
            <Save size={14} />
            Save changes
          </button>
        </div>

        {/* Inside the stopPropagation panel: closing the picker (backdrop tap)
            must not bubble out and close the editor too. */}
        {picker && (
          <UnitPickerModal
            title={picker.kind === 'mow' ? 'Machine of War' : `Squad Slot ${picker.index + 1}`}
            units={picker.kind === 'mow' ? machinesOfWar : roster}
            selectedIds={
              picker.kind === 'mow'
                ? machineOfWar
                  ? [machineOfWar]
                  : []
                : members.filter((m): m is string => !!m)
            }
            onSelect={(id) => (picker.kind === 'mow' ? setMachineOfWar(id) : setMember(picker.index, id))}
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    </div>
  )
}
