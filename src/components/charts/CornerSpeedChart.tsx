import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer,
} from 'recharts';
import type { LoadedSession } from '@/types/session';
import { kphToMph, sessionLabel } from '@/lib/utils';
import { CHART_MARGINS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, TOOLTIP_HEADER_STYLE, LEGEND_LABEL_STYLE, SESSION_COLORS, T, FF, FS, S, axisLabel } from '@/lib/chartTheme';

interface Props {
  sessions: LoadedSession[];
}

interface CornerRow {
  label: string;
  [sessionId: string]: number | string;
}

function mph(kph: number) { return parseFloat(kphToMph(kph).toFixed(1)); }

function buildChartData(sessions: LoadedSession[]): CornerRow[] {
  const allIds = new Set<string>();
  sessions.forEach(s => s.data.best_lap_corners.forEach(c => allIds.add(c.corner_id.toUpperCase())));

  return Array.from(allIds).sort().map(id => {
    const row: CornerRow = { label: id };
    sessions.forEach(s => {
      const c = s.data.best_lap_corners.find(b => b.corner_id.toUpperCase() === id);
      if (c) row[s.id] = mph(c.min_speed_kph);
    });
    return row;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, sessions }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TOOLTIP_STYLE, minWidth: 160 }}>
      <p style={TOOLTIP_HEADER_STYLE}>{label}</p>
      {payload.map((entry: { dataKey: string; value: number }) => {
        const s = sessions.find((s: LoadedSession) => s.id === entry.dataKey);
        return (
          <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
            <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: s?.color ?? T.label }}>{s ? sessionLabel(s) : entry.dataKey}</span>
            <span style={{ fontFamily: FF.mono, fontWeight: 700, fontSize: `${FS.value}px`, color: T.fg }}>
              {entry.value} <span style={{ fontSize: `${FS.nano}px`, color: T.muted }}>mph</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Map apex speed to a heat color — red=slow, amber=mid, green=fast */
function heatColor(value: number, min: number, max: number): string {
  if (max <= min) return '#1C69D4';
  const t = (value - min) / (max - min);
  if (t >= 0.7)  return '#22C55E';
  if (t >= 0.35) return '#F59E0B';
  return '#EF4444';
}

export function CornerSpeedChart({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase' }}>
          Load sessions to compare apex speeds
        </span>
      </div>
    );
  }

  const data = buildChartData(sessions);

  // Global min/max for heat coloring
  const allValues = data.flatMap(row =>
    sessions.map(s => (row[s.id] as number | undefined) ?? NaN)
  ).filter(v => !isNaN(v));
  const globalMin = Math.min(...allValues);
  const globalMax = Math.max(...allValues);

  // Multi-session: use session colors; single session: heat map
  const useHeat = sessions.length === 1;

  return (
    <div className="space-y-3" style={{ touchAction: 'pan-x pan-y', userSelect: 'none' }}>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1 flex-wrap">
        {useHeat ? (
          <div className="flex items-center gap-3 ml-auto">
            {[['#22C55E', 'Faster'], ['#F59E0B', 'Mid'], ['#EF4444', 'Slower']].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color }} />
                <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.08em', color: T.muted }}>{label}</span>
              </span>
            ))}
          </div>
        ) : (
          sessions.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: SESSION_COLORS[i % SESSION_COLORS.length] }} />
              <span style={LEGEND_LABEL_STYLE}>{sessionLabel(s)}</span>
            </div>
          ))
        )}
      </div>

      {/* Apex speed bar chart */}
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={CHART_MARGINS} barCategoryGap="28%">
          <CartesianGrid stroke={GRID_STYLE.stroke} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_STYLE.tick} axisLine={AXIS_STYLE.axisLine} tickLine={AXIS_STYLE.tickLine} />
          <YAxis
            tick={AXIS_STYLE.tick}
            axisLine={AXIS_STYLE.axisLine}
            tickLine={AXIS_STYLE.tickLine}
            label={axisLabel('MPH', 'insideLeft')}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip sessions={sessions} />} />
          {sessions.map((session, si) => (
            <Bar key={session.id} dataKey={session.id} name={sessionLabel(session)} radius={[4, 4, 0, 0]} maxBarSize={44}>
              {data.map((row, i) => {
                const val = (row[session.id] as number) ?? 0;
                const color = useHeat
                  ? heatColor(val, globalMin, globalMax)
                  : SESSION_COLORS[si % SESSION_COLORS.length];
                return <Cell key={i} fill={color} fillOpacity={0.9} />;
              })}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Multi-session: apex speed delta tiles */}
      {sessions.length >= 2 && (() => {
        const [s1, s2] = sessions;
        const deltas = data.map(row => {
          const a = row[s1.id] as number | undefined;
          const b = row[s2.id] as number | undefined;
          if (a == null || b == null) return null;
          return { corner: row.label, delta: parseFloat((b - a).toFixed(1)) };
        }).filter(Boolean) as { corner: string; delta: number }[];

        if (!deltas.length) return null;
        return (
          <div>
            <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginBottom: 8 }}>
              Apex delta — {sessionLabel(s2)} vs {sessionLabel(s1)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {deltas.map(({ corner, delta }) => {
                const color = delta > 0.5 ? S.good : delta < -0.5 ? S.bad : S.warn;
                return (
                  <div key={corner} className="flex flex-col items-center rounded px-2 py-1.5"
                    style={{ background: `${color}10`, border: `1px solid ${color}28`, minWidth: 44 }}>
                    <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.08em', color: T.muted }}>{corner}</span>
                    <span style={{ fontFamily: FF.mono, fontSize: `${FS.value}px`, fontWeight: 700, color, lineHeight: 1.3 }}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                    <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted }}>mph</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
