import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleUserRound, FolderOpen, LogOut } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { signOutUser } from '../../services/firebase/auth'

/** Header account entry: a Sign-in tab when signed out, avatar + menu when in. */
export function AccountMenu() {
  const { user, status } = useAuthStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  if (status === 'loading') return <span className="w-9" aria-hidden />

  if (!user) {
    return (
      <Link
        to="/signin"
        className="group relative px-2 py-2 sm:px-4"
        aria-label="Sign in"
      >
        <span className="font-sans text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-ash transition-colors group-hover:text-bone">
          Sign in
        </span>
      </Link>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="ml-1 grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-iron transition-colors hover:border-teal"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <CircleUserRound size={20} className="text-teal" />
        )}
      </button>

      {open && (
        <div className="panel absolute right-0 top-11 z-30 w-52 overflow-hidden py-1">
          <p className="truncate border-b border-iron/60 px-3 py-2 font-mono text-[0.68rem] text-ash">
            {user.displayName ?? user.email}
          </p>
          <MenuItem
            icon={<FolderOpen size={15} />}
            label="My Plans"
            onClick={() => {
              setOpen(false)
              navigate('/plans')
            }}
          />
          <MenuItem
            icon={<LogOut size={15} />}
            label="Sign out"
            onClick={() => {
              setOpen(false)
              void signOutUser()
            }}
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left font-sans text-[0.8rem] font-semibold uppercase tracking-[0.1em] text-bone transition-colors hover:bg-steel/60 hover:text-teal-bright"
    >
      <span className="text-ash">{icon}</span>
      {label}
    </button>
  )
}
