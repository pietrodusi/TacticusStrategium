/** Rounds still to play — a notch hanging from the top bar, centred over the
 *  map (same family as the Paint/Remove edge notches). */
export function RoundsCounter({ left }: { left: number }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-b-xl border border-t-0 border-iron bg-abyss/90 px-3 pb-1.5 pt-1 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-bone backdrop-blur">
      {left <= 1 ? 'Last round' : `${left} rounds left`}
    </div>
  )
}
