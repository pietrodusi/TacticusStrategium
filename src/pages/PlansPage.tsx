import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, FolderOpen, Link2, LogIn, Pencil, Share2, Trash2, X } from 'lucide-react'
import { useMyPlans, usePlanMutations } from '../hooks/usePlans'
import { useBosses, usePrimes } from '../hooks/useGameData'
import { useAuthStore } from '../stores/authStore'
import { usePlanStore } from '../stores/planStore'
import { deserializePlan } from '../services/plans/serialize'
import { sharedPlanUrl } from '../services/plans/shareUrl'
import type { CloudPlan } from '../services/firebase/plans'
import { bossDisplayName } from '../utils/format'
import { UnitImage } from '../components/UnitImage'
import { DataError } from '../components/DataError'
import { useConfirm } from '../hooks/useConfirm'

export function PlansPage() {
  const { user, status } = useAuthStore()
  const plans = useMyPlans()

  if (status === 'loading') return <p className="pt-8 text-center font-mono text-sm text-ash">Verifying credentials…</p>

  if (!user) {
    return (
      <div className="mx-auto max-w-sm pt-8">
        <div className="panel space-y-3 p-5 text-center">
          <p className="eyebrow">++ Access Restricted ++</p>
          <p className="text-sm text-ash">Sign in to keep battle-plans in the archive and share them with your guild.</p>
          <Link to="/signin" state={{ next: '/plans' }} className="btn btn-primary justify-center">
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
        <p className="eyebrow">++ Strategic Archive ++</p>
        <h1 className="display text-2xl font-bold uppercase tracking-[0.1em] text-bone sm:text-3xl">My Plans</h1>
      </header>

      {plans.isLoading && <p className="font-mono text-sm text-ash">Consulting the archive…</p>}
      {plans.isError && <DataError what="your saved plans" onRetry={() => void plans.refetch()} />}
      {plans.data?.length === 0 && (
        <div className="panel p-5 text-center">
          <FolderOpen size={22} className="mx-auto mb-2 text-ash" />
          <p className="text-sm text-ash">
            No saved plans yet — build one on the <Link to="/plan" className="text-teal-bright">board</Link> and
            save it from the top bar.
          </p>
        </div>
      )}

      {plans.data?.map((p) => <PlanCard key={p.id} plan={p} />)}
    </div>
  )
}

function PlanCard({ plan }: { plan: CloudPlan }) {
  const navigate = useNavigate()
  const bosses = useBosses()
  const primes = usePrimes()
  const loadPlan = usePlanStore((s) => s.loadPlan)
  const { rename, share, remove } = usePlanMutations()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(plan.name)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { askConfirm, confirmDialog } = useConfirm()

  const target =
    plan.targetKind === 'prime'
      ? primes.data?.primes.find((x) => x.unitId === plan.bossUnitId)
      : bosses.data?.bosses.find((x) => x.unitId === plan.bossUnitId)
  const targetName = !target
    ? plan.bossUnitId
    : plan.targetKind === 'prime'
      ? target.name
      : bossDisplayName((target as { bossType: string }).bossType, target.name)

  const load = () => {
    const data = deserializePlan(plan.data, plan.schemaVersion)
    if (!data) {
      setError('This plan was saved by a newer version of the app — update (hard-reload) and retry.')
      return
    }
    askConfirm({
      title: 'Load plan',
      body: `Load "${plan.name}"? This replaces the battle-plan currently on your board.`,
      confirmLabel: 'Load',
      onConfirm: () => {
        loadPlan(data, { id: plan.id, name: plan.name })
        navigate('/plan/board')
      },
    })
  }

  const saveRename = () => {
    const trimmed = name.trim()
    setEditing(false)
    if (!trimmed || trimmed === plan.name) {
      setName(plan.name)
      return
    }
    rename.mutate({ id: plan.id, name: trimmed.slice(0, 60) })
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(sharedPlanUrl(plan.id))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="panel p-3">
      <div className="flex items-center gap-3">
        <UnitImage
          stem={target?.imageStem ?? null}
          alt={targetName}
          className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-iron"
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                className="input w-full px-2 py-1 text-sm"
              />
              <button onClick={saveRename} className="text-teal-bright" aria-label="Save name"><Check size={16} /></button>
              <button onClick={() => { setEditing(false); setName(plan.name) }} className="text-ash" aria-label="Cancel rename"><X size={16} /></button>
            </div>
          ) : (
            <p className="truncate text-sm font-semibold text-bone">
              {plan.name}
              {plan.shared && (
                <span className="ml-2 rounded border border-teal/50 px-1 py-px align-middle font-mono text-[0.55rem] uppercase tracking-[0.1em] text-teal-bright">
                  Shared
                </span>
              )}
            </p>
          )}
          <p className="truncate font-mono text-[0.65rem] text-ash">
            {targetName} · {plan.boardId}
            {plan.updatedAt && ` · ${new Date(plan.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-blood-bright">{error}</p>}

      <div className="mt-2.5 flex items-center gap-1.5 border-t border-iron/50 pt-2.5">
        <button onClick={load} className="btn btn-primary px-3 py-1.5 text-xs">Load</button>
        <span className="flex-1" />
        <IconBtn
          label={plan.shared ? 'Stop sharing' : 'Share with a link'}
          active={plan.shared}
          onClick={() => share.mutate({ id: plan.id, shared: !plan.shared })}
        >
          <Share2 size={15} />
        </IconBtn>
        {plan.shared && (
          <IconBtn label="Copy share link" active={copied} onClick={() => void copyLink()}>
            {copied ? <Check size={15} /> : <Link2 size={15} />}
          </IconBtn>
        )}
        <IconBtn label="Rename" onClick={() => setEditing(true)}>
          <Pencil size={15} />
        </IconBtn>
        <IconBtn
          label="Delete"
          danger
          onClick={() =>
            askConfirm({
              title: 'Delete plan',
              body: `Delete "${plan.name}" from the archive? This cannot be undone.`,
              confirmLabel: 'Delete',
              danger: true,
              onConfirm: () => remove.mutate(plan.id),
            })
          }
        >
          <Trash2 size={15} />
        </IconBtn>
      </div>

      {confirmDialog}
    </div>
  )
}

function IconBtn({
  label,
  active,
  danger,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const cls = active
    ? 'border-teal text-teal-bright'
    : danger
      ? 'border-iron text-ash hover:border-blood hover:text-blood-bright'
      : 'border-iron text-ash hover:border-brass-dim hover:text-bone'
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`grid h-8 w-8 place-items-center rounded-md border transition-colors ${cls}`}>
      {children}
    </button>
  )
}
