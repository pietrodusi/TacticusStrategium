import { getAuthInstance, loadAuthModule } from './auth'
import { deletePlan, listPlans } from './plans'
import { deleteTeam, listTeams } from './teams'

/**
 * GDPR erasure: delete every plan and team the user owns, then the Firebase
 * account itself. Docs go first — once the user is deleted, the security
 * rules would reject the doc deletes. Retrying after a partial failure is
 * safe (already-deleted docs are simply absent).
 *
 * Throws `auth/requires-recent-login` when the session is too old to allow
 * account deletion — the caller asks the user to sign in again and retry.
 */
export async function deleteAccountAndData(uid: string): Promise<void> {
  const [plans, teams] = await Promise.all([listPlans(uid), listTeams(uid)])
  for (const p of plans) await deletePlan(p.id)
  for (const t of teams) await deleteTeam(t.id)

  const m = await loadAuthModule()
  const auth = await getAuthInstance()
  if (!auth.currentUser) throw new Error('not signed in')
  await m.deleteUser(auth.currentUser)
}
