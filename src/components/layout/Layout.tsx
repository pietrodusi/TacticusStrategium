import { Link, NavLink, Outlet } from 'react-router-dom'
import { AccountMenu } from '../auth/AccountMenu'

export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      {/* top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-teal/60 to-transparent" />

      <header className="sticky top-0 z-20 border-b border-iron/80 bg-abyss/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
          <Link to="/" className="group flex min-w-0 flex-col leading-none">
            <span className="eyebrow hidden sm:block">Cogitator Tactica</span>
            <span className="display truncate text-lg font-bold tracking-[0.14em] text-bone transition-colors group-hover:text-teal-bright sm:text-xl">
              STRATEGIUM
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Tab to="/" label="Home" end />
            <Tab to="/plan" label="Plan" />
            <AccountMenu />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-iron/60 bg-abyss/60">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-1 px-4 py-5 text-center">
          <hr className="rule mb-2 w-28" />
          <p className="eyebrow text-brass-dim">++ For the Emperor ++</p>
          <p className="font-mono text-[0.65rem] text-ash/70">
            Fan-made · map data via TacticusDB · not affiliated with Snowprint Studios
          </p>
          <Link to="/legal" className="font-mono text-[0.65rem] text-ash/70 underline-offset-2 transition-colors hover:text-teal-bright hover:underline">
            Privacy &amp; Terms
          </Link>
        </div>
      </footer>
    </div>
  )
}

function Tab({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className="group relative px-2 py-2 sm:px-4">
      {({ isActive }) => (
        <>
          <span
            className={`font-sans text-[0.8rem] font-semibold uppercase tracking-[0.12em] transition-colors ${
              isActive ? 'text-teal-bright text-glow-teal' : 'text-ash group-hover:text-bone'
            }`}
          >
            {label}
          </span>
          {isActive && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 bg-teal shadow-[0_0_8px_var(--color-teal)]" />
          )}
        </>
      )}
    </NavLink>
  )
}
