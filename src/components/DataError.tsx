import { RefreshCw, TriangleAlert } from 'lucide-react'

/**
 * Themed fetch-failure notice with a retry action. Default is a bordered panel;
 * `compact` renders a slim one-line banner (for secondary data on busy screens).
 */
export function DataError({
  what,
  onRetry,
  compact,
}: {
  what: string
  onRetry: () => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-blood bg-abyss/90 px-2.5 py-1.5 backdrop-blur">
        <TriangleAlert size={14} className="shrink-0 text-blood-bright" />
        <span className="text-xs text-bone">Failed to load {what}</span>
        <button
          onClick={onRetry}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-teal-bright transition-colors hover:text-bone"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-blood bg-blood/10 px-5 py-4 text-center">
      <TriangleAlert size={20} className="text-blood-bright" />
      <div>
        <p className="eyebrow text-blood-bright">++ Auspex link severed ++</p>
        <p className="mt-1 text-sm text-bone">Failed to load {what}.</p>
        <p className="text-xs text-ash">Check your connection, then re-establish the feed.</p>
      </div>
      <button onClick={onRetry} className="btn">
        <RefreshCw size={15} />
        Retry
      </button>
    </div>
  )
}
