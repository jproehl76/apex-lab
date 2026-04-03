import type { LoadedSession } from '@/types/session';
import { formatLapTime } from '@/lib/utils';
import { FF, FS, T } from '@/lib/chartTheme';

interface Props { sessions: LoadedSession[] }

// F1 timing screen conventions
const PURPLE = '#A855F7';  // session best
const GREEN  = '#22C55E';  // improved vs avg
const YELLOW = '#F59E0B';  // slower than avg

function deltaColor(delta: number): string {
  if (delta < -0.05) return GREEN;   // faster than avg
  if (delta >  0.05) return YELLOW;  // slower than avg
  return T.label;                    // within noise
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}`;
}

export function LapInfoPanel({ sessions }: Props) {
  if (sessions.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-border">
      {sessions.map((session, si) => {
        const cleanLaps = session.data.laps.filter(l => !l.is_outlier);
        if (cleanLaps.length === 0) return null;

        // Best lap
        const bestLap = cleanLaps.reduce((b, l) => l.lap_time_s < b.lap_time_s ? l : b, cleanLaps[0]);
        const hasSectors = (bestLap.sector_times?.length ?? 0) > 0;

        // Per-sector: best time, average time
        const sectorBests = hasSectors
          ? bestLap.sector_times.map((_, s2) =>
              Math.min(...cleanLaps.map(l => l.sector_times?.[s2] ?? Infinity))
            )
          : [];

        const sectorAvgs = hasSectors
          ? bestLap.sector_times.map((_, s2) => {
              const times = cleanLaps.map(l => l.sector_times?.[s2]).filter(v => v != null && v > 0) as number[];
              return times.length ? times.reduce((a, b2) => a + b2, 0) / times.length : null;
            })
          : [];

        const accentColor = session.color;

        return (
          <div key={session.id}
            className="px-3 py-2.5 space-y-2"
            style={{ borderLeft: si === 0 ? `2px solid ${accentColor}` : `2px solid ${accentColor}40` }}>

            {/* ── Best lap + lap meta ── */}
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span style={{
                  fontFamily: FF.mono,
                  fontSize: sessions.length > 1 ? '20px' : '26px',
                  fontWeight: 700,
                  color: PURPLE,
                  lineHeight: 1,
                  textShadow: `0 0 20px ${PURPLE}50`,
                }}>
                  {formatLapTime(session.data.consistency.best_lap_s)}
                </span>
                <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>
                  Best
                </span>
              </div>
              <div className="text-right">
                <div style={{ fontFamily: FF.mono, fontSize: `${FS.small}px`, color: T.label }}>
                  L{bestLap.lap_num}
                </div>
                <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted }}>
                  {cleanLaps.length} laps
                </div>
              </div>
            </div>

            {/* ── Sector splits with delta vs avg ── */}
            {hasSectors && (
              <div className="space-y-1.5">
                <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>
                  Best lap sectors vs avg
                </div>
                <div className="flex gap-1.5">
                  {bestLap.sector_times.map((t, s2) => {
                    const isBest  = t <= (sectorBests[s2] ?? Infinity) + 0.001;
                    const avg     = sectorAvgs[s2];
                    const delta   = avg != null ? t - avg : null;
                    const baseColor = isBest ? PURPLE : GREEN;
                    const delColor  = delta != null ? deltaColor(delta) : T.muted;

                    return (
                      <div key={s2} className="flex-1 rounded px-2 py-1.5"
                        style={{ background: `${baseColor}12`, border: `1px solid ${baseColor}30` }}>
                        {/* Sector label */}
                        <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: `${baseColor}90`, marginBottom: 2 }}>
                          S{s2 + 1}
                        </div>
                        {/* Sector time */}
                        <div style={{ fontFamily: FF.mono, fontSize: `${FS.small}px`, fontWeight: 700, color: baseColor, lineHeight: 1.2 }}>
                          {t.toFixed(2)}
                        </div>
                        {/* Delta vs average */}
                        {delta != null && (
                          <div style={{ fontFamily: FF.mono, fontSize: `${FS.nano}px`, color: delColor, marginTop: 2, lineHeight: 1 }}>
                            {formatDelta(delta)}
                          </div>
                        )}
                        {/* Average in muted */}
                        {avg != null && (
                          <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, marginTop: 1 }}>
                            avg {avg.toFixed(2)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Multi-session sector delta row ── */}
            {sessions.length > 1 && si > 0 && hasSectors && (() => {
              const s0 = sessions[0];
              const s0Best = s0.data.laps.filter(l => !l.is_outlier).reduce((b, l) => l.lap_time_s < b.lap_time_s ? l : b, s0.data.laps[0]);
              if (!s0Best?.sector_times?.length) return null;
              const deltas = bestLap.sector_times.map((t, s2) => ({
                delta: t - (s0Best.sector_times[s2] ?? t),
                si2: s2,
              }));
              return (
                <div className="space-y-1">
                  <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted }}>
                    vs session 1
                  </div>
                  <div className="flex gap-1.5">
                    {deltas.map(({ delta, si2 }) => {
                      const dc = delta < -0.05 ? GREEN : delta > 0.05 ? YELLOW : T.label;
                      return (
                        <div key={si2} className="flex-1 text-center rounded px-1 py-1"
                          style={{ background: `${dc}10`, border: `1px solid ${dc}25` }}>
                          <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted }}>S{si2 + 1}</div>
                          <div style={{ fontFamily: FF.mono, fontSize: `${FS.small}px`, fontWeight: 700, color: dc }}>
                            {formatDelta(delta)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Consistency ── */}
            <div className="flex justify-between items-center">
              <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>
                Consistency
              </span>
              <span style={{ fontFamily: FF.mono, fontSize: `${FS.small}px`, color: T.label }}>
                ±{session.data.consistency.std_dev_s.toFixed(2)}s
              </span>
            </div>

          </div>
        );
      })}
    </div>
  );
}
