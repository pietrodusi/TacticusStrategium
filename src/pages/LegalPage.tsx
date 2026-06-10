import { Link } from 'react-router-dom'

// Dedicated data-requests address — create it, then replace the placeholder.
const CONTACT_EMAIL = 'REPLACE_ME@example.com'

const EFFECTIVE_DATE = '10 June 2026'

/** Privacy policy + terms of use (GDPR Art. 13 notice; light terms). */
export function LegalPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <header className="mb-1">
        <p className="eyebrow">++ Lex Imperialis ++</p>
        <h1 className="display text-2xl font-bold uppercase tracking-[0.1em] text-bone sm:text-3xl">
          Privacy &amp; Terms
        </h1>
        <p className="mt-1 font-mono text-[0.68rem] text-ash">Effective {EFFECTIVE_DATE}</p>
      </header>

      <section id="privacy" className="panel space-y-3 p-4">
        <H>Privacy Policy</H>

        <H2>Who is responsible</H2>
        <P>
          TacticusStrategium (pietrodusi.github.io/TacticusStrategium) is a free, fan-made hobby project
          operated by Pietro Dusi, who acts as the data controller for the personal data described below.
          Contact for any privacy matter or data request:{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-bright">{CONTACT_EMAIL}</a>.
        </P>

        <H2>What data we process, and why</H2>
        <P>
          You can use the planner without an account; nothing personal is collected then — your
          battle-plan lives only in your browser's local storage.
        </P>
        <P>If you create an account (Google, email &amp; password, or Discord), we process:</P>
        <UL>
          <li>
            <B>Account data</B> — your email address, display name, avatar image URL and the identifier
            from your sign-in provider (Google account, Discord id). Used solely to operate your account.
          </li>
          <li>
            <B>Your content</B> — the battle-plans and raid teams you choose to save, linked to your
            account so only you can access them.
          </li>
        </UL>
        <P>
          The legal basis is the performance of the service you request by creating an account
          (GDPR Art. 6(1)(b)). We do <B>not</B> run analytics, advertising or any tracking; there are no
          marketing cookies and therefore no cookie banner. Browser storage (localStorage / IndexedDB) is
          used only for strictly necessary functions: your local plan and your sign-in session.
        </P>

        <H2>Where the data lives</H2>
        <UL>
          <li>
            <B>Google Firebase</B> (Authentication and the Firestore database, EU multi-region
            <span className="font-mono"> eur3</span>) stores account data and saved content under
            Google's data-processing terms.
          </li>
          <li>
            <B>Cloudflare Workers</B> briefly processes the Discord sign-in handshake; nothing is stored
            there.
          </li>
          <li>
            <B>Discord</B> (if you sign in with it) shares only your public identity (id, username,
            avatar) under Discord's own privacy policy; we never see your Discord email or messages.
          </li>
          <li>
            <B>GitHub Pages</B> serves the static website; GitHub may keep standard technical server
            logs under its own privacy policy.
          </li>
        </UL>

        <H2>Sharing</H2>
        <P>
          A saved plan is private until you switch sharing on, which makes it readable by anyone holding
          its link. You can switch sharing off at any time, which revokes the link. Raid teams are never
          shared.
        </P>

        <H2>Retention &amp; deletion</H2>
        <P>
          Everything is kept until you delete it. Deleting a plan or team removes it immediately and
          permanently. You can delete your entire account — including all saved plans and teams — at any
          time from the <Link to="/account" className="text-teal-bright">Account</Link> page; this is
          immediate and irreversible.
        </P>

        <H2>Your rights</H2>
        <P>
          Under the GDPR you can request access, rectification, erasure, portability of, or objection to
          the processing of your data — use the Account page or write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-bright">{CONTACT_EMAIL}</a>. You also
          have the right to lodge a complaint with a supervisory authority (in Italy, the Garante per la
          protezione dei dati personali).
        </P>

        <H2>Children</H2>
        <P>This service is not directed at children under 16.</P>

        <H2>Changes</H2>
        <P>
          If this policy changes materially, the effective date above is updated and significant changes
          are noted on this page.
        </P>
      </section>

      <section id="terms" className="panel space-y-3 p-4">
        <H>Terms of Use</H>
        <UL>
          <li>
            TacticusStrategium is an unofficial, free fan project. It is not affiliated with, endorsed by
            or connected to Snowprint Studios or Games Workshop. All related trademarks belong to their
            owners. Map and unit data are sourced via TacticusDB.
          </li>
          <li>
            Content you save remains yours. You are responsible for what you create and share — don't use
            plan or team names that are unlawful or offensive; such content may be removed.
          </li>
          <li>Don't abuse the service (no scraping accounts, attacking the backend or other users' data).</li>
          <li>
            The service is provided “as is”, free of charge, with no warranty of availability or fitness
            for purpose; it may change or be discontinued at any time. Liability is limited to the
            maximum extent permitted by law.
          </li>
        </UL>
        <p className="border-t border-iron/50 pt-3 font-mono text-[0.65rem] text-ash/70">
          This notice is written in good faith for a small, free hobby project; it is not legal advice.
        </p>
      </section>
    </div>
  )
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display text-base font-bold uppercase tracking-[0.12em] text-bone">{children}</h2>
}
function H2({ children }: { children: React.ReactNode }) {
  return <h3 className="eyebrow pt-1">{children}</h3>
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
