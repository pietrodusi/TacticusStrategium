import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CopyPlus, ShieldAlert } from 'lucide-react'
import { useSharedPlan, usePlanMutations } from '../hooks/usePlans'
import { useAuthStore } from '../stores/authStore'
import { usePlanStore } from '../stores/planStore'
import { deserializePlan } from '../services/plans/serialize'
import { PlanBoardView } from '../components/plan/PlanBoardView'
import { useConfirm } from '../hooks/useConfirm'

/** Read-only view of a shared plan (full-bleed, like the board). */
export function SharedPlanPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const shared = useSharedPlan(planId)
  const user = useAuthStore((s) => s.user)
  const loadPlan = usePlanStore((s) => s.loadPlan)
  const { create } = usePlanMutations()
  const [copyError, setCopyError] = useState(false)
  const { askConfirm, confirmDialog } = useConfirm()

  // Lock the page (no scroll/bounce) while viewing, same as the board.
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

  const plan = shared.data
  const data = useMemo(
    () => (plan ? deserializePlan(plan.data, plan.schemaVersion) : null),
    [plan],
  )

  const copyToMyPlans = () => {
    if (!plan || !data) return
    if (user) {
      setCopyError(false)
      create.mutate(
        {
          uid: user.uid,
          name: `${plan.name} (copy)`.slice(0, 60),
          meta: { bossUnitId: plan.bossUnitId, targetKind: plan.targetKind, boardId: plan.boardId },
          data: plan.data,
        },
        {
          onSuccess: () => navigate('/plans'),
          onError: () => setCopyError(true),
        },
      )
      return
    }
    askConfirm({
      title: 'Copy plan',
      body: 'Copy this plan to your board? It replaces the battle-plan currently on this device.',
      confirmLabel: 'Copy',
      onConfirm: () => {
        loadPlan(data, null)
        navigate('/plan/board')
      },
    })
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-abyss" style={{ height: '100dvh' }}>
      {/* Top bar */}
      <div
        className="z-10 flex items-center justify-between gap-3 border-b border-iron bg-abyss/85 px-3 py-3 backdrop-blur"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <Link to="/" className="flex shrink-0 items-center gap-1.5 text-base text-ash transition-colors hover:text-teal-bright">
          <ArrowLeft size={18} />
          <span className="uppercase tracking-[0.1em]">Strategium</span>
        </Link>
        <span className="data min-w-0 truncate text-sm">
          {plan ? `${plan.name} // shared plan` : 'shared plan'}
        </span>
        {plan && data && (
          <button
            onClick={copyToMyPlans}
            disabled={create.isPending}
            title="Copy to my plans"
            className="flex shrink-0 items-center gap-1.5 text-base text-teal-bright transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            <CopyPlus size={18} />
            <span className="hidden uppercase tracking-[0.1em] sm:inline">Copy</span>
          </button>
        )}
      </div>

      {copyError && (
        <p className="border-b border-blood/40 bg-blood/10 px-3 py-1.5 text-center text-xs text-blood-bright">
          Copy failed — check your connection and retry.
        </p>
      )}

      {shared.isLoading ? (
        <p className="mt-12 text-center font-mono text-sm text-ash">Receiving transmission…</p>
      ) : !plan || !data ? (
        <Unavailable newerVersion={!!plan && !data} />
      ) : (
        <PlanBoardView plan={data} />
      )}

      {confirmDialog}
    </div>
  )
}

/** Covers all dead ends as one state: missing doc, sharing turned off
 *  (permission denied), or a payload from a newer app version. */
function Unavailable({ newerVersion }: { newerVersion: boolean }) {
  return (
    <div className="mx-auto mt-12 max-w-sm px-4">
      <div className="panel space-y-3 p-5 text-center">
        <ShieldAlert size={22} className="mx-auto text-blood-bright" />
        <p className="eyebrow">++ Transmission Lost ++</p>
        <p className="text-sm text-ash">
          {newerVersion
            ? 'This plan was saved by a newer version of the app — hard-reload to update, then retry.'
            : 'This plan is unavailable. The link may be wrong, or its owner stopped sharing it.'}
        </p>
        <Link to="/" className="btn mx-auto justify-center">Back to base</Link>
      </div>
    </div>
  )
}
