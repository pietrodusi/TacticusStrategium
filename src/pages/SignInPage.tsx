import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { KeyRound, LogIn, Mail } from 'lucide-react'
import {
  authErrorMessage,
  sendReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../services/firebase/auth'
import { firebaseConfigured } from '../services/firebase/app'

type Mode = 'signin' | 'register' | 'reset'

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const next = (location.state as { next?: string } | null)?.next ?? '/plans'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const run = async (action: () => Promise<unknown>, onDone?: () => void) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      onDone?.()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const google = () => run(signInWithGoogle, () => navigate(next, { replace: true }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'reset') {
      void run(
        () => sendReset(email),
        () => setNotice('Password-reset email sent — check your inbox.'),
      )
      return
    }
    const action = mode === 'register' ? signUpWithEmail : signInWithEmail
    void run(
      () => action(email, password),
      () => navigate(next, { replace: true }),
    )
  }

  return (
    <div className="mx-auto max-w-sm space-y-3 pt-4">
      <header className="mb-1">
        <p className="eyebrow">++ Identify Yourself ++</p>
        <h1 className="display text-2xl font-bold uppercase tracking-[0.1em] text-bone">
          {mode === 'register' ? 'Enlist' : mode === 'reset' ? 'Recover Access' : 'Sign In'}
        </h1>
      </header>

      <div className="panel panel-glow space-y-4 p-4">
        {!firebaseConfigured && (
          <p className="rounded-md border border-blood/50 bg-blood/10 px-3 py-2 text-xs text-bone">
            Firebase is not configured yet — paste the console config into{' '}
            <code className="font-mono text-[0.7rem]">src/services/firebase/app.ts</code>.
          </p>
        )}

        <button onClick={google} disabled={busy} className="btn btn-primary w-full justify-center">
          <LogIn size={16} />
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <hr className="rule flex-1" />
          <span className="eyebrow text-ash/60">or vox-channel</span>
          <hr className="rule flex-1" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="eyebrow mb-1 flex items-center gap-1.5">
              <Mail size={11} /> Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="adept@example.com"
            />
          </label>

          {mode !== 'reset' && (
            <label className="block">
              <span className="eyebrow mb-1 flex items-center gap-1.5">
                <KeyRound size={11} /> Password
              </span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full"
                placeholder="••••••••"
              />
            </label>
          )}

          {error && <p className="text-xs text-blood-bright">{error}</p>}
          {notice && <p className="text-xs text-teal-bright">{notice}</p>}

          <button type="submit" disabled={busy} className="btn w-full justify-center">
            {mode === 'register' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-center justify-between font-mono text-[0.68rem] uppercase tracking-[0.1em]">
          {mode === 'signin' ? (
            <>
              <button onClick={() => setMode('register')} className="text-ash transition-colors hover:text-teal-bright">
                Create account
              </button>
              <button onClick={() => setMode('reset')} className="text-ash transition-colors hover:text-teal-bright">
                Forgot password?
              </button>
            </>
          ) : (
            <button onClick={() => setMode('signin')} className="text-ash transition-colors hover:text-teal-bright">
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
