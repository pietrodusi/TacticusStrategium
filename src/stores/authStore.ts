import { create } from 'zustand'

/** The slice of the Firebase user the UI needs. */
export interface AuthUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

interface AuthState {
  /** null while signed out (and while status is 'loading'). */
  user: AuthUser | null
  /** 'loading' until the first onAuthStateChanged callback fires. */
  status: 'loading' | 'in' | 'out'
  setUser: (user: AuthUser | null) => void
}

// Not persisted — Firebase Auth keeps the session itself (IndexedDB) and
// re-emits it via onAuthStateChanged on startup.
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  status: 'loading',
  setUser: (user) => set({ user, status: user ? 'in' : 'out' }),
}))
