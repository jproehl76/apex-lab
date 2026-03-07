import { Skeleton } from '@/components/ui/skeleton';

interface ChartSkeletonProps {
  rows?: number;
  height?: number;
}

/**
 * Placeholder shown while a chart's data is loading or unavailable.
 * Matches the typical chart card height.
 */
export function ChartSkeleton({ rows = 1, height = 180 }: ChartSkeletonProps) {
  return (
    <div className="space-y-2" style={{ minHeight: height }}>
      {/* Simulated axis label row */}
      <div className="flex gap-2">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-12" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="w-full rounded" style={{ height: Math.max(40, height / rows - 12) }} />
      ))}
      {/* Simulated x-axis labels */}
      <div className="flex justify-between pt-1">
        {[1, 2, 3, 4, 5].map(n => (
          <Skeleton key={n} className="h-2 w-6" />
        ))}
      </div>
    </div>
  );
}
