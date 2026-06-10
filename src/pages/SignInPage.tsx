import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, LogIn, Mail } from 'lucide-react'
import {
  authErrorMessage,
  sendReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../services/firebase/auth'
import { discordConfigured, finishDiscordSignIn, startDiscordSignIn } from '../services/firebase/discord'
import { firebaseConfigured } from '../services/firebase/app'

type Mode = 'signin' | 'register' | 'reset'

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const next = (location.state as { next?: string } | null)?.next ?? '/plans'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [params] = useSearchParams()
  // Discord callback leg, captured once: the worker redirects here with a
  // custom token (?dt=…) or an error (?derr=…) in the hash query.
  const [discordCb] = useState(() => {
    const dt = params.get('dt')
    const derr = params.get('derr')
    if (!dt && !derr) return null
    return { dt, derr, state: params.get('state') ?? '', dn: params.get('dn') ?? '', av: params.get('av') ?? '' }
  })

  const [busy, setBusy] = useState(!!discordCb?.dt)
  const [error, setError] = useState<string | null>(
    discordCb?.derr
      ? discordCb.derr === 'denied'
        ? 'Discord sign-in was cancelled.'
        : 'Discord sign-in failed — please retry.'
      : null,
  )
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!discordCb) return
    navigate('/signin', { replace: true, state: { next } }) // strip the token from the URL
    if (!discordCb.dt) return
    finishDiscordSignIn({ dt: discordCb.dt, state: discordCb.state, dn: discordCb.dn, av: discordCb.av })
      .then((to) => navigate(to, { replace: true }))
      .catch(() => setError('Discord sign-in failed — please retry.'))
      .finally(() => setBusy(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot callback processing
  }, [])

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

        {discordConfigured && (
          <button
            onClick={() => startDiscordSignIn(next)}
            disabled={busy}
            className="btn w-full justify-center"
          >
            <DiscordMark />
            Continue with Discord
          </button>
        )}

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

        <p className="border-t border-iron/50 pt-3 text-center font-mono text-[0.62rem] leading-relaxed text-ash/70">
          By signing in or creating an account you accept the{' '}
          <Link to="/legal" className="text-ash underline underline-offset-2 transition-colors hover:text-teal-bright">
            Privacy Policy &amp; Terms
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

/** Discord logo mark (lucide has none). */
function DiscordMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}
