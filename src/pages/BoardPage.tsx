import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Brush, ChevronDown, LogOut, Move, RotateCw, Trash2 } from 'lucide-react'
import { usePlanStore, posAtTurn, MAX_TURN } from '../stores/planStore'
import { useBosses, useRoster } from '../hooks/useGameData'
import { useBoard } from '../hooks/useBoards'
import { HexGrid, type BoardToken } from '../components/HexGrid'
import { UnitImage } from '../components/UnitImage'
import { TurnSelector } from '../components/plan/TurnSelector'
import { hexKey } from '../services/hex/hexUtils'
import { bossDisplayName } from '../utils/format'
import type { HexCoord } from '../types/strategium'
import type { Unit } from '../types/units'

type Tool = 'move' | 'paint'

interface TrayDef {
  id: string
  type: 'character' | 'mow' | 'boss'
  stem: string | null
  name: string
  size: number
}

const PAINT_COLORS = [
  { name: 'Teal', value: 'rgba(44,208,216,0.45)' },
  { name: 'Red', value: 'rgba(207,70,50,0.5)' },
  { name: 'Gold', value: 'rgba(212,175,55,0.5)' },
  { name: 'Green', value: 'rgba(74,222,128,0.45)' },
]

export function BoardPage() {
  const navigate = useNavigate()
  const { bossUnitId, boardId, team, machineOfWar, currentTurn, positions, paint } = usePlanStore()
  const { setCurrentTurn, placeToken, removeToken, rotateBoss, paintHex } = usePlanStore()

  const bosses = useBosses()
  const { roster, machinesOfWar } = useRoster()
  const board = useBoard(boardId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('move')
  const [paintColor, setPaintColor] = useState(PAINT_COLORS[0].value)
  const [dockOpen, setDockOpen] = useState(true)

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

  const defs = useMemo<TrayDef[]>(() => {
    const list: TrayDef[] = []
    if (boss) {
      list.push({
        id: boss.unitId,
        type: 'boss',
        stem: boss.imageStem,
        name: bossDisplayName(boss.bossType, boss.name),
        size: boss.bossSize,
      })
    }
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

  if (!bossUnitId || !boardId) return <Navigate to="/plan" replace />

  // Effective tokens at the current turn (boss defaults to its start position).
  const boardTokens: BoardToken[] = []
  if (board.data) {
    for (const d of defs) {
      let pos = posAtTurn(positions[d.id], currentTurn)
      if (!pos && d.type === 'boss') pos = { q: board.data.bossStart.q, r: board.data.bossStart.r, rot: board.data.bossRotation }
      if (pos) boardTokens.push({ ...d, pos })
    }
  }

  const isPlaced = (id: string) =>
    !!posAtTurn(positions[id], currentTurn) || (id === bossUnitId)

  const selectedDef = defs.find((d) => d.id === selectedId) ?? null

  const handleHex = (hex: HexCoord) => {
    if (tool === 'paint') {
      paintHex(hexKey(hex), paintColor)
      return
    }
    if (!selectedId || !board.data) return
    const def = defs.find((d) => d.id === selectedId)
    const rot =
      def?.type === 'boss'
        ? posAtTurn(positions[selectedId], currentTurn)?.rot ?? board.data.bossRotation
        : undefined
    placeToken(selectedId, { q: hex.q, r: hex.r, ...(rot !== undefined ? { rot } : {}) })
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-abyss" style={{ height: '100dvh' }}>
      {/* Top bar */}
      <div
        className="z-10 flex items-center justify-between gap-3 border-b border-iron bg-abyss/85 px-3 py-2 backdrop-blur"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate('/plan')}
          className="flex items-center gap-1.5 text-sm text-ash transition-colors hover:text-teal-bright"
        >
          <LogOut size={16} className="rotate-180" />
          <span className="uppercase tracking-[0.1em]">Exit</span>
        </button>
        <span className="data truncate text-xs">
          {boss ? bossDisplayName(boss.bossType, boss.name) : ''} // {boardId}
        </span>
      </div>

      {/* Board */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {board.isLoading && <p className="font-mono text-sm text-ash">Acquiring auspex feed…</p>}
        {board.data && (
          <HexGrid
            board={board.data}
            tokens={boardTokens}
            paint={paint[currentTurn]}
            selectedTokenId={selectedId}
            onHexClick={handleHex}
            onTokenClick={(id) => {
              setTool('move')
              setSelectedId((cur) => (cur === id ? null : id))
            }}
          />
        )}
        <p className="pointer-events-none absolute left-3 top-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ash/50">
          {tool === 'paint' ? 'Paint — tap hexes' : selectedDef ? `Move ${selectedDef.name}` : 'Select a unit'}
        </p>
      </div>

      {/* Bottom control dock */}
      <div
        className="z-10 border-t border-iron bg-abyss/95 backdrop-blur"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* Foldable section */}
        {dockOpen && (
          <div className="space-y-3 border-b border-iron/50 px-3 py-3">
            {/* Token tray */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {defs.map((d) => (
                <TrayChip
                  key={d.id}
                  def={d}
                  placed={isPlaced(d.id)}
                  selected={d.id === selectedId}
                  onClick={() => {
                    setTool('move')
                    setSelectedId((cur) => (cur === d.id ? null : d.id))
                  }}
                />
              ))}
              {defs.length === 0 && <p className="py-3 text-xs text-ash">No units in this plan.</p>}
            </div>

            {/* Tools row */}
            <div className="flex flex-wrap items-center gap-2">
              <ToolButton active={tool === 'move'} onClick={() => setTool('move')} icon={<Move size={15} />} label="Move" />
              <ToolButton active={tool === 'paint'} onClick={() => setTool('paint')} icon={<Brush size={15} />} label="Paint" />

              {tool === 'paint' && (
                <div className="flex items-center gap-1.5">
                  {PAINT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setPaintColor(c.value)}
                      title={c.name}
                      className={`h-6 w-6 rounded-full border-2 ${paintColor === c.value ? 'border-bone' : 'border-iron'}`}
                      style={{ background: c.value }}
                    />
                  ))}
                </div>
              )}

              {/* Selected-unit actions */}
              {selectedDef && tool === 'move' && (
                <div className="ml-auto flex items-center gap-2">
                  {selectedDef.type === 'boss' && selectedDef.size > 1 && (
                    <ToolButton onClick={() => rotateBoss(selectedDef.id)} icon={<RotateCw size={15} />} label="Rotate" />
                  )}
                  {selectedDef.type !== 'boss' && (
                    <ToolButton
                      onClick={() => {
                        removeToken(selectedDef.id)
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

        {/* Persistent bar: fold toggle + turn selector */}
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <button
            onClick={() => setDockOpen((o) => !o)}
            className="flex items-center gap-1 text-xs uppercase tracking-[0.1em] text-ash transition-colors hover:text-bone"
          >
            <ChevronDown size={16} className={`transition-transform ${dockOpen ? '' : 'rotate-180'}`} />
            Tools
          </button>
          <TurnSelector turn={currentTurn} max={MAX_TURN} onChange={setCurrentTurn} />
        </div>
      </div>
    </div>
  )
}

function TrayChip({
  def,
  placed,
  selected,
  onClick,
}: {
  def: TrayDef
  placed: boolean
  selected: boolean
  onClick: () => void
}) {
  const ring =
    def.type === 'boss' ? 'ring-blood' : def.type === 'mow' ? 'ring-brass' : 'ring-teal'
  return (
    <button
      onClick={onClick}
      className={`relative flex shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors ${
        selected ? 'border-teal bg-teal/10' : 'border-iron hover:border-brass-dim'
      }`}
    >
      <UnitImage stem={def.stem} alt={def.name} className={`h-11 w-11 rounded-full object-cover ring-1 ${ring}`} />
      <span className="w-14 truncate text-center text-[0.6rem] leading-tight text-bone">{def.name}</span>
      {placed && (
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-abyss bg-teal" />
      )}
    </button>
  )
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
  danger,
}: {
  active?: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  danger?: boolean
}) {
  const base = 'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs uppercase tracking-[0.08em] transition-colors'
  const cls = active
    ? 'border-teal bg-teal/10 text-teal-bright'
    : danger
      ? 'border-iron text-ash hover:border-blood hover:text-blood-bright'
      : 'border-iron text-ash hover:border-brass-dim hover:text-bone'
  return (
    <button onClick={onClick} className={`${base} ${cls}`}>
      {icon}
      {label}
    </button>
  )
}
