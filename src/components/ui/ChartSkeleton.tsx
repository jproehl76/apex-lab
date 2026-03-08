interface Props {
  height?: number;
  rows?: number;   // alternative: skeleton table rows
  className?: string;
}

/** Pulsing placeholder shown while chart data is loading. */
export function ChartSkeleton({ height = 180, className = '' }: Props) {
  return (
    <div
      className={`w-full rounded-lg animate-pulse ${className}`}
      style={{
        height,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.045) 50%, rgba(255,255,255,0.025) 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
        border: '1px solid hsl(var(--border))',
      }}
    />
  );
}

/** Pulsing placeholder for a list of metric rows. */
export function MetricSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-2.5 rounded-full animate-pulse bg-border" style={{ width: `${30 + (i % 3) * 15}%` }} />
          <div className="h-2.5 rounded-full animate-pulse bg-border ml-auto" style={{ width: '12%' }} />
        </div>
      ))}
    </div>
  );
}
