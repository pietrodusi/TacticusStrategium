// Discord sign-in via the tacticus-discord-auth Cloudflare Worker
// (workers/discord-auth): the worker runs the OAuth code flow and redirects
// back to /signin with a Firebase custom token in the URL hash.
import { getAuthInstance, loadAuthModule } from './auth'
import { useAuthStore } from '../../stores/authStore'

// The deployed worker (npx wrangler deploy prints it).
const WORKER_URL = 'https://tacticus-discord-auth.REPLACE_ME.workers.dev'

/** False until the deployed worker URL is pasted above — UI hides the button. */
export const discordConfigured = !WORKER_URL.includes('REPLACE_ME')

const STATE_KEY = 'discord-auth-state'
const NEXT_KEY = 'discord-auth-next'

/** Kick off the OAuth dance (full-page redirect to the worker → Discord). */
export function startDiscordSignIn(next: string) {
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(NEXT_KEY, next)
  const url = new URL(`${WORKER_URL}/login`)
  url.searchParams.set('state', state)
  url.searchParams.set('return', location.origin + location.pathname)
  location.href = url.href
}

export interface DiscordCallbackParams {
  dt: string
  state: string
  dn: string
  av: string
}

/**
 * Complete the flow on return: CSRF-check the state, exchange the custom
 * token, stamp the Discord profile onto the (profile-less) Firebase user.
 * Returns the route to continue to.
 */
export async function finishDiscordSignIn(p: DiscordCallbackParams): Promise<string> {
  const expected = sessionStorage.getItem(STATE_KEY)
  const next = sessionStorage.getItem(NEXT_KEY) ?? '/plans'
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(NEXT_KEY)
  if (!expected || p.state !== expected) throw new Error('discord/state-mismatch')

  const m = await loadAuthModule()
  const auth = await getAuthInstance()
  const cred = await m.signInWithCustomToken(auth, p.dt)
  // Custom-token users have no profile; refresh it from Discord every sign-in.
  await m.updateProfile(cred.user, { displayName: p.dn || null, photoURL: p.av || null })
  // updateProfile doesn't re-fire onAuthStateChanged — push it to the store.
  useAuthStore.getState().setUser({
    uid: cred.user.uid,
    displayName: p.dn || null,
    email: cred.user.email,
    photoURL: p.av || null,
  })
  return next
}
