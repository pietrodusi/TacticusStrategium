import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Brush, Cog, Eraser, LogOut, Mountain, Plus, RotateCw, Save, Skull, SlidersHorizontal, Trash2, Undo2 } from 'lucide-react'
import { usePlanStore, posAtTurn, paintAtTurn, parseHazard, hazardValue, HAZARD_LIFE, roundsLeftAt } from '../stores/planStore'
import { useBosses, usePrimes, useRoster, useSpawns } from '../hooks/useGameData'
import { useBoard } from '../hooks/useBoards'
import { HexGrid, type BoardToken, type BoardMovement } from '../components/HexGrid'
import { EFFECT_FILL, EFFECT_ICON } from '../components/hazards'
import type { TileEffectKind } from '../services/boards/boardService'
import { RING_COLOR } from '../components/tokenColors'
import { keywordIconUrl } from '../services/paths'
import { UnitImage } from '../components/UnitImage'
import { DataError } from '../components/DataError'
import { TurnSelector } from '../components/plan/TurnSelector'
import { SavePlanSheet } from '../components/plan/SavePlanSheet'
import { RoundsCounter } from '../components/plan/RoundsCounter'
import {
  deriveBoardView,
  instanceTokenDefs,
  targetDef,
  uniqueTokenDefs,
  visibleTokenDefs,
  type TokenDef as TrayDef,
} from '../components/plan/planView'
import type { HexCoord } from '../types/strategium'
import type { Unit } from '../types/units'

type Tab = 'allies' | 'enemies' | 'view'
type Side = 'left' | 'right'
interface PaletteType {
  unitId: string
  name: string
  stem: string | null
  side: 'ally' | 'enemy'
}

const PAINT_COLORS = [
  { name: 'Red', value: 'rgba(207,70,50,0.5)' },
  { name: 'Teal', value: 'rgba(44,208,216,0.45)' },
  { name: 'Gold', value: 'rgba(212,175,55,0.5)' },
  { name: 'Green', value: 'rgba(74,222,128,0.45)' },
]

// Sentinel values: HexGrid stamps the hazard tint + keyword icon.
const PAINT_HAZARDS: { name: string; value: TileEffectKind }[] = [
  { name: 'Fire', value: 'fire' },
  { name: 'Ice', value: 'ice' },
  { name: 'Contaminated', value: 'contaminated' },
]

/** Rubber brush sentinel — directly erases any painted tile. */
const ERASER = 'eraser'

