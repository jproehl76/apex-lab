import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts';
import type { LoadedSession } from '@/types/session';
import { kphToMph, sessionLabel } from '@/lib/utils';
import { CHART_MARGINS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '@/lib/chartTheme';

interface Props {
  sessions: LoadedSession[];
}

interface ChartPoint {
  corner: string;
  [sessionId: string]: number | string;
}

function buildChartData(sessions: LoadedSession[]): ChartPoint[] {
  const cornerIds = new Set<string>();
  sessions.forEach(s => {
    Object.keys(s.data.consistency.corners).forEach(id => cornerIds.add(id));
    s.data.best_lap_corners.forEach(c => cornerIds.add(c.corner_id));
  });

  return Array.from(cornerIds).sort().map(cornerId => {
    const point: ChartPoint = { corner: cornerId };
    sessions.forEach(session => {
      const bestCorner = session.data.best_lap_corners.find(c => c.corner_id === cornerId);
      if (bestCorner) {
        point[session.id] = parseFloat(kphToMph(bestCorner.min_speed_kph).toFixed(1));
      } else {
        const consistencyCorner = session.data.consistency.corners[cornerId];
        if (consistencyCorner) {
          point[session.id] = parseFloat(kphToMph(consistencyCorner.min_speed_best).toFixed(1));
        }
      }
    });
    return point;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ marginBottom: 6, color: '#606070', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </p>
      {payload.map((entry: { color: string; name: string; value: number }) => (
        <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span style={{ color: '#606070' }}>{entry.name}</span>
          <span style={{ color: entry.color, fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
            {entry.value} mph
          </span>
        </div>
      ))}
    </div>
  );
}

export function CornerSpeedChart({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: '13px', letterSpacing: '0.08em', color: '#505060', textTransform: 'uppercase' }}>
          Load sessions to compare corner speeds
        </span>
      </div>
    );
  }

  const data = buildChartData(sessions);

  return (
    <div className="space-y-3" style={{ touchAction: 'pan-x pan-y', userSelect: 'none' }}>
      {/* Inline legend */}
      <div className="flex items-center gap-4 px-1 flex-wrap">
        {sessions.map(s => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', letterSpacing: '0.08em', color: '#505060', textTransform: 'uppercase' }}>
              {sessionLabel(s)}
            </span>
          </div>
        ))}
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', color: '#383848', marginLeft: 'auto', letterSpacing: '0.06em' }}>
          Best lap apex speed · higher = faster
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={CHART_MARGINS}>
          <CartesianGrid stroke={GRID_STYLE.stroke} vertical={false} />
          <XAxis
            dataKey="corner"
            tick={AXIS_STYLE.tick}
            axisLine={AXIS_STYLE.axisLine}
            tickLine={AXIS_STYLE.tickLine}
          />
          <YAxis
            tick={AXIS_STYLE.tick}
            axisLine={AXIS_STYLE.axisLine}
            tickLine={AXIS_STYLE.tickLine}
            tickFormatter={(v: number) => `${v}`}
            label={{ value: 'MPH', angle: -90, position: 'insideLeft', offset: 12, fill: '#404050', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: '0.1em' }}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          {sessions.map(session => (
            <Bar
              key={session.id}
              dataKey={session.id}
              name={sessionLabel(session)}
              radius={[3, 3, 0, 0]}
              maxBarSize={36}
            >
              {data.map((_, i) => (
                <Cell key={`cell-${i}`} fill={session.color} fillOpacity={0.85} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
