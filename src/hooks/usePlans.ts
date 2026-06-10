import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import {
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  overwritePlan,
  renamePlan,
  setPlanShared,
  type PlanMeta,
} from '../services/firebase/plans'

/** The signed-in user's cloud plans (disabled while signed out). */
export function useMyPlans() {
  const uid = useAuthStore((s) => s.user?.uid)
  return useQuery({
    queryKey: ['plans', uid],
    queryFn: () => listPlans(uid!),
    enabled: !!uid,
    // Plans only change through our own mutations (which invalidate) — but
    // keep this short so a second device picks changes up reasonably fast.
    staleTime: 60_000,
  })
}

/** A plan fetched by share link. Permission-denied / missing = unavailable. */
export const useSharedPlan = (planId: string | undefined) =>
  useQuery({
    queryKey: ['sharedPlan', planId],
    queryFn: () => getPlan(planId!),
    enabled: !!planId,
    retry: false,
  })

/** Mutations over the user's plan list — each invalidates the list query. */
export function usePlanMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['plans'] })

  const create = useMutation({
    mutationFn: ({ uid, name, meta, data }: { uid: string; name: string; meta: PlanMeta; data: string }) =>
      createPlan(uid, name, meta, data),
    onSuccess: invalidate,
  })
  const overwrite = useMutation({
    mutationFn: ({ id, meta, data }: { id: string; meta: PlanMeta; data: string }) =>
      overwritePlan(id, meta, data),
    onSuccess: invalidate,
  })
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renamePlan(id, name),
    onSuccess: invalidate,
  })
  const share = useMutation({
    mutationFn: ({ id, shared }: { id: string; shared: boolean }) => setPlanShared(id, shared),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => deletePlan(id),
    onSuccess: invalidate,
  })

  return { create, overwrite, rename, share, remove }
}
