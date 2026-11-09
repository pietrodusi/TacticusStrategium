import { usePortraitSource } from '../hooks/usePortraitSource'

/**
 * Unit portrait that degrades gracefully: Snowprint CDN → TacticusDB round →
 * TacticusDB square → initial-letter placeholder, so a missing asset never
 * shows as a broken image.
 */
export function UnitImage({
  stem,
  alt,
  round = true,
  className = '',
  style,
}: {
  stem: string | null
  alt: string
  round?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const { src, onError } = usePortraitSource(stem, round)

  if (!src) {
    return (
      <div className={`grid place-items-center bg-steel-2 text-ash ${className}`} style={style} aria-label={alt}>
        {alt.charAt(0)}
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" className={className} style={style} onError={onError} />
}
