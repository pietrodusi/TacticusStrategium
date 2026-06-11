import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Save, X } from 'lucide-react'
import { usePlanStore } from '../../stores/planStore'
import { useAuthStore } from '../../stores/authStore'
import { useMyPlans, usePlanMutations } from '../../hooks/usePlans'
import { serializePlan } from '../../services/plans/serialize'
import { MAX_PLANS } from '../../services/firebase/plans'

/** Bottom sheet for saving the current board plan to the cloud archive. */
export function SavePlanSheet({ defaultName, onClose }: { defaultName: string; onClose: () => void }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const cloudRef = usePlanStore((s) => s.cloudRef)
  const setCloudRef = usePlanStore((s) => s.setCloudRef)
  const plans = useMyPlans()
  const { create, overwrite } = usePlanMutations()

  const [name, setName] = useState(cloudRef?.name ?? defaultName)
  const [error, setError] = useState<string | null>(null)

  const busy = create.isPending || overwrite.isPending
  const atCap = (plans.data?.length ?? 0) >= MAX_PLANS

  // The board route guarantees a target + map; bail out quietly otherwise.
  const snapshot = () => {
    const s = usePlanStore.getState()
    if (!s.bossUnitId || !s.boardId) return null
    return {
      meta: { bossUnitId: s.bossUnitId, targetKind: s.targetKind, boardId: s.boardId },
      data: serializePlan({ ...s, bossUnitId: s.bossUnitId, boardId: s.boardId }),
    }
  }

  const run = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
      onClose()
    } catch {
      setError('Save failed — check your connection and retry.')
    }
  }

  const saveNew = () => {
    const snap = snapshot()
    const trimmed = name.trim().slice(0, 60)
    if (!snap || !trimmed || !user) return
    void run(async () => {
      const id = await create.mutateAsync({ uid: user.uid, name: trimmed, ...snap })
      setCloudRef({ id, name: trimmed })
    })
  }

  const saveOverwrite = () => {
    const snap = snapshot()
    if (!snap || !cloudRef) return
    void run(async () => {
      await overwrite.mutateAsync({ id: cloudRef.id, ...snap })
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button className="flex-1 bg-abyss/70 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div
        className="panel panel-glow rounded-b-none border-x-0 border-b-0 px-4 pt-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow">++ Archive Battle-Plan ++</p>
          <button onClick={onClose} className="text-ash transition-colors hover:text-bone" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!user ? (
          <div className="space-y-3 pb-2 text-center">
            <p className="text-sm text-ash">Sign in to keep this plan in your archive and share it.</p>
            <button
              onClick={() => navigate('/signin', { state: { next: '/plan/board' } })}
              className="btn btn-primary mx-auto justify-center"
            >
              <LogIn size={16} />
              Sign in
            </button>
            <p className="font-mono text-[0.65rem] text-ash/70">Your plan stays on this device meanwhile.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="eyebrow mb-1 block">Plan name</span>
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                className="input w-full"
                placeholder="e.g. Szarekh north flank"
              />
            </label>

            {error && <p className="text-xs text-blood-bright">{error}</p>}
            {atCap && !cloudRef && (
              <p className="text-xs text-blood-bright">
                Archive full ({MAX_PLANS} plans) — delete some from My Plans first.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {cloudRef && (
                <button onClick={saveOverwrite} disabled={busy} className="btn btn-primary justify-center">
                  <Save size={16} />
                  Overwrite “{cloudRef.name}”
                </button>
              )}
              <button
                onClick={saveNew}
                disabled={busy || !name.trim() || atCap}
                className={`btn justify-center ${cloudRef ? '' : 'btn-primary'}`}
              >
                <Save size={16} />
                {cloudRef ? 'Save as new' : 'Save to archive'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
