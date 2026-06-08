import { Link, NavLink, Outlet } from 'react-router-dom'
import { Hexagon } from 'lucide-react'

export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-panel/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-imperial-gold">
            <Hexagon size={20} />
            <span className="tracking-wide">Strategium</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavTab to="/" label="Home" end />
            <NavTab to="/plan" label="Plan" />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">
        <Outlet />
      </main>
    </div>
  )
}

function NavTab({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `rounded px-3 py-1.5 transition-colors ${
          isActive ? 'bg-panel-2 text-imperial-gold' : 'text-gray-300 hover:bg-panel-2'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