export function BoardPage() {
  const navigate = useNavigate()
  const { bossUnitId, targetKind, boardId, team, machineOfWar, currentTurn, positions, paint, instances } = usePlanStore()
  const { seededBoard, primesDefeated, history } = usePlanStore()
  const { setCurrentTurn, placeToken, removeFromTurn, addInstance, setPaint, resetPlan } = usePlanStore()
  const { seedDeployment, setPrimesDefeated, checkpoint, undo } = usePlanStore()

  const bosses = useBosses()
  const primes = usePrimes()
  const { roster, machinesOfWar, isError: rosterError, refetch: refetchRoster } = useRoster()
  const spawns = useSpawns()
  const board = useBoard(boardId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, setPending] = useState<PaletteType | null>(null)
  const [paintOpen, setPaintOpen] = useState(false)
  const [paintSide, setPaintSide] = useState<Side>('left')
  const [paintColor, setPaintColor] = useState(PAINT_COLORS[0].value)
  const [dockOpen, setDockOpen] = useState(true)
  const [tab, setTab] = useState<Tab>('allies')
  const [saveOpen, setSaveOpen] = useState(false)
  const [showElevation, setShowElevation] = useState(false)
  // One undo step per paint stroke: snapshot lazily on the stroke's first hex.
  const strokeNeedsCheckpoint = useRef(false)

  // Lock the page (no scroll/bounce) while planning.
  useEffect(() => {
    const { body, documentElement: html } = document
    const prev = { body: body.style.overflow, over: html.style.overscrollBehavior }
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    return () => {
      body.style.overflow = prev.body
      html.style.overscrollBehavior = prev.over
    }
  }, [])

  // The fight's primary unit (raid boss or prime), normalised to a token def.
  const target = useMemo(
    () => targetDef(bossUnitId, targetKind, bosses.data, primes.data),
    [bossUnitId, targetKind, primes.data, bosses.data],
  )

  // The initial enemy deployment for this fight: boss board-keyed, or a prime
  // keyed primeUnitId → boardId.
  const deployment =
    targetKind === 'prime'
      ? spawns.data?.primeDeployments[bossUnitId ?? '']?.[boardId ?? '']
      : spawns.data?.deployments[boardId ?? '']

  // Seed the board's initial enemy line-up once (turn-0 enemy instances). The
  // deployment lists offset (col,row); resolve to axial via the parsed cells.
  useEffect(() => {
    if (!boardId || !board.data || !spawns.data || seededBoard === boardId) return
    const byColRow = new Map(board.data.cells.map((c) => [`${c.col},${c.row}`, { q: c.q, r: c.r }]))
    const enemies = (deployment?.enemies ?? []).flatMap((e) => {
      const ax = byColRow.get(`${e.col},${e.row}`)
      return ax ? [{ unitId: e.unitId, q: ax.q, r: ax.r, removeAtPrime: e.removeAtPrime }] : []
    })
    seedDeployment(boardId, enemies)
  }, [boardId, board.data, spawns.data, deployment, seededBoard, seedDeployment])

  // Paint visible at the current phase: this phase's marks + those carried over
  // from the previous phase (paint persists one phase, then auto-clears).
  const visiblePaint = useMemo(() => paintAtTurn(paint, currentTurn), [paint, currentTurn])

  // Leaving deployment (S → turn 1) collapses the dock to free up the board.
  const changeTurn = (next: number) => {
    if (currentTurn === 0 && next > 0) setDockOpen(false)
    setCurrentTurn(next)
  }

  const unitById = useMemo(() => {
    const m = new Map<string, Unit>()
    for (const u of [...roster, ...machinesOfWar]) m.set(u.id, u)
    return m
  }, [roster, machinesOfWar])

  // Unique deployable tokens: boss + squad. The Machine of War is NOT deployed
  // directly — it's a loadout pick whose ability-summoned unit (if any) appears
  // in the Allies palette like a summon.
  const uniqueDefs = useMemo<TrayDef[]>(
    () => uniqueTokenDefs(target, team, unitById),
    [target, team, unitById],
  )

  // Spawn palettes (types you can add instances of).
  const allyPalette = useMemo<PaletteType[]>(() => {
    const data = spawns.data
    if (!data) return []
    const ids = new Set<string>()
    for (const cid of [machineOfWar, ...team]) if (cid) for (const sid of data.byUnit[cid] ?? []) ids.add(sid)
    return [...ids].map((unitId) => ({ unitId, name: data.units[unitId]?.name ?? unitId, stem: data.units[unitId]?.stem ?? null, side: 'ally' as const }))
  }, [spawns.data, team, machineOfWar])

  const enemyPalette = useMemo<PaletteType[]>(() => {
    const data = spawns.data
    if (!data || !bossUnitId) return []
    // The target's summonable units + the distinct types from this fight's
    // initial deployment (so the starting adds are addable from the palette too).
    const ids = new Set<string>(data.byUnit[bossUnitId] ?? [])
    for (const e of deployment?.enemies ?? []) ids.add(e.unitId)
    return [...ids].map((unitId) => ({ unitId, name: data.units[unitId]?.name ?? unitId, stem: data.units[unitId]?.stem ?? null, side: 'enemy' as const }))
  }, [spawns.data, bossUnitId, deployment])

  // Spawn instances on the board.
  const instanceDefs = useMemo<TrayDef[]>(
    () => instanceTokenDefs(instances, spawns.data),
    [instances, spawns.data],
  )

  const allDefs = useMemo(() => [...uniqueDefs, ...instanceDefs], [uniqueDefs, instanceDefs])
  // Only boss fights have primes (and thus the Primes-defeated stepper).
  const nPrimes =
    (targetKind === 'boss' && boardId && spawns.data?.deployments[boardId]?.primes.length) || 0

  if (!bossUnitId || !boardId) return <Navigate to="/plan" replace />

  // Effective tokens + movement arrows. An initial add is hidden once enough of
  // the boss's primes are defeated (removeAtPrime ≤ primesDefeated).
  const visibleDefs = visibleTokenDefs(allDefs, primesDefeated)
  const { tokens: boardTokens, movements } = board.data
    ? deriveBoardView(visibleDefs, positions, currentTurn, board.data)
    : { tokens: [] as BoardToken[], movements: [] as BoardMovement[] }

  const selectedDef = allDefs.find((d) => d.id === selectedId) ?? null

  const placeAt = (id: string, hex: HexCoord) => {
    if (!board.data) return
    const def = allDefs.find((d) => d.id === id)
    const rot = def?.type === 'boss' ? posAtTurn(positions[id], currentTurn)?.rot ?? board.data.bossRotation : undefined
    const cur = posAtTurn(positions[id], currentTurn)
    if (cur && cur.q === hex.q && cur.r === hex.r && cur.rot === rot) {
      setSelectedId(null) // dropped in place — nothing to record
      return
    }
    checkpoint()
    placeToken(id, { q: hex.q, r: hex.r, ...(rot !== undefined ? { rot } : {}) })
    setSelectedId(null)
  }

  // Move-mode hex tap: drop a pending spawn (keeps adding), or move the selection.
  const handleHex = (hex: HexCoord) => {
    if (pending) {
      checkpoint()
      const id = addInstance(pending.unitId, pending.side)
      placeToken(id, { q: hex.q, r: hex.r })
      return
    }
    if (selectedId) placeAt(selectedId, hex)
  }

  // Opening the Paint panel activates the paint tool (and clears any selection so
  // taps mark hexes instead of moving units); closing it returns to move mode.
  const togglePaint = () =>
    setPaintOpen((o) => {
      const next = !o
      if (next) { setSelectedId(null); setPending(null) }
      return next
    })

  const selectToken = (id: string) => {
    setPaintOpen(false)
    setPending(null)
    setSelectedId((cur) => (cur === id ? null : id))
  }
  const selectPalette = (p: PaletteType) => {
    setPaintOpen(false)
    setSelectedId(null)
    setPending((cur) => (cur?.unitId === p.unitId && cur.side === p.side ? null : p))
  }
  // Count only instances actually present at the current turn — a spawn removed
  // from here on (a `null` marker, kept for its earlier turns) no longer counts.
  const instCount = (p: PaletteType) =>
    Object.entries(instances).filter(
      ([id, i]) =>
        i.unitId === p.unitId && i.side === p.side && posAtTurn(positions[id], currentTurn) != null,
    ).length

  const teamDefs = uniqueDefs.filter((d) => d.type !== 'boss')
  const bossDef = uniqueDefs.find((d) => d.type === 'boss')

  // Tray order: deployment (turn S) leads with the main units you're placing;
  // later turns lead with the spawn palette, the common pick mid-fight.
  const spawnsFirst = currentTurn > 0
  const teamChips = teamDefs.map((d) => (
    <TrayChip key={d.id} def={d} placed={!!posAtTurn(positions[d.id], currentTurn)} selected={d.id === selectedId} onClick={() => selectToken(d.id)} />
  ))
  const allySpawnChips = allyPalette.map((p) => (
    <PaletteChip key={`a-${p.unitId}`} type={p} count={instCount(p)} selected={pending?.unitId === p.unitId && pending.side === 'ally'} onClick={() => selectPalette(p)} />
  ))
  const bossChips = bossDef
    ? [<TrayChip key={bossDef.id} def={bossDef} placed selected={bossDef.id === selectedId} onClick={() => selectToken(bossDef.id)} />]
    : []
  const enemySpawnChips = enemyPalette.map((p) => (
    <PaletteChip key={`e-${p.unitId}`} type={p} count={instCount(p)} selected={pending?.unitId === p.unitId && pending.side === 'enemy'} onClick={() => selectPalette(p)} />
  ))

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-abyss" style={{ height: '100dvh' }}>
      {/* Top bar */}
      <div className="z-10 flex items-center justify-between gap-3 border-b border-iron bg-abyss/85 px-3 py-3 backdrop-blur" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button onClick={() => { resetPlan(); navigate('/plan') }} className="flex items-center gap-1.5 text-base text-ash transition-colors hover:text-teal-bright">
          <LogOut size={18} className="rotate-180" />
          <span className="uppercase tracking-[0.1em]">Exit</span>
        </button>
        <span className="data min-w-0 truncate text-sm">{target?.name ?? ''} // {boardId}</span>
        <button
          onClick={() => setSaveOpen(true)}
          title="Save to archive"
          className="flex shrink-0 items-center gap-1.5 text-base text-teal-bright transition-opacity hover:opacity-80"
        >
          <Save size={18} />
          <span className="hidden uppercase tracking-[0.1em] sm:inline">Save</span>
        </button>
      </div>

      {/* Board — top-aligned so its unused vertical space pools at the bottom,
          where the tools dock overlays it instead of covering the map. */}
      <div className="relative flex min-h-0 flex-1 items-start justify-center overflow-hidden">
        {board.isLoading && <p className="font-mono text-sm text-ash">Acquiring auspex feed…</p>}
        {board.isError && (
          <div className="mt-8 max-w-xs">
            <DataError what={`map ${boardId}`} onRetry={() => void board.refetch()} />
          </div>
        )}
        {/* Remaining rounds — deployment (S) isn't a round, so it starts at 1 */}
        {currentTurn > 0 && board.data && <RoundsCounter left={roundsLeftAt(currentTurn)} />}
        {/* Secondary data (palettes / unit identities) — board stays usable */}
        {!board.isError && (spawns.isError || rosterError) && (
          <div className="absolute left-1/2 top-10 z-20 -translate-x-1/2">
            <DataError
              compact
              what="unit data"
              onRetry={() => {
                if (spawns.isError) void spawns.refetch()
                refetchRoster()
              }}
            />
          </div>
        )}
        {board.data && (
          <HexGrid
            board={board.data}
            tokens={boardTokens}
            movements={movements}
            paint={visiblePaint}
            phase={currentTurn}
            showStartHexes={currentTurn === 0}
            showElevation={showElevation}
            vAlign={dockOpen ? 'top' : 'center'}
            selectedTokenId={selectedId}
            painting={paintOpen}
            onHexClick={handleHex}
            onTokenClick={selectToken}
            onTokenMove={(id, hex) => placeAt(id, hex)}
            onPaintStart={() => {
              strokeNeedsCheckpoint.current = true
            }}
            onPaint={(key, erase) => {
              if (strokeNeedsCheckpoint.current) {
                strokeNeedsCheckpoint.current = false
                checkpoint()
              }
              // Rubber erases anything. The hazard brush ignores erase-strokes:
              // reapplying a hazard counts as a fresh tile at full lifespan.
              const hazard = parseHazard(paintColor)
              if (paintColor === ERASER) setPaint(key, null)
              else if (hazard) setPaint(key, hazardValue(hazard.kind, HAZARD_LIFE))
              else setPaint(key, erase ? null : paintColor)
            }}
          />
        )}

        {/* Edge rail: Paint (persistent tool) on top, then — clearly separated
            by the larger gap — the contextual actions for the selected unit:
            Remove (non-boss) and Rotate (size-3 footprints, incl. the boss). */}
        <div className={`absolute top-3 z-20 ${paintSide === 'left' ? 'left-0' : 'right-0'} flex flex-col gap-5`}>
          <PaintPanel
            open={paintOpen}
            side={paintSide}
            color={paintColor}
            onToggle={togglePaint}
            onPick={setPaintColor}
            onFlip={() => setPaintSide((s) => (s === 'left' ? 'right' : 'left'))}
          />

          {selectedDef && !paintOpen && (
            <div className="flex flex-col gap-2.5">
              {selectedDef.type !== 'boss' && (
              <SideAction
                side={paintSide}
                danger
                label="Remove"
                icon={<Trash2 size={16} />}
                title={`Remove ${selectedDef.name}`}
                onClick={() => {
                  checkpoint()
                  removeFromTurn(selectedDef.id)
                  setSelectedId(null)
                }}
              />
            )}
            {selectedDef.size === 3 && (
              <SideAction
                side={paintSide}
                label="Rotate"
                icon={<RotateCw size={16} />}
                title={`Rotate ${selectedDef.name}`}
                onClick={() => {
                  const cur =
                    posAtTurn(positions[selectedDef.id], currentTurn) ??
                    (selectedDef.type === 'boss' && board.data
                      ? { q: board.data.bossStart.q, r: board.data.bossStart.r, rot: board.data.bossRotation }
                      : null)
                  if (!cur) return
                  checkpoint()
                  placeToken(selectedDef.id, { q: cur.q, r: cur.r, rot: (cur.rot ?? 0) % 180 === 0 ? 90 : 0 })
                }}
              />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom control dock. The expandable section is in-flow, so it occupies
          the band below the fit-to-width board — the map fills the remaining area
          (fit-to-height) instead of leaving dead space. */}
      <div className="z-10 border-t border-iron bg-abyss/95 backdrop-blur" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {dockOpen && (
          <div className="space-y-3 border-b border-iron/50 px-3 py-3">
            {/* Tabs — unit trays on the left, view options pinned right */}
            <div className="flex items-center gap-1">
              <TabBtn active={tab === 'allies'} onClick={() => setTab('allies')}>Allies</TabBtn>
              <TabBtn active={tab === 'enemies'} onClick={() => setTab('enemies')}>Enemies</TabBtn>
              <button
                onClick={() => setTab('view')}
                title="View options"
                className={`ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${tab === 'view' ? 'bg-steel-2 text-teal-bright' : 'text-ash hover:text-bone'}`}
              >
                <SlidersHorizontal size={14} />
                View
              </button>
            </div>

            {/* Tray — all three tab panels stay mounted, stacked in one grid
                cell (inactive ones invisible), so every tab gets the height of
                the tallest panel and switching tabs never resizes the dock. */}
            <div className="grid">
              <TrayRow visible={tab === 'allies'}>
                {spawnsFirst ? allySpawnChips : teamChips}
                {teamChips.length > 0 && allySpawnChips.length > 0 && <Divider />}
                {spawnsFirst ? teamChips : allySpawnChips}
                {teamChips.length === 0 && allySpawnChips.length === 0 && <Empty text="No allied units" />}
              </TrayRow>
              <TrayRow visible={tab === 'enemies'}>
                {spawnsFirst ? enemySpawnChips : bossChips}
                {bossChips.length > 0 && enemySpawnChips.length > 0 && <Divider />}
                {spawnsFirst ? bossChips : enemySpawnChips}
                {enemySpawnChips.length === 0 && <Empty text="No known spawns" />}
              </TrayRow>
              <div className={`col-start-1 row-start-1 flex w-full flex-col gap-2 ${tab === 'view' ? '' : 'invisible'}`}>
                <ViewToggle
                  active={showElevation}
                  onClick={() => setShowElevation((v) => !v)}
                  icon={<Mountain size={16} />}
                  label="Show elevation"
                  desc="Tint every hex by its height (0–4)"
                />
                {nPrimes > 0 && currentTurn === 0 && (
                  <PrimeStepper
                    count={nPrimes}
                    value={Math.min(primesDefeated, nPrimes)}
                    onChange={setPrimesDefeated}
                  />
                )}
              </div>
            </div>

          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <button
            onClick={() => setDockOpen((o) => !o)}
            title={dockOpen ? 'Hide tools' : 'Show tools'}
            className={`flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] transition-colors ${dockOpen ? 'text-teal-bright' : 'text-ash hover:text-bone'}`}
          >
            <Cog size={16} />
            Tools
          </button>
          <button
            onClick={undo}
            disabled={history.length === 0}
            title="Undo the last map action"
            className="flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] text-ash transition-colors hover:text-bone disabled:pointer-events-none disabled:opacity-35"
          >
            <Undo2 size={16} />
            Undo
          </button>
          <TurnSelector phase={currentTurn} onChange={changeTurn} />
        </div>
      </div>

      {saveOpen && (
        <SavePlanSheet
          defaultName={`${target?.name ?? 'Battle-plan'} · ${boardId}`}
          onClose={() => setSaveOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Collapsible Paint side-panel pinned to the left/right edge of the board.
 * Collapsed it's a slim "Paint" notch; expanded it activates the paint tool and
 * shows the colour palette vertically, with a button at the bottom to flip sides.
 */
function PaintPanel({
  open,
  side,
  color,
  onToggle,
  onPick,
  onFlip,
}: {
  open: boolean
  side: Side
  color: string
  onToggle: () => void
  onPick: (c: string) => void
  onFlip: () => void
}) {
  const round = side === 'left' ? 'rounded-r-xl' : 'rounded-l-xl'

  if (!open) {
    return (
      <button
        onClick={onToggle}
        title="Paint"
        className={`${round} flex flex-col items-center gap-1.5 border border-iron bg-abyss/90 px-1.5 py-3 text-ash backdrop-blur transition-colors hover:border-teal hover:text-teal-bright`}
      >
        <Brush size={16} />
        <span className="rotate-180 text-[0.6rem] font-semibold uppercase tracking-[0.15em]" style={{ writingMode: 'vertical-rl' }}>
          Paint
        </span>
      </button>
    )
  }

  return (
    <div
      className={`${round} flex flex-col items-center gap-2.5 border border-teal/60 bg-abyss/95 px-2 py-3 backdrop-blur`}
    >
      <button onClick={onToggle} title="Close paint" className="flex flex-col items-center gap-1 text-teal-bright">
        <Brush size={16} />
        <span className="text-[0.55rem] font-semibold uppercase tracking-[0.15em]">Paint</span>
      </button>
      <span className="h-px w-7 bg-iron" />
      <div className="flex flex-col gap-2">
        {PAINT_COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => onPick(c.value)}
            title={c.name}
            className={`grid h-7 w-7 place-items-center rounded-full border-2 transition-transform hover:scale-110 ${color === c.value ? 'border-bone' : 'border-iron'}`}
            style={{ background: c.value }}
          />
        ))}
      </div>
      <span className="h-px w-7 bg-iron" />
      <div className="flex flex-col gap-2">
        {PAINT_HAZARDS.map((h) => (
          <button
            key={h.value}
            onClick={() => onPick(h.value)}
            title={h.name}
            className={`grid h-7 w-7 place-items-center overflow-hidden rounded-full border-2 transition-transform hover:scale-110 ${color === h.value ? 'border-bone' : 'border-iron'}`}
            style={{ background: EFFECT_FILL[h.value] }}
          >
            <img src={keywordIconUrl(EFFECT_ICON[h.value])} alt="" className="h-5 w-5" />
          </button>
        ))}
      </div>
      <span className="h-px w-7 bg-iron" />
      <button
        onClick={() => onPick(ERASER)}
        title="Rubber — erase any tile"
        className={`grid h-7 w-7 place-items-center rounded-full border-2 bg-steel transition-transform hover:scale-110 ${color === ERASER ? 'border-bone text-bone' : 'border-iron text-ash'}`}
      >
        <Eraser size={15} />
      </button>
      <span className="h-px w-7 bg-iron" />
      <button
        onClick={onFlip}
        title="Move panel to the other side"
        className="grid h-7 w-7 place-items-center rounded-md border border-iron text-ash transition-colors hover:border-brass-dim hover:text-bone"
      >
        <ArrowLeftRight size={15} />
      </button>
    </div>
  )
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
  desc,
  danger,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  desc: string
  danger?: boolean
}) {
  const activeCls = danger
    ? 'border-blood bg-blood/15 text-blood-bright'
    : 'border-teal bg-teal/10 text-teal-bright'
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${active ? activeCls : 'border-iron text-ash hover:border-brass-dim hover:text-bone'}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-[0.08em]">{label}</span>
        <span className="text-[0.65rem] text-ash">{desc}</span>
      </span>
      <span
        className={`ml-auto h-4 w-4 shrink-0 rounded-full border-2 ${active ? (danger ? 'border-blood-bright bg-blood-bright' : 'border-teal-bright bg-teal-bright') : 'border-iron'}`}
      />
    </button>
  )
}

/** Stepper for how many of the boss's primes are defeated (0..count). Each step
 *  hides one more wave of removable initial adds. */
function PrimeStepper({ count, value, onChange }: { count: number; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-iron px-3 py-2">
      <Skull size={16} className={value > 0 ? 'text-blood-bright' : 'text-ash'} />
      <span className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-bone">Primes defeated</span>
        <span className="text-[0.65rem] text-ash">Hide adds as each prime falls</span>
      </span>
      <div className="ml-auto flex gap-1">
        {Array.from({ length: count + 1 }, (_, k) => k).map((k) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`h-7 min-w-[1.9rem] rounded border px-2 font-mono text-sm font-bold transition-colors ${value === k ? 'border-blood bg-blood/20 text-blood-bright' : 'border-iron text-ash hover:border-brass-dim hover:text-bone'}`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${active ? 'bg-steel-2 text-teal-bright' : 'text-ash hover:text-bone'}`}>
      {children}
    </button>
  )
}

/** A scrollable chip row stacked in the shared tray grid cell. Hidden tabs stay
 *  mounted (invisible) so the cell — and thus the dock — keeps the height of
 *  the tallest panel. min-height reserves room for the horizontal scrollbar. */
function TrayRow({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`col-start-1 row-start-1 flex min-h-[5.75rem] items-center gap-2 overflow-x-auto ${visible ? '' : 'invisible'}`}
    >
      {children}
    </div>
  )
}

function Divider() {
  return <span className="mx-0.5 w-px shrink-0 self-stretch bg-iron" />
}

function Empty({ text }: { text: string }) {
  return <p className="self-center py-4 text-xs text-ash">{text}</p>
}

function TrayChip({ def, placed, selected, onClick }: { def: TrayDef; placed: boolean; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative flex shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${selected ? 'border-teal bg-teal/10' : 'border-iron hover:border-brass-dim'}`}>
      <UnitImage stem={def.stem} alt={def.name} className="h-11 w-11 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${RING_COLOR[def.type]}` }} />
      <span className="w-14 truncate text-center text-[0.6rem] leading-tight text-bone">{def.name}</span>
      {placed && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-abyss bg-teal" />}
    </button>
  )
}

function PaletteChip({ type, count, selected, onClick }: { type: PaletteType; count: number; selected: boolean; onClick: () => void }) {
  const ring = type.side === 'ally' ? RING_COLOR.summon : RING_COLOR.npc
  return (
    <button onClick={onClick} className={`relative flex shrink-0 flex-col items-center gap-1 rounded-lg border border-dashed p-1.5 transition-colors ${selected ? 'border-teal bg-teal/10' : 'border-iron hover:border-brass-dim'}`}>
      <div className="relative">
        <UnitImage stem={type.stem} alt={type.name} className="h-11 w-11 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${ring}` }} />
        <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border border-abyss bg-steel-2 text-bone">
          <Plus size={10} />
        </span>
      </div>
      <span className="w-14 truncate text-center text-[0.6rem] leading-tight text-bone">{type.name}</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full border border-abyss bg-teal px-1 text-[0.55rem] font-bold text-abyss">{count}</span>
      )}
    </button>
  )
}

/** A board-edge action notch (vertical label), same family as the Paint notch. */
function SideAction({
  side,
  label,
  icon,
  title,
  danger,
  onClick,
}: {
  side: Side
  label: string
  icon: React.ReactNode
  title: string
  danger?: boolean
  onClick: () => void
}) {
  const cls = danger
    ? 'border-blood text-blood-bright hover:bg-blood/30'
    : 'border-iron text-ash hover:border-teal hover:text-teal-bright'
  return (
    <button
      onClick={onClick}
      title={title}
      className={`${side === 'left' ? 'rounded-r-xl' : 'rounded-l-xl'} flex flex-col items-center gap-1.5 border bg-abyss/90 px-1.5 py-3 backdrop-blur transition-colors ${cls}`}
    >
      {icon}
      <span className="rotate-180 text-[0.6rem] font-semibold uppercase tracking-[0.15em]" style={{ writingMode: 'vertical-rl' }}>
        {label}
      </span>
    </button>
  )
}
