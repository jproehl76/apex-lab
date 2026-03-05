import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import type { LoadedSession, FrictionScatterPoint } from '@/types/session';
import { sessionLabel } from '@/lib/utils';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '@/lib/chartTheme';

function pointColor(totalG: number): string {
  if (totalG > 0.8) return '#00C853';
  if (totalG >= 0.5) return '#1C69D4';
  return '#252535';
}

interface ScatterDot {
  x: number;
  y: number;
  totalG: number;
}

interface Props {
  sessions: LoadedSession[];
}

export function FrictionScatterChart({ sessions }: Props) {
  const seriesData = useMemo(
    () =>
      sessions.map(session => ({
        session,
        points: (session.data.friction_circle.scatter_points ?? []).map(
          (p: FrictionScatterPoint): ScatterDot => ({
            x: p.lat_g,
            y: p.long_g,
            totalG: p.total_g,
          })
        ),
      })),
    [sessions]
  );

  const hasData = seriesData.some(s => s.points.length > 0);

  if (!hasData) {
    return (
      <p style={{ fontFamily: 'BMWTypeNext', fontSize: '12px', color: '#606070' }}>
        No scatter point data available. Ensure the preprocessor outputs friction_circle.scatter_points.
      </p>
    );
  }

  return (
    <div className="space-y-2" style={{ touchAction: 'pan-x pan-y', userSelect: 'none' }}>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid
            stroke={GRID_STYLE.stroke}
            vertical={GRID_STYLE.vertical}
          />
          <XAxis
            type="number"
            dataKey="x"
            domain={[-2, 2]}
            tick={AXIS_STYLE.tick}
            axisLine={AXIS_STYLE.axisLine}
            tickLine={AXIS_STYLE.tickLine}
            label={{ value: '← Left   Lateral G   Right →', position: 'insideBottom', offset: -10, fill: '#606070', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[-2, 2]}
            tick={AXIS_STYLE.tick}
            axisLine={AXIS_STYLE.axisLine}
            tickLine={AXIS_STYLE.tickLine}
            label={{ value: 'Longitudinal G', angle: -90, position: 'insideLeft', fill: '#606070', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          />
          <ReferenceLine y={0} stroke="#2E2E3C" />
          <ReferenceLine x={0} stroke="#2E2E3C" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number | undefined, name: string | undefined) => {
              if (value === undefined) return String(value);
              if (name === 'x') return [`${value.toFixed(2)}G`, 'Lateral'] as [string, string];
              if (name === 'y') return [`${value.toFixed(2)}G`, 'Longitudinal'] as [string, string];
              if (name === 'totalG') return [`${value.toFixed(2)}G`, 'Total G'] as [string, string];
              return String(value);
            }}
          />
          {seriesData.map(({ session, points }) => (
            <Scatter
              key={session.id}
              name={sessionLabel(session)}
              data={points}
              opacity={sessions.length > 1 ? 0.5 : 0.8}
            >
              {points.map((point, i) => (
                <Cell
                  key={`${session.id}-${i}`}
                  fill={pointColor(point.totalG)}
                />
              ))}
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex gap-5 px-1">
        {[
          { color: '#00C853', label: '> 0.8G' },
          { color: '#1C69D4', label: '0.5 – 0.8G' },
          { color: '#252535', label: '< 0.5G' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
            <span style={{ fontFamily: 'BMWTypeNext', fontSize: '11px', letterSpacing: '0.1em', color: '#505060', textTransform: 'uppercase' }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
