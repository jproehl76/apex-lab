import { useMemo, useState } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import type { LoadedSession, TracePoint } from '@/types/session';
import { KPH_TO_MPH, M_TO_FEET, BAR_TO_PSI, sessionLabel } from '@/lib/utils';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE, CHANNEL_COLORS } from '@/lib/chartTheme';

interface TraceRow {
  distanceFt: number;
  speedMph: number;
  throttlePct: number;
  brakePsi: number;
}

function transformTrace(points: TracePoint[]): TraceRow[] {
  return points.map(p => ({
    distanceFt: p.distance_m * M_TO_FEET,
    speedMph: Math.min(200, p.speed_kph * KPH_TO_MPH),
    throttlePct: Math.min(100, Math.max(0, p.throttle_pct)),
    brakePsi: Math.min(300, Math.max(0, p.brake_bar * BAR_TO_PSI)),
  }));
}

interface Props {
  sessions: LoadedSession[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ marginBottom: 6, color: '#606070', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {Math.round(label as number)} ft
      </p>
      {payload.map((entry: { color: string; name: string; value: number; dataKey: string }) => {
        const labels: Record<string, string> = { speedMph: 'Speed', throttlePct: 'Throttle', brakePsi: 'Brake' };
        const units: Record<string, string> = { speedMph: ' mph', throttlePct: '%', brakePsi: ' psi' };
        return (
          <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
            <span style={{ color: '#606070' }}>{labels[entry.dataKey] ?? entry.dataKey}</span>
            <span style={{ color: entry.color, fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
              {entry.value.toFixed(1)}{units[entry.dataKey] ?? ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TraceChart({ sessions }: Props) {
  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id ?? '');

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId]
  );

  const trace = activeSession?.data.best_lap_trace;

  const data = useMemo(
    () => (trace ? transformTrace(trace) : []),
    [trace]
  );

  const speedDomain = useMemo(() => {
    if (!data.length) return [0, 150] as [number, number];
    const max = Math.max(...data.map(d => d.speedMph));
    return [0, Math.ceil(max / 20) * 20] as [number, number];
  }, [data]);

  const brakePoints = useMemo(() => {
    if (!activeSession) return [];
    return activeSession.data.best_lap_corners
      .filter(c => c.brake_point_m > 0)
      .map(c => ({
        distanceFt: c.brake_point_m * M_TO_FEET,
        label: c.corner_name,
      }));
  }, [activeSession]);

  if (sessions.length === 0 || !trace || trace.length === 0) {
    return (
      <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', color: '#505060', letterSpacing: '0.06em' }}>
        Throttle/brake trace requires CAN-bus channels (brake_pres, throttle).
      </p>
    );
  }

  return (
    <div className="space-y-3" style={{ touchAction: 'pan-x pan-y', userSelect: 'none' }}>
      {sessions.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              style={{
                fontFamily: 'Barlow Condensed', fontSize: '11px', letterSpacing: '0.08em',
                textTransform: 'uppercase', padding: '3px 9px', borderRadius: 3, border: '1px solid',
                borderColor: s.id === activeSessionId ? s.color : '#1E1E28',
                color: s.id === activeSessionId ? s.color : '#404058',
                background: s.id === activeSessionId ? `${s.color}14` : 'transparent',
              }}
            >
              {sessionLabel(s)}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        {[
          { color: CHANNEL_COLORS.throttle, label: 'Throttle' },
          { color: CHANNEL_COLORS.brake,    label: 'Brake PSI' },
          { color: CHANNEL_COLORS.speed,    label: 'Speed' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="h-0.5 w-5 rounded" style={{ background: item.color }} />
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', letterSpacing: '0.1em', color: '#505060', textTransform: 'uppercase' }}>
              {item.label}
            </span>
          </div>
        ))}
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', letterSpacing: '0.08em', color: '#383848', marginLeft: 'auto' }}>
          Best lap · brake zones marked
        </span>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 10, right: 48, left: 0, bottom: 10 }}>
          <CartesianGrid stroke={GRID_STYLE.stroke} vertical={false} />
          <XAxis
            dataKey="distanceFt"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => `${Math.round(v)}ft`}
            tick={AXIS_STYLE.tick}
            axisLine={AXIS_STYLE.axisLine}
            tickLine={AXIS_STYLE.tickLine}
          />
          <YAxis
            yAxisId="left"
            domain={[0, 150]}
            tick={AXIS_STYLE.tick}
            axisLine={AXIS_STYLE.axisLine}
            tickLine={AXIS_STYLE.tickLine}
            label={{ value: '%  /  PSI', angle: -90, position: 'insideLeft', offset: 12, fill: '#404050', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: '0.06em' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={speedDomain}
            tickFormatter={(v: number) => `${Math.round(v)}`}
            tick={AXIS_STYLE.tick}
            axisLine={AXIS_STYLE.axisLine}
            tickLine={AXIS_STYLE.tickLine}
            label={{ value: 'MPH', angle: 90, position: 'insideRight', offset: -8, fill: '#404050', fontSize: 11, fontFamily: 'Barlow Condensed', letterSpacing: '0.06em' }}
          />
          <Tooltip content={<CustomTooltip />} />

          {brakePoints.map(bp => (
            <ReferenceLine
              key={bp.label}
              yAxisId="left"
              x={bp.distanceFt}
              stroke="#252535"
              strokeDasharray="3 3"
              label={{ value: bp.label, position: 'top', fill: '#505060', fontSize: 9, fontFamily: 'Barlow Condensed' }}
            />
          ))}

          <Area
            yAxisId="left"
            type="monotone"
            dataKey="throttlePct"
            stroke={CHANNEL_COLORS.throttle}
            fill={CHANNEL_COLORS.throttle}
            fillOpacity={0.12}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="brakePsi"
            stroke={CHANNEL_COLORS.brake}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="speedMph"
            stroke={CHANNEL_COLORS.speed}
            strokeWidth={2.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
