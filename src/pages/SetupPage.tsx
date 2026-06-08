import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, X } from 'lucide-react'
import { useBosses, useRoster } from '../hooks/useGameData'
import { usePlanStore } from '../stores/planStore'
import { mapImageUrl, unitPortraitUrl } from '../services/paths'
import { bossDisplayName, factionLabel } from '../utils/format'
import type { BossIndexEntry, Unit } from '../types/units'
import { UnitPickerModal } from '../components/plan/UnitPickerModal'

type PickerTarget = { kind: 'team'; index: number } | { kind: 'mow' }

export function SetupPage() {
  const navigate = useNavigate()
  const bosses = useBosses()
  const { roster, machinesOfWar } = useRoster()
  const { bossUnitId, boardId, team, machineOfWar, selectBoss, selectBoard, setTeamSlot, setMachineOfWar } =
    usePlanStore()
  const [picker, setPicker] = useState<PickerTarget | null>(null)

  const selectedBoss = bosses.data?.bosses.find((b) => b.unitId === bossUnitId) ?? null
  const ready = !!bossUnitId && !!boardId

  const unitById = useMemo(() => {
    const m = new Map<string, Unit>()
    for (const u of roster) m.set(u.id, u)
    for (const u of machinesOfWar) m.set(u.id, u)
    return m
  }, [roster, machinesOfWar])

  return (
    <div className="space-y-9 pb-28">
      <header>
        <p className="eyebrow">++ Muster &amp; Deploy ++</p>
        <h1 className="display text-2xl font-bold uppercase tracking-[0.1em] text-bone sm:text-3xl">
          Battle-Plan
        </h1>
      </header>

      {/* I — Target */}
      <Section numeral="I" title="Select Target">
        {bosses.isLoading && <p className="text-sm text-ash">Loading bosses…</p>}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {bosses.data?.bosses.map((b) => (
            <BossTile
              key={b.unitId}
              boss={b}
              active={b.unitId === bossUnitId}
              onClick={() => selectBoss(b.unitId)}
            />
          ))}
        </div>
      </Section>

      {/* II — Map */}
      {selectedBoss && (
        <Section numeral="II" title="Auspex Map">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {selectedBoss.boardIds.map((id) => (
              <MapTile
                key={id}
                boardId={id}
                active={id === boardId}
                onClick={() => selectBoard(id)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* III — Muster */}
      <Section numeral="III" title="Muster" hint="optional">
        <div className="grid grid-cols-5 gap-2.5 sm:max-w-md">
          {team.map((id, i) => (
            <UnitSlot
              key={i}
              unit={id ? unitById.get(id) : undefined}
              label={`${i + 1}`}
              onClick={() => setPicker({ kind: 'team', index: i })}
              onClear={() => setTeamSlot(i, null)}
            />
          ))}
        </div>
        <div className="mt-4 max-w-[7.5rem]">
          <UnitSlot
            unit={machineOfWar ? unitById.get(machineOfWar) : undefined}
            label="MoW"
            variant="mow"
            onClick={() => setPicker({ kind: 'mow' })}
            onClear={() => setMachineOfWar(null)}
          />
        </div>
      </Section>

      {/* Sticky engage bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-iron bg-abyss/90 backdrop-blur-md">
        <div
          className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <p className="data text-xs leading-tight">
            {selectedBoss ? bossDisplayName(selectedBoss.bossType, selectedBoss.name) : 'No target'}
            {' // '}
            {boardId ?? 'no map'}
          </p>
          <button
            disabled={!ready}
            onClick={() => navigate('/plan/board')}
            className="btn btn-primary"
          >
            Engage
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {picker && (
        <UnitPickerModal
          title={picker.kind === 'mow' ? 'Select Machine of War' : `Squad Slot ${picker.index + 1}`}
          units={picker.kind === 'mow' ? machinesOfWar : roster}
          selectedIds={picker.kind === 'mow' ? (machineOfWar ? [machineOfWar] : []) : team.filter((t): t is string => !!t)}
          onSelect={(id) =>
            picker.kind === 'mow' ? setMachineOfWar(id) : setTeamSlot(picker.index, id)
          }
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}

function Section({
  numeral,
  title,
  hint,
  children,
}: {
  numeral: string
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="data text-sm text-brass">{numeral}</span>
        <h2 className="display text-sm font-bold uppercase tracking-[0.14em] text-bone">{title}</h2>
        {hint && <span className="text-[0.65rem] uppercase tracking-[0.15em] text-ash/60">{hint}</span>}
        <span className="rule ml-1 flex-1" />
      </div>
      {children}
    </section>
  )
}

function BossTile({
  boss,
  active,
  onClick,
}: {
  boss: BossIndexEntry
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
        active ? 'border-teal bg-teal/5 panel-glow' : 'border-iron hover:border-brass-dim'
      }`}
    >
      {boss.imageStem ? (
        <img
          src={unitPortraitUrl(boss.imageStem, true)}
          alt={boss.name}
          loading="lazy"
          className={`h-14 w-14 rounded-full object-cover ring-1 ${active ? 'ring-teal' : 'ring-iron'}`}
        />
      ) : (
        <div className="grid h-14 w-14 place-items-center rounded-full bg-steel-2 text-ash">
          {boss.name.charAt(0)}
        </div>
      )}
      <span className="text-center text-[0.68rem] font-semibold leading-tight text-bone">
        {bossDisplayName(boss.bossType, boss.name)}
      </span>
      <span className="text-[0.6rem] uppercase tracking-wide text-ash/60">
        {factionLabel(boss.faction)}
      </span>
    </button>
  )
}

function MapTile({
  boardId,
  active,
  onClick,
}: {
  boardId: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 overflow-hidden rounded-lg border transition-all ${
        active ? 'border-teal panel-glow' : 'border-iron hover:border-brass-dim'
      }`}
    >
      <img
        src={mapImageUrl(boardId)}
        alt={boardId}
        loading="lazy"
        className="h-28 w-36 object-cover"
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-abyss to-transparent px-2 py-1 text-left font-mono text-[0.65rem] text-bone">
        {boardId}
      </span>
    </button>
  )
}

function UnitSlot({
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
  const accent = variant === 'mow' ? 'border-blood/60' : 'border-iron'
  if (unit) {
    return (
      <div className="relative">
        <button
          onClick={onClick}
          className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-brass-dim bg-steel p-1"
        >
          {unit.stem ? (
            <img
              src={unitPortraitUrl(unit.stem, true)}
              alt={unit.name}
              loading="lazy"
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-steel-2 text-xs text-ash">
              {unit.name.charAt(0)}
            </div>
          )}
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
      className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed ${accent} text-ash transition-colors hover:border-teal hover:text-teal-bright`}
    >
      <Plus size={18} />
      <span className="text-[0.6rem] uppercase tracking-wide">{label}</span>
    </button>
  )
}
