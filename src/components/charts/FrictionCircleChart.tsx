import type { LoadedSession } from '@/types/session';
import { sessionLabel } from '@/lib/utils';
import { TOOLTIP_STYLE } from '@/lib/chartTheme';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend, Tooltip,
} from 'recharts';

interface Props {
  sessions: LoadedSession[];
}

interface RadarPoint {
  metric: string;
  fullMark: number;
  [sessionId: string]: number | string;
}

function buildRadarData(sessions: LoadedSession[]): RadarPoint[] {
  const metrics: Array<{ key: keyof typeof sessions[0]['data']['friction_circle'] | 'consistency'; label: string; scale: number }> = [
    { key: 'total_g_p95', label: 'G-Force P95', scale: 2 },
    { key: 'time_above_08g_pct', label: '>0.8G Time %', scale: 20 },
    { key: 'peak_lat_g', label: 'Peak Lateral G', scale: 2 },
    { key: 'consistency', label: 'Consistency', scale: 10 },
    { key: 'time_above_10g_pct', label: '>1.0G Time %', scale: 5 },
  ];

  return metrics.map(({ key, label, scale }) => {
    const point: RadarPoint = { metric: label, fullMark: 100 };
    sessions.forEach(s => {
      let raw: number;
      if (key === 'consistency') {
        const spread = s.data.consistency.spread_s;
        raw = Math.max(0, 10 - spread);
      } else {
        raw = s.data.friction_circle[key as keyof typeof s.data.friction_circle] as number;
      }
      point[s.id] = parseFloat(Math.min(100, (raw / scale) * 100).toFixed(1));
    });
    return point;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      {payload.map((entry: { color: string; name: string; value: number }) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: <span>{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export function FrictionCircleChart({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center" style={{ fontFamily: 'Barlow Condensed', fontSize: '13px', color: '#606070' }}>
        Load sessions to see driver development radar
      </div>
    );
  }

  const data = buildRadarData(sessions);

  return (
    <div className="space-y-2" style={{ touchAction: 'pan-x pan-y', userSelect: 'none' }}>
      <p style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', color: '#606070' }}>
        Normalized scores (0–100). Higher = better. Consistency inverts spread — lower spread = higher score.
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={data} margin={{ top: 16, right: 32, left: 32, bottom: 16 }}>
          <PolarGrid stroke="#2E2E3C" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: '#9898A8', fontSize: 11, fontFamily: 'Barlow Condensed' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontFamily: 'Barlow Condensed', fontSize: '12px' }}
            formatter={(value) => {
              const s = sessions.find(s => s.id === value);
              return <span style={{ color: '#9898A8', fontFamily: 'Barlow Condensed' }}>{s ? sessionLabel(s) : value}</span>;
            }}
          />
          {sessions.map(session => (
            <Radar
              key={session.id}
              name={session.id}
              dataKey={session.id}
              stroke={session.color}
              fill={session.color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
