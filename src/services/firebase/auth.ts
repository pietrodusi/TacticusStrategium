import type { Auth, UserCredential } from 'firebase/auth'
import { firebaseApp } from './app'
import { useAuthStore } from '../../stores/authStore'

// firebase/auth is dynamic-imported into its own chunk. initAuth() kicks the
// load at startup, so the module is warm long before a user taps a sign-in
// button (signInWithPopup keeps its user-activation window).
const loadAuth = () => import('firebase/auth')
let authPromise: Promise<Auth> | null = null
const getAuth = () => (authPromise ??= loadAuth().then((m) => m.getAuth(firebaseApp)))

let started = false

/** Start the single auth-state subscription feeding authStore (idempotent). */
export function initAuth() {
  if (started) return
  started = true
  void loadAuth().then(async (m) =>
    m.onAuthStateChanged(await getAuth(), (u) =>
      useAuthStore
        .getState()
        .setUser(
          u
            ? { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL }
            : null,
        ),
    ),
  )
}

// signInWithRedirect is broken on Safari/Firefox (third-party storage
// partitioning vs the *.firebaseapp.com authDomain) — popup works everywhere.
export async function signInWithGoogle(): Promise<UserCredential> {
  const m = await loadAuth()
  return m.signInWithPopup(await getAuth(), new m.GoogleAuthProvider())
}

export async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  const m = await loadAuth()
  return m.createUserWithEmailAndPassword(await getAuth(), email, password)
}

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  const m = await loadAuth()
  return m.signInWithEmailAndPassword(await getAuth(), email, password)
}

export async function sendReset(email: string): Promise<void> {
  const m = await loadAuth()
  return m.sendPasswordResetEmail(await getAuth(), email)
}

export async function signOutUser(): Promise<void> {
  const m = await loadAuth()
  return m.signOut(await getAuth())
}

/** Human-readable message for a Firebase Auth error. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked — allow popups for this site and retry.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.'
    case 'auth/invalid-email':
      return 'That email address is not valid.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists — sign in instead.'
    case 'auth/weak-password':
      return 'Password is too weak — use at least 6 characters.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.'
    case 'auth/too-many-requests':
      return 'Too many attempts — wait a moment and retry.'
    case 'auth/network-request-failed':
      return 'Network error — check your connection and retry.'
    case 'auth/invalid-api-key':
      return 'Firebase is not configured yet (see src/services/firebase/app.ts).'
    default:
      return 'Sign-in failed. Please retry.'
  }
}
