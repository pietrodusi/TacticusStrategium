import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { asset } from '../services/paths'

/** How-to guide + FAQ for the battle-planner. */
export function GuidePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <header className="mb-1">
        <p className="eyebrow">++ Field Manual ++</p>
        <h1 className="display text-2xl font-bold uppercase tracking-[0.1em] text-bone sm:text-3xl">
          Guide &amp; FAQ
        </h1>
        <p className="mt-1 text-sm text-ash">
          Plan a Guild Raid fight move-by-move: pick the target and map, deploy your squad, then chart
          every turn. Here&apos;s how each piece works.
        </p>
      </header>

      {/* 1 — Setup */}
      <Section n="I" title="Muster your battle-plan">
        <P>
          Open <Lnk to="/plan">Battle-Plan</Lnk> and work down the three steps:
        </P>
        <UL>
          <li><B>Target</B> — pick the raid boss in the centre, or one of its primes (mini-bosses) on either side.</li>
          <li><B>Map</B> — choose the board for this encounter; the planner loads its real hex grid, terrain and starting enemies.</li>
          <li><B>Raid Team</B> — fill up to five squad slots and an optional Machine of War. Tap a slot, search or filter by faction, and pick.</li>
        </UL>
        <P>
          Signed in, you can also save the current squad as a reusable <B>raid team</B> and refill it with
          one tap next time (see the FAQ). When the squad is set, hit <B>Engage</B>.
        </P>
        <Shot src="setup.png" alt="The three-step setup: target, map and raid team" />
      </Section>

      {/* 2 — The board */}
      <Section n="II" title="Read the board">
        <P>
          The board is the in-game map at true scale. Your boss starts on its spawn hex, the encounter&apos;s
          starting enemies are already placed, and tinted hexes mark deployment zones.
        </P>
        <UL>
          <li><B>Tokens</B> — squad teal, allied summons light blue, the boss purple, enemy adds light purple, Machine of War brass.</li>
          <li><B>Dock</B> (bottom) — the <B>Allies</B> / <B>Enemies</B> tabs hold your placeable units plus a dashed palette of summons and adds. <B>View</B> toggles elevation tint and, on deployment, how many primes are down.</li>
          <li><B>Tools / Undo / turn selector</B> sit along the bottom bar; <B>Save</B> (top-right) stores the plan to your account.</li>
        </UL>
        <Shot src="board.png" alt="The planning board with tokens, dock and turn selector" />
      </Section>

      {/* 3 — Placing & moving */}
      <Section n="III" title="Deploy & maneuver">
        <P>
          Tap a unit chip in the dock, then tap a hex to place it. Drag a placed token to move it — the
          boss&apos;s multi-hex footprint previews where it will land. Selecting a unit reveals edge actions:
          <B> Remove</B>, and <B>Rotate</B> for multi-hex units.
        </P>
        <P>
          Tap a palette chip (the dashed ones) to drop summons or extra adds — each tap creates one, so you
          can place several. Everything you do is undoable from the <B>Undo</B> button.
        </P>
      </Section>

      {/* 4 — Turns */}
      <Section n="IV" title="Chart the six turns">
        <P>
          A fight is six turns, and each turn has a <B>player</B> phase and an <B>enemy</B> phase. The
          selector shows <B>S</B> (deployment, green), then each turn as <B>1…6</B> (blue = player,
          red = enemy). Arrows step through the sequence; tapping the active number toggles
          player ↔ enemy.
        </P>
        <P>
          Positions carry forward until you change them, and a faint arrow shows each token&apos;s move from
          the previous phase — so you can see the whole advance at a glance. The counter at the top of the
          map shows rounds remaining.
        </P>
      </Section>

      {/* 5 — Paint & hazards */}
      <Section n="V" title="Paint zones & hazards">
        <P>
          The <B>Paint</B> panel on the board edge marks the map. Pick a colour to highlight zones (paint
          lives for the phase you draw it on plus the next), or a hazard stamp — <B>fire</B>, <B>ice</B>,
          <B> contaminated</B> — which decay round by round with a remaining-rounds badge. The rubber erases
          any tile. Drag to paint a streak; drag from a painted hex to erase along the path.
        </P>
        <Shot src="paint.png" alt="The paint panel with colours, hazard stamps and the rubber" />
      </Section>

      {/* 6 — Save & share */}
      <Section n="VI" title="Save & share">
        <P>
          Without an account your plan lives in this browser. Sign in (Google, email, or Discord) and you
          can <B>Save</B> named plans to the cloud, reopen them from <Lnk to="/plans">My Plans</Lnk>, and
          <B> share</B> a plan: toggle sharing on a plan card to get a link anyone can open as a read-only
          board (they can also copy it into their own plans). Toggle it off to revoke the link.
        </P>
      </Section>

      {/* FAQ */}
      <section className="panel space-y-1 p-4">
        <p className="eyebrow mb-2">Frequently Asked</p>
        <Q q="Do I need an account?">
          No — the planner works fully without signing in; your plan is saved in your browser. An account
          only adds cloud-saved plans, saved raid teams, and sharing.
        </Q>
        <Q q="How do saved raid teams work?">
          On the Raid Team step (or the <Lnk to="/teams">My Teams</Lnk> page) you can save a squad + Machine
          of War under a name, then apply it to any future plan with one tap. Edit or delete them on My Teams.
        </Q>
        <Q q="Is my data safe? Can I delete it?">
          Plans and teams are private to your account; a shared plan is readable only by someone with its
          link, and only while you keep sharing on. You can delete any plan or team, or your whole account
          and all its data, from the <Lnk to="/account">Account</Lnk> page. See the{' '}
          <Lnk to="/legal">Privacy &amp; Terms</Lnk>.
        </Q>
        <Q q="Why Discord sign-in?">
          Tacticus is a community game and many guilds live on Discord, so it&apos;s offered alongside Google
          and email. It only reads your public Discord identity (name + avatar) — never your messages.
        </Q>
        <Q q="Is this official?">
          No. TacticusStrategium is a free, fan-made project, not affiliated with Snowprint Studios or Games
          Workshop. Map and unit data come via TacticusDB.
        </Q>
        <Q q="Is it really free?">
          Yes, and it&apos;s built to stay that way — it runs entirely on free service tiers.
        </Q>
        <Q q="A boss, map or unit is missing or wrong.">
          The game data is refreshed periodically from the source. If something&apos;s off, reach out at{' '}
          <a href="mailto:tacticusstrategium@gmail.com" className="text-teal-bright">tacticusstrategium@gmail.com</a>.
        </Q>
      </section>

      <div className="flex justify-center pt-2">
        <Link to="/plan" className="btn btn-primary px-6 py-3">
          Engage Battle-Plan
          <ChevronRight size={18} />
        </Link>
      </div>
    </div>
  )
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-3 p-4">
      <div className="flex items-baseline gap-3">
        <span className="data text-sm text-brass">{n}</span>
        <h2 className="display text-base font-bold uppercase tracking-[0.12em] text-bone">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="mt-1">
      <img
        src={asset(`images/guide/${src}`)}
        alt={alt}
        loading="lazy"
        className="mx-auto w-full max-w-[280px] rounded-lg border border-iron shadow-lg"
      />
      <figcaption className="mt-1.5 text-center font-mono text-[0.62rem] text-ash/70">{alt}</figcaption>
    </figure>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-ash">{children}</p>
}
function B({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-bone">{children}</span>
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ash">{children}</ul>
}
function Lnk({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="text-teal-bright hover:underline">{children}</Link>
}
function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-iron/50 py-2.5 first:border-t-0">
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-bone marker:content-none">
        {q}
        <ChevronRight size={15} className="shrink-0 text-ash transition-transform group-open:rotate-90" />
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-ash">{children}</p>
    </details>
  )
}
