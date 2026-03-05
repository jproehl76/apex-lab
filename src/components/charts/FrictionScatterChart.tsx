/**
 * FrictionScatterChart — D3 Canvas renderer
 *
 * Why canvas instead of Recharts SVG:
 *   A full-lap sample at 10–20 Hz can produce 5,000–12,000 scatter points.
 *   SVG creates one DOM node per point; at that scale Recharts freezes.
 *   Canvas renders all points in a single drawImage call regardless of count.
 *
 * Visual enhancements over the previous version:
 *   - G-force ring overlays at 0.5, 0.8, 1.0, 1.2 G (1.0G ring emphasized)
 *   - Quadrant labels (Brake / Accel / Left / Right)
 *   - Heat coloring: higher total-G = brighter / greener
 *   - Multi-session: each session tinted to its session color
 */
import { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { LoadedSession, FrictionScatterPoint } from '@/types/session';
import { sessionLabel } from '@/lib/utils';
import { T, FF, FS, S, SESSION_COLORS } from '@/lib/chartTheme';

interface Props { sessions: LoadedSession[] }

const DOMAIN = 1.6; // ±G range shown

// Color by total G when single session
function heatColor(totalG: number): string {
  if (totalG >= 1.2) return S.good + 'EE';
  if (totalG >= 1.0) return '#A3E635CC';
  if (totalG >= 0.8) return S.info  + 'CC';
  if (totalG >= 0.5) return '#6366F1AA';
  return '#3A3A5288';
}

export function FrictionScatterChart({ sessions }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const seriesData = useMemo(
    () => sessions.map((s, i) => ({
      session: s,
      color:   SESSION_COLORS[i % SESSION_COLORS.length],
      points:  (s.data.friction_circle.scatter_points ?? []) as FrictionScatterPoint[],
    })),
    [sessions]
  );

  const hasData = seriesData.some(s => s.points.length > 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !hasData) return;

    const dpr = window.devicePixelRatio ?? 1;
    const W   = container.clientWidth  || 400;
    const H   = container.clientHeight || 400;
    const PAD = 36;

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const xScale = d3.scaleLinear().domain([-DOMAIN, DOMAIN]).range([PAD, W - PAD]);
    const yScale = d3.scaleLinear().domain([-DOMAIN, DOMAIN]).range([H - PAD, PAD]);
    const ox = xScale(0);
    const oy = yScale(0);
    const unitPx = xScale(1) - xScale(0); // pixels per 1G

    // Background
    ctx.fillStyle = '#08080E';
    ctx.fillRect(0, 0, W, H);

    // ── G-force rings ──────────────────────────────────────────────────────────
    const rings = [0.4, 0.8, 1.0, 1.2];
    rings.forEach(g => {
      const r = unitPx * g;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.strokeStyle = g === 1.0 ? '#2E2E48' : '#1C1C2C';
      ctx.lineWidth   = g === 1.0 ? 1.5 : 0.75;
      ctx.setLineDash(g === 0.4 ? [3, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ring label (right side)
      ctx.fillStyle  = g === 1.0 ? T.muted : '#2A2A40';
      ctx.font       = `${FS.nano}px ${FF.sans}`;
      ctx.textAlign  = 'left';
      ctx.fillText(`${g}G`, ox + r + 3, oy - 3);
    });

    // ── Crosshairs ────────────────────────────────────────────────────────────
    ctx.strokeStyle = '#1E1E2E';
    ctx.lineWidth   = 0.75;
    ctx.beginPath();
    ctx.moveTo(PAD, oy); ctx.lineTo(W - PAD, oy);
    ctx.moveTo(ox, PAD); ctx.lineTo(ox, H - PAD);
    ctx.stroke();

    // ── Quadrant labels ───────────────────────────────────────────────────────
    ctx.font      = `${FS.nano}px ${FF.sans}`;
    ctx.fillStyle = '#252538';
    ctx.textAlign = 'center';
    ctx.fillText('BRAKE', ox, PAD + 11);
    ctx.fillText('ACCEL', ox, H - PAD - 5);
    ctx.textAlign = 'right';
    ctx.fillText('LEFT', PAD + 3, oy - 5);
    ctx.textAlign = 'left';
    ctx.fillText('RIGHT', W - PAD - 3, oy - 5);

    // ── Axis tick labels ──────────────────────────────────────────────────────
    ctx.fillStyle = T.muted;
    ctx.font      = `${FS.nano}px ${FF.sans}`;
    [-1, 1].forEach(v => {
      ctx.textAlign  = 'center';
      ctx.fillText(`${v}G`, xScale(v), H - PAD + 12);
      ctx.textAlign  = 'right';
      ctx.fillText(`${v}G`, PAD - 4, yScale(v) + 3);
    });

    // ── Data points ───────────────────────────────────────────────────────────
    const multiSession = sessions.length > 1;

    for (const { points, color } of seriesData) {
      for (const p of points) {
        const x = xScale(p.lat_g);
        const y = yScale(p.long_g);
        if (x < PAD || x > W - PAD || y < PAD || y > H - PAD) continue;

        ctx.fillStyle = multiSession ? color + '90' : heatColor(p.total_g);
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }

    // ── Axis border ───────────────────────────────────────────────────────────
    ctx.strokeStyle = '#1A1A28';
    ctx.lineWidth   = 1;
    ctx.strokeRect(PAD, PAD, W - 2 * PAD, H - 2 * PAD);

  }, [seriesData, hasData]);

  if (!hasData) {
    return (
      <p style={{ fontFamily: FF.sans, fontSize: `${FS.small}px`, color: T.muted }}>
        No scatter data available. Ensure the preprocessor outputs friction_circle.scatter_points.
      </p>
    );
  }

  const multiSession = sessions.length > 1;

  return (
    <div className="space-y-2" style={{ touchAction: 'pan-x pan-y', userSelect: 'none' }}>
      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {multiSession ? (
          sessions.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: SESSION_COLORS[i % SESSION_COLORS.length] }} />
              <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.08em', color: T.label, textTransform: 'uppercase' }}>
                {sessionLabel(s)}
              </span>
            </span>
          ))
        ) : (
          [
            { color: S.good,   label: '≥ 1.2G' },
            { color: '#A3E635', label: '1.0 – 1.2G' },
            { color: S.info,   label: '0.8 – 1.0G' },
            { color: '#6366F1', label: '0.5 – 0.8G' },
            { color: '#3A3A52', label: '< 0.5G' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color }} />
              <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.08em', color: T.label }}>{label}</span>
            </span>
          ))
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
