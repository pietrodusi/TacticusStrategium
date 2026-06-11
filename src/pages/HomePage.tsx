import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Hexagon, Move3d, Radar } from 'lucide-react'
import { asset } from '../services/paths'

export function HomePage() {
  // The glow is a drop-shadow filter that follows the sigil's alpha shape — but
  // only once the PNG is decoded. Applied before decode (mobile first load), the
  // browser shadows the square element box instead. Gate it on decode so the
  // glow always traces the hexagon, never a square.
  const [sigilReady, setSigilReady] = useState(false)
  const onSigilLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    void (img.decode ? img.decode().catch(() => { }) : Promise.resolve()).then(() => setSigilReady(true))
  }

  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="relative flex flex-col items-center pt-6 text-center sm:pt-12">
        <img
          src={asset('icon-512-noglow.png')}
          alt="Tacticus Strategium sigil"
          // ref handles the cached case where onLoad may fire before React attaches.
          ref={(el) => { if (el?.complete && el.naturalWidth) setSigilReady(true) }}
          onLoad={onSigilLoad}
          className={`rise h-36 w-36 sm:h-44 sm:w-44 ${sigilReady ? 'glow-teal animate-sigil' : ''}`}
          style={{ animationDelay: '0ms' }}
          draggable={false}
        />

        <p className="eyebrow rise mt-6" style={{ animationDelay: '90ms' }}>
          ++ Cogitator Online ++
        </p>

        <h1
          className="rise mt-3 text-4xl font-black tracking-[0.06em] text-bone sm:text-6xl"
          style={{ animationDelay: '160ms' }}
        >
          TACTICUS
          <br />
          <span className="text-teal-bright text-glow-teal">STRATEGIUM</span>
        </h1>

        <p
          className="rise mt-5 max-w-md text-balance text-lg text-ash"
          style={{ animationDelay: '240ms' }}
        >
          Plan your Guild Raids.<br />
          Chart every warrior&apos;s advance across the six turns &mdash; boss, summons and squad, hex by hex.
        </p>

        <div className="rise mt-8" style={{ animationDelay: '320ms' }}>
          <Link to="/plan" className="btn btn-primary px-8 py-3.5 text-base">
            Engage Battle-Plan
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      <hr className="rule rise my-12 w-full max-w-md" style={{ animationDelay: '480ms' }} />

      {/* Doctrine cards */}
      <section className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        <Feature
          delay={520}
          icon={<Radar size={22} />}
          title="Auspex Maps"
          body="Every Guild Raid board, framed to simulate the real in-game experience."
        />
        <Feature
          delay={600}
          icon={<Move3d size={22} />}
          title="Deploy & Maneuver"
          body="Place your squad, summons and the boss on the hex grid and plan their movements."
        />
        <Feature
          delay={680}
          icon={<Hexagon size={22} />}
          title="Six-Turn Simulation"
          body="Save your 6-turn plans, retrieve them anytime and share them with your guild."
        />
      </section>

      {/* Community */}
      <section className="rise mt-12 w-full max-w-sm" style={{ animationDelay: '760ms' }}>
        <div className="panel riveted flex flex-col items-center gap-4 p-6 text-center">
          <img
            src={asset('GODS_OF_DEATH.webp')}
            alt="GOD cluster"
            className="w-full max-w-[240px] rounded-lg p-3 shadow-lg"
            draggable={false}
          />
          <div>
            <p className="display text-lg font-bold uppercase tracking-[0.08em] text-bone">
              Made by the <span className="text-teal-bright">GOD</span> cluster
            </p>
            <p className="mt-1 text-sm text-ash">Italy&apos;s biggest Tacticus community</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function Feature({
  icon,
  title,
  body,
  delay,
}: {
  icon: React.ReactNode
  title: string
  body: string
  delay: number
}) {
  return (
    <div className="panel rise riveted p-5 text-left" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center bg-abyss text-teal-bright">
        {icon}
      </div>
      <h3 className="display mb-1.5 text-base font-bold uppercase tracking-[0.08em] text-bone">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-ash">{body}</p>
    </div>
  )
}
