import { Link } from 'react-router-dom'
import { Map as MapIcon } from 'lucide-react'

export function HomePage() {
  return (
    <div className="mx-auto max-w-2xl py-8 text-center">
      <h1 className="font-display text-3xl font-bold text-imperial-gold">Tacticus Strategium</h1>
      <p className="mt-3 text-gray-300">
        Plan your Guild Raid boss fights move by move. Pick a map, place your team, the boss, and
        summons on the hex grid, and chart their positions across all six turns.
      </p>
      <Link
        to="/plan"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-imperial-gold px-6 py-3 font-semibold text-black transition-transform hover:scale-105"
      >
        <MapIcon size={20} />
        Start Planning
      </Link>
      <p className="mt-8 text-xs text-gray-500">
        Map data from TacticusDB. Not affiliated with Snowprint Studios.
      </p>
    </div>
  )
}
