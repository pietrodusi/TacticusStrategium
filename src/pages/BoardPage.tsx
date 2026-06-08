import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Brush, ChevronDown, LogOut, Plus, RotateCw, Trash2 } from 'lucide-react'
import { usePlanStore, posAtTurn, MAX_TURN } from '../stores/planStore'
import { useBosses, useRoster, useSpawns } from '../hooks/useGameData'
import { useBoard } from '../hooks/useBoards'
import { HexGrid, type BoardToken, type BoardMovement } from '../components/HexGrid'
import { RING_COLOR, type TokenKind } from '../components/tokenColors'
import { UnitImage } from '../components/UnitImage'
import { TurnSelector } from '../components/plan/TurnSelector'
import { bossDisplayName } from '../utils/format'
import type { HexCoord } from '../types/strategium'
import type { Unit } from '../types/units'

type Tool = 'move' | 'paint'
type Tab = 'allies' | 'enemies'

interface TrayDef {
  id: string
  type: TokenKind
  stem: string | null
  name: string
  size: number
}
interface PaletteType {
  unitId: string
  name: string
  stem: string | null
  side: 'ally' | 'enemy'
}

const PAINT_COLORS = [
  { name: 'Teal', value: 'rgba(44,208,216,0.45)' },
  { name: 'Red', value: 'rgba(207,70,50,0.5)' },
  { name: 'Gold', value: 'rgba(212,175,55,0.5)' },
  { name: 'Green', value: 'rgba(74,222,128,0.45)' },
]

