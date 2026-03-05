import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import type { LoadedSession } from '@/types/session';
import { KPH_TO_MPH, sessionLabel } from '@/lib/utils';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '@/lib/chartTheme';

interface DeltaRow {
  cornerName: string;
  deltaMph: number;
}

function buildDeltaRows(session: LoadedSession): DeltaRow[] {
  return Object.entries(session.data.consistency.corners)
    .map(([name, corner]) => ({
      cornerName: name,
      deltaMph: corner.min_speed_delta * KPH_TO_MPH,
    }))
    .sort((a, b) => b.deltaMph - a.deltaMph);
}

function barColor(delta: number): string {
  if (delta > 3) return '#EF4444';
  if (delta > 1) return '#F59E0B';
  return '#22C55E';
}

interface Props {
  sessions: LoadedSession[];
}

export function LapDeltaChart({ sessions }: Props) {
  const sessionData = useMemo(
    () => sessions.map(s => ({ session: s, rows: buildDeltaRows(s) })),
    [sessions]
  );

  if (sessions.length === 0) {
    return (
      <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', color: '#606070' }}>
        Lap delta requires 2 or more laps in a session.
      </p>
    );
  }

  return (
    <div className="space-y-8" style={{ touchAction: 'pan-x pan-y', userSelect: 'none' }}>
      {sessionData.map(({ session, rows }) => (
        <div key={session.id} className="space-y-2">
          {sessions.length > 1 && (
            <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', fontWeight: 600, color: '#9898A8' }}>{sessionLabel(session)}</p>
          )}
          <p style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', letterSpacing: '0.06em', color: '#505060' }}>
            Corner min-speed gap vs. best lap — larger = more time available
          </p>
          {rows.length < 2 ? (
            <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', color: '#606070' }}>Insufficient corner data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid
                  stroke={GRID_STYLE.stroke}
                  vertical={GRID_STYLE.vertical}
                />
                <XAxis
                  dataKey="cornerName"
                  tick={AXIS_STYLE.tick}
                  axisLine={AXIS_STYLE.axisLine}
                  tickLine={AXIS_STYLE.tickLine}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={AXIS_STYLE.tick}
                  axisLine={AXIS_STYLE.axisLine}
                  tickLine={AXIS_STYLE.tickLine}
                  label={{ value: 'Speed gap (mph)', angle: -90, position: 'insideLeft', fill: '#606070', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number | undefined) => [value !== undefined ? `${value.toFixed(1)} mph` : '--', 'Gap vs best']}
                />
                <ReferenceLine y={0.5} stroke="#F59E0B" strokeDasharray="4 4" />
                <ReferenceLine y={3} stroke="#EF4444" strokeDasharray="4 4" />
                <Bar dataKey="deltaMph" radius={[3, 3, 0, 0]}>
                  {rows.map((row, i) => (
                    <Cell key={`${row.cornerName}-${i}`} fill={barColor(row.deltaMph)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ))}
    </div>
  );
}
