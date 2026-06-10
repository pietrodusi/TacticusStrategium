import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/authStore'
import { createTeam, deleteTeam, listTeams } from '../services/firebase/teams'

/** The signed-in user's saved raid teams (disabled while signed out). */
export function useMyTeams() {
  const uid = useAuthStore((s) => s.user?.uid)
  return useQuery({
    queryKey: ['teams', uid],
    queryFn: () => listTeams(uid!),
    enabled: !!uid,
    staleTime: 60_000,
  })
}

/** Mutations over the user's teams — each invalidates the list query. */
export function useTeamMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['teams'] })

  const create = useMutation({
    mutationFn: ({
      uid,
      name,
      members,
      machineOfWar,
    }: {
      uid: string
      name: string
      members: (string | null)[]
      machineOfWar: string | null
    }) => createTeam(uid, name, members, machineOfWar),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: invalidate,
  })

  return { create, remove }
}
