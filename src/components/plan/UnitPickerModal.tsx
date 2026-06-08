import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Unit } from '../../types/units'
import { factionLabel } from '../../utils/format'
import { UnitImage } from '../UnitImage'

export function UnitPickerModal({
  title,
  units,
  selectedIds,
  onSelect,
  onClose,
}: {
  title: string
  units: Unit[]
  selectedIds: string[]
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [faction, setFaction] = useState<string | null>(null)

  const factions = useMemo(
    () => [...new Set(units.map((u) => u.faction).filter((f): f is string => !!f))].sort(),
    [units],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return units.filter(
      (u) => (!faction || u.faction === faction) && (!q || u.name.toLowerCase().includes(q)),
    )
  }, [units, faction, query])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel panel-glow mx-auto flex w-full max-w-2xl flex-col"
        style={{ maxHeight: '85dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <h3 className="display text-base font-bold uppercase tracking-[0.1em] text-bone">{title}</h3>
          <button onClick={onClose} className="text-ash transition-colors hover:text-teal-bright">
            <X size={20} />
          </button>
        </div>

        <div className="px-4">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brass" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="input w-full pl-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-4 py-2.5">
          <Chip active={!faction} onClick={() => setFaction(null)}>
            All
          </Chip>
          {factions.map((f) => (
            <Chip key={f} active={faction === f} onClick={() => setFaction(f)}>
              {factionLabel(f)}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 overflow-y-auto p-4 pt-1 sm:grid-cols-4">
          {filtered.map((u) => {
            const picked = selectedIds.includes(u.id)
            return (
              <button
                key={u.id}
                disabled={picked}
                onClick={() => {
                  onSelect(u.id)
                  onClose()
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
                  picked
                    ? 'cursor-not-allowed border-iron opacity-40'
                    : 'border-iron hover:border-teal hover:bg-steel-2'
                }`}
              >
                <UnitImage
                  stem={u.stem}
                  alt={u.name}
                  className="h-14 w-14 rounded-full object-cover ring-1 ring-iron"
                />
                <span className="text-center text-[0.7rem] leading-tight text-bone">{u.name}</span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-ash">No units match.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.08em] transition-colors ${
        active
          ? 'border-teal bg-teal/10 text-teal-bright'
          : 'border-iron text-ash hover:border-brass-dim hover:text-bone'
      }`}
    >
      {children}
    </button>
  )
}
