import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleUserRound, FolderOpen, LogIn, ScrollText, Trash2, Users } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { usePlanStore } from '../stores/planStore'
import { deleteAccountAndData } from '../services/firebase/account'
import { authErrorMessage } from '../services/firebase/auth'

/** Account overview + GDPR self-service erasure. */
export function AccountPage() {
  const { user, status } = useAuthStore()
  const navigate = useNavigate()
  const setCloudRef = usePlanStore((s) => s.setCloudRef)

  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading')
    return <p className="pt-8 text-center font-mono text-sm text-ash">Verifying credentials…</p>

  if (!user) {
    return (
      <div className="mx-auto max-w-sm pt-8">
        <div className="panel space-y-3 p-5 text-center">
          <p className="eyebrow">++ Access Restricted ++</p>
          <p className="text-sm text-ash">Sign in to manage your account.</p>
          <Link to="/signin" state={{ next: '/account' }} className="btn btn-primary justify-center">
            <LogIn size={16} />
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  const provider = user.uid.startsWith('discord:')
    ? 'Discord'
    : user.email
      ? 'Google / email'
      : 'Unknown'

  const deleteAll = async () => {
    if (confirmText !== 'DELETE') return
    setBusy(true)
    setError(null)
    try {
      await deleteAccountAndData(user.uid)
      setCloudRef(null) // the linked cloud doc no longer exists
      navigate('/')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-3 pb-10">
      <header className="mb-1">
        <p className="eyebrow">++ Servo-Record ++</p>
        <h1 className="display text-2xl font-bold uppercase tracking-[0.1em] text-bone sm:text-3xl">Account</h1>
      </header>

      <div className="panel flex items-center gap-3 p-4">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full border border-iron object-cover" />
        ) : (
          <CircleUserRound size={40} className="text-teal" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-bone">{user.displayName ?? user.email ?? 'Adept'}</p>
          <p className="truncate font-mono text-[0.68rem] text-ash">
            {user.email ?? '—'} · via {provider}
          </p>
        </div>
      </div>

      <div className="panel divide-y divide-iron/50 p-1">
        <RowLink to="/plans" icon={<FolderOpen size={15} />} label="My Plans" />
        <RowLink to="/teams" icon={<Users size={15} />} label="My Teams" />
        <RowLink to="/legal" icon={<ScrollText size={15} />} label="Privacy & Terms" />
      </div>

      {/* Danger zone */}
      <div className="panel border-blood/40 p-4">
        <p className="eyebrow mb-2 text-blood-bright">++ Danger Zone ++</p>
        <p className="text-sm text-ash">
          Deleting your account permanently removes the account itself and <span className="font-semibold text-bone">all
          saved battle-plans (including shared ones) and raid teams</span>. This cannot be undone.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="input min-w-0 flex-1 font-mono text-sm"
            aria-label="Type DELETE to confirm"
          />
          <button
            onClick={() => void deleteAll()}
            disabled={confirmText !== 'DELETE' || busy}
            className="btn shrink-0 border-blood text-blood-bright hover:bg-blood/20"
          >
            <Trash2 size={15} />
            {busy ? 'Purging…' : 'Delete account'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-blood-bright">{error}</p>}
      </div>
    </div>
  )
}

function RowLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 px-3 py-2.5 font-sans text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-bone transition-colors hover:text-teal-bright"
    >
      <span className="text-ash">{icon}</span>
      {label}
    </Link>
  )
}
