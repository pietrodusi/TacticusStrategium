import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Lock, Plus, X } from 'lucide-react'
import { useBosses, usePrimes, useRoster } from '../hooks/useGameData'
import { usePlanStore } from '../stores/planStore'
import { mapImageUrl } from '../services/paths'
import { bossDisplayName } from '../utils/format'
import type { BossIndexEntry, PrimeIndexEntry, Unit } from '../types/units'
import { UnitPickerModal } from '../components/plan/UnitPickerModal'
import { UnitImage } from '../components/UnitImage'
import { DataError } from '../components/DataError'

type StepKey = 'boss' | 'map' | 'team'
type PickerTarget = { kind: 'team'; index: number } | { kind: 'mow' }

export function SetupPage() {
  const navigate = useNavigate()
  const bosses = useBosses()
  const primes = usePrimes()
  const { roster, machinesOfWar, isError: rosterError, refetch: refetchRoster } = useRoster()
  const { bossUnitId, targetKind, boardId, team, machineOfWar, selectBoss, selectPrime, selectBoard, setTeamSlot, setMachineOfWar } =
    usePlanStore()

  const [open, setOpen] = useState<StepKey | null>('boss')
  const [picker, setPicker] = useState<PickerTarget | null>(null)

  // Each boss with its primes (mini-bosses), grouped for the triptych picker.
  const groups = useMemo(() => {
    const ps = primes.data?.primes ?? []
    return (bosses.data?.bosses ?? []).map((boss) => ({
      boss,
      primes: ps.filter((p) => p.bossType === boss.bossType),
    }))
  }, [bosses.data, primes.data])

  // The selected fight target (a boss or a prime) — normalised for the later steps.
  const selectedTarget =
    (targetKind === 'prime'
      ? primes.data?.primes.find((p) => p.unitId === bossUnitId)
      : bosses.data?.bosses.find((b) => b.unitId === bossUnitId)) ?? null
  const targetName = selectedTarget
    ? targetKind === 'prime'
      ? selectedTarget.name
      : bossDisplayName(selectedTarget.bossType, selectedTarget.name)
    : ''

  const teamCount = team.filter(Boolean).length
  const ready = !!bossUnitId && !!boardId && teamCount > 0

  const unitById = useMemo(() => {
    const m = new Map<string, Unit>()
    for (const u of [...roster, ...machinesOfWar]) m.set(u.id, u)
    return m
  }, [roster, machinesOfWar])

  // Auto-advance: completing a step collapses it and opens the next.
  const chooseBoss = (id: string) => {
    selectBoss(id)
    setOpen('map')
  }
  const choosePrime = (id: string) => {
    selectPrime(id)
    setOpen('map')
  }
  const chooseMap = (id: string) => {
    selectBoard(id)
    setOpen('team')
  }
  const toggle = (key: StepKey) => setOpen((prev) => (prev === key ? null : key))

  return (
    <div className="space-y-3 pb-28">
      <header className="mb-1">
        <p className="eyebrow">++ Muster &amp; Deploy ++</p>
        <h1 className="display text-2xl font-bold uppercase tracking-[0.1em] text-bone sm:text-3xl">
          Battle-Plan
        </h1>
      </header>

      {/* I — Target: raid boss (centre) flanked by its primes */}
      <Step
        numeral="I"
        title="Target"
        open={open === 'boss'}
        onToggle={() => toggle('boss')}
        summary={selectedTarget && <TargetSummary stem={selectedTarget.imageStem} name={targetName} prime={targetKind === 'prime'} />}
      >
        {bosses.isLoading && <p className="text-sm text-ash">Loading bosses…</p>}
        {(bosses.isError || primes.isError) && (
          <div className="mb-3">
            <DataError
              what="the boss catalog"
              onRetry={() => {
                if (bosses.isError) void bosses.refetch()
                if (primes.isError) void primes.refetch()
              }}
            />
          </div>
        )}
        <p className="mb-3 text-xs uppercase tracking-[0.12em] text-ash/60">
          Pick the raid boss, or a prime on either side
        </p>
        <div className="space-y-2.5">
          {groups.map((g) => (
            <BossGroupRow
              key={g.boss.unitId}
              boss={g.boss}
              primes={g.primes}
              activeUnitId={bossUnitId}
              targetKind={targetKind}
              onBoss={() => chooseBoss(g.boss.unitId)}
              onPrime={choosePrime}
            />
          ))}
        </div>
      </Step>

      {/* II — Map */}
      <Step
        numeral="II"
        title="Map"
        locked={!bossUnitId}
        open={open === 'map'}
        onToggle={() => toggle('map')}
        summary={boardId && <span className="data text-xs">{boardId}</span>}
      >
        {selectedTarget && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {selectedTarget.boardIds.map((id) => (
              <MapTile key={id} boardId={id} active={id === boardId} onClick={() => chooseMap(id)} />
            ))}
          </div>
        )}
      </Step>

      {/* III — Raid Team */}
      <Step
        numeral="III"
        title="Raid Team"
        open={open === 'team'}
        onToggle={() => toggle('team')}
        summary={<TeamSummary count={teamCount} hasMoW={!!machineOfWar} />}
      >
        {rosterError && (
          <div className="mb-3">
            <DataError what="the character roster" onRetry={refetchRoster} />
          </div>
        )}
        <p className="mb-3 text-xs uppercase tracking-[0.12em] text-ash/60">Squad — up to 5</p>
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
        <p className="mb-3 mt-5 text-xs uppercase tracking-[0.12em] text-ash/60">Machine of War</p>
        <div className="max-w-[5.5rem]">
          <UnitSlot
            unit={machineOfWar ? unitById.get(machineOfWar) : undefined}
            label="MoW"
            variant="mow"
            onClick={() => setPicker({ kind: 'mow' })}
            onClear={() => setMachineOfWar(null)}
          />
        </div>
      </Step>

      {/* Sticky engage bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-iron bg-abyss/90 backdrop-blur-md">
        <div
          className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ash">
            {ready ? 'Ready to deploy' : !bossUnitId ? 'Pick a target' : !boardId ? 'Pick a map' : 'Add a squad member'}
          </p>
          <button disabled={!ready} onClick={() => navigate('/plan/board')} className="btn btn-primary">
            Engage
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {picker && (
        <UnitPickerModal
          title={picker.kind === 'mow' ? 'Machine of War' : `Squad Slot ${picker.index + 1}`}
          units={picker.kind === 'mow' ? machinesOfWar : roster}
          selectedIds={
            picker.kind === 'mow'
              ? machineOfWar
                ? [machineOfWar]
                : []
              : team.filter((t): t is string => !!t)
          }
          onSelect={(id) => (picker.kind === 'mow' ? setMachineOfWar(id) : setTeamSlot(picker.index, id))}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}

function Step({
  numeral,
  title,
  open,
  locked,
  summary,
  onToggle,
  children,
}: {
  numeral: string
  title: string
  open: boolean
  locked?: boolean
  summary?: React.ReactNode
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className={`panel overflow-hidden ${open ? 'panel-glow' : ''}`}>
      <button
        type="button"
        disabled={locked}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:cursor-not-allowed"
      >
        <span className={`data text-sm ${locked ? 'text-iron' : 'text-brass'}`}>{numeral}</span>
        <span
          className={`display text-sm font-bold uppercase tracking-[0.13em] ${
            locked ? 'text-ash/40' : 'text-bone'
          }`}
        >
          {title}
        </span>
        <div className="ml-auto flex items-center gap-3 overflow-hidden">
          {!open && <div className="flex items-center gap-2 overflow-hidden">{summary}</div>}
          {locked ? (
            <Lock size={15} className="text-ash/30" />
          ) : (
            <ChevronDown
              size={18}
              className={`shrink-0 text-ash transition-transform ${open ? 'rotate-180' : ''}`}
            />
          )}
        </div>
      </button>
      {open && <div className="border-t border-iron/60 p-4">{children}</div>}
    </section>
  )
}

function TargetSummary({ stem, name, prime }: { stem: string | null; name: string; prime: boolean }) {
  return (
    <>
      <UnitImage stem={stem} alt={name} className="h-7 w-7 shrink-0 rounded-full object-cover" />
      <span className="truncate text-xs font-semibold text-bone">
        {prime && <span className="text-ash">Prime · </span>}
        {name}
      </span>
    </>
  )
}

/** One boss flanked by its primes: prime 1 (left) · boss (centre) · prime 2 (right). */
function BossGroupRow({
  boss,
  primes,
  activeUnitId,
  targetKind,
  onBoss,
  onPrime,
}: {
  boss: BossIndexEntry
  primes: PrimeIndexEntry[]
  activeUnitId: string | null
  targetKind: 'boss' | 'prime'
  onBoss: () => void
  onPrime: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-[1fr_1.5fr_1fr] items-center gap-2 rounded-lg border border-iron/60 bg-steel/30 p-2">
      <PrimeTile
        prime={primes[0]}
        active={targetKind === 'prime' && primes[0]?.unitId === activeUnitId}
        onClick={() => primes[0] && onPrime(primes[0].unitId)}
      />
      <BossTile boss={boss} active={targetKind === 'boss' && boss.unitId === activeUnitId} onClick={onBoss} />
      <PrimeTile
        prime={primes[1]}
        active={targetKind === 'prime' && primes[1]?.unitId === activeUnitId}
        onClick={() => primes[1] && onPrime(primes[1].unitId)}
      />
    </div>
  )
}

function PrimeTile({ prime, active, onClick }: { prime?: PrimeIndexEntry; active: boolean; onClick: () => void }) {
  if (!prime) return <span aria-hidden />
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-md border p-1.5 transition-all ${
        active ? 'border-blood bg-blood/10' : 'border-iron/70 hover:border-brass-dim'
      }`}
    >
      <UnitImage
        stem={prime.imageStem}
        alt={prime.name}
        className={`h-10 w-10 rounded-full object-cover ring-1 ${active ? 'ring-blood-bright' : 'ring-iron'}`}
      />
      <span className="line-clamp-1 w-full text-center text-[0.6rem] font-medium leading-tight text-ash">
        {prime.name}
      </span>
    </button>
  )
}

function TeamSummary({ count, hasMoW }: { count: number; hasMoW: boolean }) {
  return (
    <span className="data text-xs">
      {count}/5{hasMoW ? ' +MoW' : ''}
    </span>
  )
}

function BossTile({ boss, active, onClick }: { boss: BossIndexEntry; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all ${
        active ? 'border-teal bg-teal/5' : 'border-iron hover:border-brass-dim'
      }`}
    >
      <UnitImage
        stem={boss.imageStem}
        alt={boss.name}
        className={`h-14 w-14 rounded-full object-cover ring-1 ${active ? 'ring-teal' : 'ring-iron'}`}
      />
      <span className="text-center text-[0.68rem] font-semibold leading-tight text-bone">
        {bossDisplayName(boss.bossType, boss.name)}
      </span>
    </button>
  )
}

function MapTile({ boardId, active, onClick }: { boardId: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-lg border transition-all ${
        active ? 'border-teal' : 'border-iron hover:border-brass-dim'
      }`}
    >
      <img src={mapImageUrl(boardId)} alt={boardId} loading="lazy" className="aspect-square w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-abyss to-transparent px-2 py-1 text-left font-mono text-[0.65rem] text-bone">
        {boardId}
      </span>
      {active && <span className="absolute inset-0 ring-2 ring-inset ring-teal" />}
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
