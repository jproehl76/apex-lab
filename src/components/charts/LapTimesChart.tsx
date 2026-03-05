import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import type { LoadedSession } from '@/types/session';
import { formatLapTime, sessionLabel } from '@/lib/utils';
import { CHART_MARGINS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '@/lib/chartTheme';

interface Props {
  sessions: LoadedSession[];
}

interface ChartPoint {
  lap: number;
  [sessionId: string]: number;
}

function buildChartData(sessions: LoadedSession[]): ChartPoint[] {
  const maxLaps = Math.max(...sessions.map(s => s.data.laps.filter(l => !l.is_outlier).length), 0);
  const points: ChartPoint[] = [];

  for (let i = 1; i <= maxLaps; i++) {
    const point: ChartPoint = { lap: i };
    sessions.forEach(session => {
      const lap = session.data.laps.find(l => l.lap_num === i && !l.is_outlier);
      if (lap) point[session.id] = lap.lap_time_s;
    });
    points.push(point);
  }

  return points;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ marginBottom: 6, color: '#606070', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Lap {label}
      </p>
      {payload.map((entry: { color: string; name: string; value: number }) => (
        <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span style={{ color: '#606070' }}>{entry.name}</span>
          <span style={{ color: entry.color, fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
            {formatLapTime(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LapTimesChart({ sessions }: Props) {
  if (sessions.length === 0) {
    return <EmptyState message="Load sessions to see lap time progression" />;
  }

  const data = buildChartData(sessions);

  const bestLaps = sessions.map(s => ({
    id: s.id,
    color: s.color,
    best: s.data.consistency.best_lap_s,
    label: sessionLabel(s),
  }));

  return (
    <div className="space-y-3" style={{ touchAction: 'pan-x pan-y', userSelect: 'none' }}>
      {/* Inline legend */}
      <div className="flex items-center gap-4 px-1 flex-wrap">
        {bestLaps.map(({ id, color, label }) => (
          <div key={id} className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 rounded" style={{ background: color }} />
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', letterSpacing: '0.08em', color: '#505060', textTransform: 'uppercase' }}>
              {label}
            </span>
          </div>
        ))}
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', color: '#383848', marginLeft: 'auto', letterSpacing: '0.06em' }}>
          Outlier laps excluded · dashed = best lap
        </span>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={data} margin={CHART_MARGINS}>
          <CartesianGrid stroke={GRID_STYLE.stroke} vertical={false} />
          <XAxis
            dataKey="lap"
            tick={AXIS_STYLE.tick}
            axisLine={AXIS_STYLE.axisLine}
            tickLine={AXIS_STYLE.tickLine}
            label={{ value: 'LAP', position: 'insideBottom', offset: -6, fill: '#404050', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: '0.1em' }}
          />
          <YAxis
            tick={AXIS_STYLE.tick}
            axisLine={AXIS_STYLE.axisLine}
            tickLine={AXIS_STYLE.tickLine}
            tickFormatter={(v: number) => formatLapTime(v)}
            width={76}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          {bestLaps.map(({ id, color, best }) => (
            <ReferenceLine
              key={`ref-${id}`}
              y={best}
              stroke={color}
              strokeDasharray="5 3"
              strokeOpacity={0.4}
            />
          ))}
          {sessions.map(session => (
            <Line
              key={session.id}
              type="monotone"
              dataKey={session.id}
              name={sessionLabel(session)}
              stroke={session.color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: session.color, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center">
      <span style={{ fontFamily: 'Barlow Condensed', fontSize: '13px', letterSpacing: '0.08em', color: '#505060', textTransform: 'uppercase' }}>
        {message}
      </span>
    </div>
  );
}
