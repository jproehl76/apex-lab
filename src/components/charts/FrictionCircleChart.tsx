/**
 * G-Force Envelope — custom D3 SVG radar
 *
 * Why custom D3 instead of Recharts RadarChart:
 *   Recharts radar has limited label control (overlap at tight angles),
 *   opaque fill rendering, and no axis-level formatting.
 *   Custom D3 lets us: position labels cleanly, use gradient fills,
 *   add numeric value callouts, and match the dark theme exactly.
 *
 * Axes (all pure G-force metrics — consistent unit, comparable scale):
 *   Total G P95 · >0.8G Time % · Peak Lateral · Brake G · Accel G
 */


import type { LoadedSession } from '@/types/session';
import { sessionLabel } from '@/lib/utils';
import { T, FF, FS, SESSION_COLORS } from '@/lib/chartTheme';

interface Props { sessions: LoadedSession[] }

// ── Metric definitions ─────────────────────────────────────────────────────────
// scale = value that maps to 100% of the radar radius.
// Chosen so a strong lap day falls in the 70–90% range.
const METRICS = [
  { key: 'total_g_p95',        label: 'Total G\nP95',   scale: 1.8 },
  { key: 'time_above_08g_pct', label: '>0.8G\nTime %',  scale: 18  },
  { key: 'peak_lat_g',         label: 'Peak\nLateral',  scale: 1.6 },
  { key: 'peak_long_g_brake',  label: 'Brake\nG',       scale: 1.4 },
  { key: 'peak_long_g_accel',  label: 'Accel\nG',       scale: 0.7 },
] as const;

const N     = METRICS.length;
const W     = 360;
const H     = 340;
const CX    = W / 2;
const CY    = H / 2 - 8;
const MAXR  = 118;
const LEVELS = 5;

function toXY(angle: number, r: number): [number, number] {
  // 0° = top (−π/2 offset)
  return [
    CX + r * Math.cos(angle - Math.PI / 2),
    CY + r * Math.sin(angle - Math.PI / 2),
  ];
}

function polygonPath(values: number[]): string {
  return values
    .map((v, i) => {
      const angle = (i / N) * 2 * Math.PI;
      const [x, y] = toXY(angle, v);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ') + 'Z';
}

export function FrictionCircleChart({ sessions }: Props) {
  const data = METRICS.map(({ key, scale }) =>
    sessions.map(s => {
      const raw = s.data.friction_circle[key as keyof typeof s.data.friction_circle] as number;
      return Math.min(100, (raw / scale) * 100);
    })
  );

  if (sessions.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.small}px`, color: T.muted }}>
          Load sessions to see the G-force envelope
        </span>
      </div>
    );
  }

  const gridLevels = Array.from({ length: LEVELS }, (_, i) => (i + 1) / LEVELS);

  return (
    <div className="space-y-2" style={{ touchAction: 'pan-x pan-y', userSelect: 'none' }}>
      {/* Description */}
      <p style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, letterSpacing: '0.04em' }}>
        Grip utilization profile — normalized 0–100. Higher = using more of the car&apos;s performance envelope.
      </p>

      {/* Session legend */}
      {sessions.length > 1 && (
        <div className="flex gap-4 flex-wrap">
          {sessions.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span style={{ display: 'inline-block', width: 24, height: 2, background: SESSION_COLORS[i % SESSION_COLORS.length], borderRadius: 1 }} />
              <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.08em', color: T.label, textTransform: 'uppercase' }}>
                {sessionLabel(s)}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* SVG radar */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          {sessions.map((s, i) => (
            <radialGradient key={s.id} id={`rg-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={SESSION_COLORS[i % SESSION_COLORS.length]} stopOpacity={0.3} />
              <stop offset="100%" stopColor={SESSION_COLORS[i % SESSION_COLORS.length]} stopOpacity={0.06} />
            </radialGradient>
          ))}
        </defs>

        {/* ── Grid rings ── */}
        {gridLevels.map((t, li) => {
          const r = MAXR * t;
          const pts = Array.from({ length: N }, (_, i) => toXY((i / N) * 2 * Math.PI, r));
          const d   = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + 'Z';
          return (
            <g key={li}>
              <path d={d} fill="none" stroke="#1C1C2C" strokeWidth={li === LEVELS - 1 ? 1.5 : 0.75} />
              {li === LEVELS - 1 && (
                <text
                  x={CX + 4} y={CY - MAXR - 4}
                  style={{ fontFamily: FF.sans, fontSize: 8 }}
                  fill={T.muted} textAnchor="start">100</text>
              )}
            </g>
          );
        })}

        {/* ── Axis lines ── */}
        {METRICS.map((m, i) => {
          const angle = (i / N) * 2 * Math.PI;
          const [x, y] = toXY(angle, MAXR);
          return (
            <line
              key={m.key}
              x1={CX} y1={CY}
              x2={x.toFixed(1)} y2={y.toFixed(1)}
              stroke="#1E1E30" strokeWidth={1}
            />
          );
        })}

        {/* ── Session data polygons ── */}
        {sessions.map((s, si) => {
          const radii = METRICS.map((_, mi) => (data[mi][si] / 100) * MAXR);
          const d = polygonPath(radii);
          const color = SESSION_COLORS[si % SESSION_COLORS.length];
          return (
            <g key={s.id}>
              <path d={d} fill={`url(#rg-${si})`} stroke="none" />
              <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" opacity={0.9} />
              {/* Value dots */}
              {METRICS.map((_, mi) => {
                const angle  = (mi / N) * 2 * Math.PI;
                const radius = (data[mi][si] / 100) * MAXR;
                const [x, y] = toXY(angle, radius);
                return (
                  <circle key={mi} cx={x} cy={y} r={3} fill={color} stroke="#08080E" strokeWidth={1} />
                );
              })}
            </g>
          );
        })}

        {/* ── Axis labels and value callouts ── */}
        {METRICS.map((m, i) => {
          const angle   = (i / N) * 2 * Math.PI;
          const [lx, ly] = toXY(angle, MAXR + 22);

          // Anchor based on position
          const deg = ((angle * 180) / Math.PI) % 360;
          const anchor = deg < 10 || deg > 350 ? 'middle'
            : deg < 180 ? 'start' : 'end';

          const lines = m.label.split('\n');

          return (
            <g key={m.key}>
              {lines.map((line, li) => (
                <text
                  key={li}
                  x={lx.toFixed(1)}
                  y={(ly + li * 11 - (lines.length - 1) * 5).toFixed(1)}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  style={{ fontFamily: FF.sans, fontSize: 9 }}
                  fill={T.label}
                  letterSpacing="0.06em"
                >
                  {line.toUpperCase()}
                </text>
              ))}
              {/* Numeric value callout per session (single session) */}
              {sessions.length === 1 && (() => {
                const pct = data[i][0].toFixed(0);
                const [vx, vy] = toXY(angle, (data[i][0] / 100) * MAXR - 10);
                return (
                  <text x={vx.toFixed(1)} y={vy.toFixed(1)}
                    textAnchor="middle" dominantBaseline="middle"
                    style={{ fontFamily: FF.mono, fontSize: 9, fontWeight: 700 }}
                    fill={SESSION_COLORS[0]}>
                    {pct}
                  </text>
                );
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
