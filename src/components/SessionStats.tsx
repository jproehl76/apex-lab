import type { LoadedSession } from '@/types/session';
import { formatLapTime, sessionLabel, consistencyRating } from '@/lib/utils';

interface Props {
  sessions: LoadedSession[];
}

export function SessionStats({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center" style={{ fontFamily: 'BMWTypeNext', fontSize: '13px', color: '#9A9AB0' }}>
        Load sessions to see summary statistics
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map(session => {
        const { consistency, header, friction_circle } = session.data;
        const rating = consistencyRating(consistency.spread_s);
        const bestLap = formatLapTime(consistency.best_lap_s);
        const avgLap = formatLapTime(consistency.mean_lap_s);

        return (
          <div key={session.id}>
            {sessions.length > 1 && (
              <p className="mb-2" style={{ fontFamily: 'BMWTypeNext', fontSize: '12px', fontWeight: 500, color: '#C0C0D4' }}>
                {sessionLabel(session)}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {/* Best lap — hidden on desktop where LapInfoPanel already shows it */}
              <div className="card p-3 sm:p-4 col-span-2 sm:col-span-1 overflow-hidden lg:hidden" style={{ borderColor: 'rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-0.5 h-3 rounded-full shrink-0" style={{ background: '#A855F7' }} />
                  <span className="truncate" style={{ fontFamily: 'BMWTypeNext', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#705080' }}>Best Lap</span>
                </div>
                <div className="truncate" style={{ fontFamily: 'JetBrains Mono', fontSize: 'clamp(20px, 5.5vw, 28px)', fontWeight: 600, color: '#A855F7', lineHeight: 1, textShadow: '0 0 20px rgba(168,85,247,0.35)' }}>{bestLap}</div>
                <div style={{ fontFamily: 'BMWTypeNext', fontSize: '11px', letterSpacing: '0.1em', color: '#9A9AB0', marginTop: 5, textTransform: 'uppercase' }}>
                  {header.analyzed_laps} laps analyzed
                </div>
              </div>

              {/* Spread */}
              <KpiCard
                label="Spread"
                value={`${consistency.spread_s.toFixed(1)}s`}
                valueColor={rating.color}
                subtext={rating.label}
                dotColor={rating.color}
                quality={Math.max(0, 100 - (consistency.spread_s / 8) * 100)}
              />

              {/* Avg Lap */}
              <KpiCard
                label="Avg Lap"
                value={avgLap}
                subtext={`${header.duration_minutes.toFixed(1)} min`}
              />

              {/* Peak Lat G */}
              <KpiCard
                label="Peak Lat G"
                value={`${friction_circle.peak_lat_g.toFixed(2)}G`}
                subtext={`>${friction_circle.time_above_08g_pct.toFixed(1)}% >0.8G`}
                dotColor="#EC4899"
              />
            </div>

            {/* Missing channels warning */}
            {header.channels_missing.length > 0 && (
              <p className="mt-2" style={{ fontFamily: 'BMWTypeNext', fontSize: '11px', color: '#F59E0B' }}>
                Missing channels: {header.channels_missing.join(', ')}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  valueColor?: string;
  subtext?: string;
  dotColor?: string;
  /** 0–100 quality score: 100 = best, shown as thin bottom bar */
  quality?: number;
}

function KpiCard({ label, value, valueColor, subtext, dotColor, quality }: KpiCardProps) {
  return (
    <div className="card p-3 sm:p-4 flex flex-col gap-1 overflow-hidden relative">
      <div className="flex items-center gap-1.5 mb-1">
        {dotColor && <div className="w-0.5 h-3 rounded-full flex-shrink-0" style={{ background: dotColor }} />}
        <span className="truncate" style={{ fontFamily: 'BMWTypeNext', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9A9AB0' }}>
          {label}
        </span>
      </div>
      <div className="truncate" style={{ fontFamily: 'JetBrains Mono', fontSize: 'clamp(16px, 4.5vw, 26px)', fontWeight: 500, color: valueColor ?? '#E0E0EE', lineHeight: 1 }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontFamily: 'BMWTypeNext', fontSize: '11px', letterSpacing: '0.08em', color: '#9A9AB0', marginTop: 3 }}>{subtext}</div>
      )}
      {quality !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border/30">
          <div className="h-full transition-all duration-500" style={{ width: `${Math.min(100, quality)}%`, background: dotColor ?? '#059669' }} />
        </div>
      )}
    </div>
  );
}