export function BoardPage() {
  const navigate = useNavigate()
  const { bossUnitId, boardId, team, machineOfWar, currentTurn, positions, paint, instances } = usePlanStore()
  const { setCurrentTurn, placeToken, removeToken, addInstance, removeInstance, setPaint } = usePlanStore()

  const bosses = useBosses()
  const { roster, machinesOfWar } = useRoster()
  const spawns = useSpawns()
  const board = useBoard(boardId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, setPending] = useState<PaletteType | null>(null)
  const [tool, setTool] = useState<Tool>('move')
  const [paintColor, setPaintColor] = useState(PAINT_COLORS[0].value)
  const [dockOpen, setDockOpen] = useState(true)
  const [tab, setTab] = useState<Tab>('allies')

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

  const boss = bosses.data?.bosses.find((b) => b.unitId === bossUnitId)
  const unitById = useMemo(() => {
    const m = new Map<string, Unit>()
    for (const u of [...roster, ...machinesOfWar]) m.set(u.id, u)
    return m
  }, [roster, machinesOfWar])

  // Unique tokens: boss, MoW, squad.
  const uniqueDefs = useMemo<TrayDef[]>(() => {
    const list: TrayDef[] = []
    if (boss) list.push({ id: boss.unitId, type: 'boss', stem: boss.imageStem, name: bossDisplayName(boss.bossType, boss.name), size: boss.bossSize })
    if (machineOfWar) {
      const u = unitById.get(machineOfWar)
      if (u) list.push({ id: u.id, type: 'mow', stem: u.stem, name: u.name, size: 1 })
    }
    for (const id of team) {
      if (!id) continue
      const u = unitById.get(id)
      if (u) list.push({ id: u.id, type: 'character', stem: u.stem, name: u.name, size: 1 })
    }
    return list
  }, [boss, machineOfWar, team, unitById])

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
    return (data.byUnit[bossUnitId] ?? []).map((unitId) => ({ unitId, name: data.units[unitId]?.name ?? unitId, stem: data.units[unitId]?.stem ?? null, side: 'enemy' as const }))
  }, [spawns.data, bossUnitId])

  // Spawn instances on the board.
  const instanceDefs = useMemo<TrayDef[]>(() => {
    const data = spawns.data
    return Object.entries(instances).map(([id, inst]) => {
      const u = data?.units[inst.unitId]
      return { id, type: (inst.side === 'ally' ? 'summon' : 'npc') as TokenKind, stem: u?.stem ?? null, name: u?.name ?? inst.unitId, size: 1 }
    })
  }, [instances, spawns.data])

  const allDefs = useMemo(() => [...uniqueDefs, ...instanceDefs], [uniqueDefs, instanceDefs])

  if (!bossUnitId || !boardId) return <Navigate to="/plan" replace />

  // Effective tokens + movement arrows.
  const boardTokens: BoardToken[] = []
  const movements: BoardMovement[] = []
  if (board.data) {
    for (const d of allDefs) {
      const fallback = d.type === 'boss' ? { q: board.data.bossStart.q, r: board.data.bossStart.r, rot: board.data.bossRotation } : null
      const pos = posAtTurn(positions[d.id], currentTurn) ?? fallback
      if (pos) boardTokens.push({ ...d, pos })
      if (currentTurn > 0) {
        const prev = posAtTurn(positions[d.id], currentTurn - 1) ?? fallback
        if (pos && prev && (pos.q !== prev.q || pos.r !== prev.r)) {
          movements.push({ from: { q: prev.q, r: prev.r }, to: { q: pos.q, r: pos.r }, color: RING_COLOR[d.type] })
        }
      }
    }
  }

  const selectedDef = allDefs.find((d) => d.id === selectedId) ?? null

  const placeAt = (id: string, hex: HexCoord) => {
    if (!board.data) return
    const def = allDefs.find((d) => d.id === id)
    const rot = def?.type === 'boss' ? posAtTurn(positions[id], currentTurn)?.rot ?? board.data.bossRotation : undefined
    placeToken(id, { q: hex.q, r: hex.r, ...(rot !== undefined ? { rot } : {}) })
    setSelectedId(null)
  }

  // Move-mode hex tap: drop a pending spawn (keeps adding), or move the selection.
  const handleHex = (hex: HexCoord) => {
    if (pending) {
      const id = addInstance(pending.unitId, pending.side)
      placeToken(id, { q: hex.q, r: hex.r })
      return
    }
    if (selectedId) placeAt(selectedId, hex)
  }

  const selectToken = (id: string) => {
    setPending(null)
    setSelectedId((cur) => (cur === id ? null : id))
  }
  const selectPalette = (p: PaletteType) => {
    setSelectedId(null)
    setPending((cur) => (cur?.unitId === p.unitId && cur.side === p.side ? null : p))
  }
  const instCount = (p: PaletteType) =>
    Object.values(instances).filter((i) => i.unitId === p.unitId && i.side === p.side).length

  const teamDefs = uniqueDefs.filter((d) => d.type !== 'boss')
  const bossDef = uniqueDefs.find((d) => d.type === 'boss')

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-abyss" style={{ height: '100dvh' }}>
      {/* Top bar */}
      <div className="z-10 flex items-center justify-between gap-3 border-b border-iron bg-abyss/85 px-3 py-2 backdrop-blur" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <button onClick={() => navigate('/plan')} className="flex items-center gap-1.5 text-sm text-ash transition-colors hover:text-teal-bright">
          <LogOut size={16} className="rotate-180" />
          <span className="uppercase tracking-[0.1em]">Exit</span>
        </button>
        <span className="data truncate text-xs">{boss ? bossDisplayName(boss.bossType, boss.name) : ''} // {boardId}</span>
      </div>

      {/* Board */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {board.isLoading && <p className="font-mono text-sm text-ash">Acquiring auspex feed…</p>}
        {board.data && (
          <HexGrid
            board={board.data}
            tokens={boardTokens}
            movements={movements}
            paint={paint[currentTurn]}
            selectedTokenId={selectedId}
            painting={tool === 'paint'}
            onHexClick={handleHex}
            onTokenClick={selectToken}
            onTokenMove={(id, hex) => placeAt(id, hex)}
            onPaint={(key, erase) => setPaint(key, erase ? null : paintColor)}
          />
        )}
        <p className="pointer-events-none absolute left-3 top-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ash/50">
          {tool === 'paint'
            ? 'Paint — drag to mark, drag painted to erase'
            : pending
              ? `Add ${pending.name} — tap hexes`
              : selectedDef
                ? `Move ${selectedDef.name}`
                : 'Select a unit'}
        </p>
      </div>

      {/* Bottom control dock */}
      <div className="z-10 border-t border-iron bg-abyss/95 backdrop-blur" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {dockOpen && (
          <div className="space-y-3 border-b border-iron/50 px-3 py-3">
            {/* Tabs */}
            <div className="flex gap-1">
              <TabBtn active={tab === 'allies'} onClick={() => setTab('allies')}>Allies</TabBtn>
              <TabBtn active={tab === 'enemies'} onClick={() => setTab('enemies')}>Enemies</TabBtn>
            </div>

            {/* Tray */}
            <div className="no-scrollbar flex min-h-[4.5rem] gap-2 overflow-x-auto">
              {tab === 'allies' ? (
                <>
                  {teamDefs.map((d) => (
                    <TrayChip key={d.id} def={d} placed={!!posAtTurn(positions[d.id], currentTurn)} selected={d.id === selectedId} onClick={() => selectToken(d.id)} />
                  ))}
                  {allyPalette.length > 0 && <Divider />}
                  {allyPalette.map((p) => (
                    <PaletteChip key={`a-${p.unitId}`} type={p} count={instCount(p)} selected={pending?.unitId === p.unitId && pending.side === 'ally'} onClick={() => selectPalette(p)} />
                  ))}
                  {teamDefs.length === 0 && allyPalette.length === 0 && <Empty text="No allied units" />}
                </>
              ) : (
                <>
                  {bossDef && (
                    <TrayChip def={bossDef} placed selected={bossDef.id === selectedId} onClick={() => selectToken(bossDef.id)} />
                  )}
                  {enemyPalette.length > 0 && <Divider />}
                  {enemyPalette.map((p) => (
                    <PaletteChip key={`e-${p.unitId}`} type={p} count={instCount(p)} selected={pending?.unitId === p.unitId && pending.side === 'enemy'} onClick={() => selectPalette(p)} />
                  ))}
                  {enemyPalette.length === 0 && <Empty text="No known spawns" />}
                </>
              )}
            </div>

            {/* Tools */}
            <div className="flex flex-wrap items-center gap-2">
              <ToolButton active={tool === 'paint'} onClick={() => { setTool((t) => (t === 'paint' ? 'move' : 'paint')); setSelectedId(null); setPending(null) }} icon={<Brush size={15} />} label="Paint" />
              {tool === 'paint' && (
                <div className="flex items-center gap-1.5">
                  {PAINT_COLORS.map((c) => (
                    <button key={c.value} onClick={() => setPaintColor(c.value)} title={c.name} className={`h-6 w-6 rounded-full border-2 ${paintColor === c.value ? 'border-bone' : 'border-iron'}`} style={{ background: c.value }} />
                  ))}
                </div>
              )}
              {selectedDef && tool === 'move' && (
                <div className="ml-auto flex items-center gap-2">
                  {selectedDef.type === 'boss' && selectedDef.size === 3 && (
                    <ToolButton
                      onClick={() => {
                        if (!board.data) return
                        const cur = posAtTurn(positions[selectedDef.id], currentTurn) ?? { q: board.data.bossStart.q, r: board.data.bossStart.r, rot: board.data.bossRotation }
                        placeToken(selectedDef.id, { q: cur.q, r: cur.r, rot: (cur.rot ?? 0) % 180 === 0 ? 90 : 0 })
                      }}
                      icon={<RotateCw size={15} />}
                      label="Rotate"
                    />
                  )}
                  {selectedDef.type !== 'boss' && (
                    <ToolButton
                      onClick={() => {
                        if (instances[selectedDef.id]) removeInstance(selectedDef.id)
                        else removeToken(selectedDef.id)
                        setSelectedId(null)
                      }}
                      icon={<Trash2 size={15} />}
                      label="Remove"
                      danger
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <button onClick={() => setDockOpen((o) => !o)} className="flex items-center gap-1 text-xs uppercase tracking-[0.1em] text-ash transition-colors hover:text-bone">
            <ChevronDown size={16} className={`transition-transform ${dockOpen ? '' : 'rotate-180'}`} />
            Tools
          </button>
          <TurnSelector turn={currentTurn} max={MAX_TURN} onChange={setCurrentTurn} />
        </div>
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

function ToolButton({ active, onClick, icon, label, danger }: { active?: boolean; onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean }) {
  const cls = active
    ? 'border-teal bg-teal/10 text-teal-bright'
    : danger
      ? 'border-iron text-ash hover:border-blood hover:text-blood-bright'
      : 'border-iron text-ash hover:border-brass-dim hover:text-bone'
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs uppercase tracking-[0.08em] transition-colors ${cls}`}>
      {icon}
      {label}
    </button>
  )
}
