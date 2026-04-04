import type { LoadedSession } from '@/types/session';
import { sessionLabel, formatLapTime } from '@/lib/utils';

interface LapListProps {
  sessions: LoadedSession[];
}

/**
 * Compact scrollable lap table for the sidebar panel.
 * Shows lap times sorted by fastest, with delta from best lap.
 */
export function LapList({ sessions }: LapListProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="p-2 space-y-3">
      {sessions.map(session => {
        const clean = session.data.laps.filter(l => !l.is_outlier);
        const best = session.data.consistency.best_lap_s;
        const sorted = [...clean].sort((a, b) => a.lap_time_s - b.lap_time_s);

        if (clean.length === 0) return null;

        return (
          <div key={session.id}>
            {sessions.length > 1 && (
              <div
                style={{
                  fontFamily: 'BMWTypeNext',
                  fontSize: '12px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: session.color,
                  marginBottom: 4,
                }}
              >
                {sessionLabel(session)}
              </div>
            )}
            <div className="space-y-0.5">
              {sorted.map(lap => {
                const isBest = lap.lap_time_s === best;
                const delta = lap.lap_time_s - best;
                const deltaColor = isBest
                  ? '#A855F7'
                  : delta < 0.5
                    ? '#22C55E'
                    : delta < 1.5
                      ? '#F59E0B'
                      : '#EF4444';

                return (
                  <div
                    key={lap.lap_num}
                    className="flex items-center justify-between px-2 py-0.5 rounded"
                    style={{ background: isBest ? 'rgba(168,85,247,0.08)' : undefined }}
                  >
                    <span
                      style={{
                        fontFamily: 'BMWTypeNext',
                        fontSize: '12px',
                        color: isBest ? '#A855F7' : 'hsl(var(--muted-foreground))',
                        width: 28,
                      }}
                    >
                      L{lap.lap_num}
                    </span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono',
                        fontSize: '14px',
                        fontWeight: isBest ? 700 : 400,
                        color: isBest ? '#A855F7' : 'hsl(var(--foreground))',
                      }}
                    >
                      {formatLapTime(lap.lap_time_s)}
                    </span>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono',
                        fontSize: '12px',
                        color: deltaColor,
                        width: 44,
                        textAlign: 'right',
                      }}
                    >
                      {isBest ? '●' : `+${delta.toFixed(2)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
