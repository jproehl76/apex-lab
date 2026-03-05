import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import type { LoadedSession } from '@/types/session';
import { formatLapTime, sessionLabel } from '@/lib/utils';
import { CHART_MARGINS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, TOOLTIP_HEADER_STYLE, LEGEND_LABEL_STYLE, T, FF, FS, axisLabel } from '@/lib/chartTheme';

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
      <p style={TOOLTIP_HEADER_STYLE}>Lap {label}</p>
      {payload.map((entry: { color: string; name: string; value: number }) => (
        <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted }}>{entry.name}</span>
          <span style={{ color: entry.color, fontFamily: FF.mono, fontWeight: 700, fontSize: `${FS.value}px` }}>
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
            <span style={LEGEND_LABEL_STYLE}>{label}</span>
          </div>
        ))}
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, marginLeft: 'auto', letterSpacing: '0.06em' }}>
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
            label={axisLabel('LAP', 'insideBottom')}
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
      <span style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase' }}>
        {message}
      </span>
    </div>
  );
}
