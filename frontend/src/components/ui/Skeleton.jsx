// A single shimmer primitive every loading state should compose from,
// replacing bare "Loading…" text. Respects prefers-reduced-motion via the
// shared CSS rule (the shimmer keyframe is suppressed there like every
// other animation in the app).
export default function Skeleton({ width = '100%', height = 16, radius = 6, className = '' }) {
  return (
    <span
      className={`ui-skeleton ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="ui-card ui-card-pad-md">
      <Skeleton width={32} height={32} radius={8} className="ui-skeleton-block" />
      <Skeleton width="60%" height={18} className="ui-skeleton-block" />
      <Skeleton width="40%" height={13} className="ui-skeleton-block" />
    </div>
  )
}
