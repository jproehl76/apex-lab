import { config } from '@/config';

/**
 * Empty state shown when no session is loaded.
 * Displays accent stripes and instructions for loading data.
 */
export function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center min-h-[300px]">
      {/* Accent stripes as empty state decoration */}
      <div className="flex items-center gap-[4px]" style={{ height: 48, opacity: 0.12 }}>
        {config.stripeColors.map((c, i) => (
          <div key={i} style={{ width: 8, height: '100%', background: c, borderRadius: 1 }} />
        ))}
      </div>
      <div className="space-y-1">
        <p
          style={{
            fontFamily: 'BMWTypeNext',
            fontSize: 15,
            letterSpacing: '0.18em',
            color: 'hsl(var(--muted-foreground))',
            opacity: 0.5,
            textTransform: 'uppercase',
          }}
        >
          No session loaded
        </p>
        <p
          style={{
            fontFamily: 'BMWTypeNext',
            fontSize: 12,
            letterSpacing: '0.12em',
            color: 'hsl(var(--muted-foreground))',
            opacity: 0.3,
            textTransform: 'uppercase',
          }}
        >
          Drop a RaceChrono CSV or load from Drive
        </p>
      </div>
    </div>
  );
}
