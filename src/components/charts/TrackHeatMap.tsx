/**
 * TrackHeatMap — dedicated full-tab map with GPS heat overlay
 *
 * Canvas layer  : reference track outline + GPS heat trace (unlimited points, no DOM limit)
 * SVG overlay   : corner markers (interactive), S/F marker
 * HTML controls : channel selector (Speed / Throttle / Brake), legend, corner card
 *
 * The gps_trace carries lat/lon/speed_kph/throttle_pct/brake_bar for every
 * sample of the full session — we project each point through the same D3
 * geoMercator projection and paint line segments coloured by the selected channel.
 */
import { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { LoadedSession, BestLapCorner, GpsPoint } from '@/types/session';
import { KPH_TO_MPH, M_TO_FEET, sessionLabel } from '@/lib/utils';
import { findTrackLayout } from '@/assets/trackLayouts';
import { T, FF, FS, S } from '@/lib/chartTheme';

// ── Constants ─────────────────────────────────────────────────────────────────
const SVG_W = 560;
const SVG_H = 500;
const PAD   = 40;

export type HeatChannel = 'speed' | 'throttle' | 'brake';

// ── Projection helpers (mirrors TrackMapChart logic) ─────────────────────────
function buildProjection(points: { lat: number; lon: number }[]) {
  if (points.length < 2) return null;
  return d3.geoMercator().fitExtent(
    [[PAD, PAD], [SVG_W - PAD, SVG_H - PAD]],
    {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: points.map(p => [p.lon, p.lat]) }, properties: {} }],
    } as GeoJSON.FeatureCollection
  );
}

function buildPolyline(waypoints: [number, number][], proj: d3.GeoProjection): [number, number][] {
  return waypoints.map(([lat, lon]) => proj([lon, lat])).filter(Boolean) as [number, number][];
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function speedHex(kph: number, minKph: number, maxKph: number): string {
  const t = Math.max(0, Math.min(1, (kph - minKph) / Math.max(1, maxKph - minKph)));
  // red → amber → green
  if (t >= 0.67) return `#22C55E`;
  if (t >= 0.33) return `#F59E0B`;
  return `#EF4444`;
}

function throttleRgba(pct: number): string {
  const a = Math.max(0.05, pct / 100);
  return `rgba(34,197,94,${a.toFixed(2)})`;
}

function brakeRgba(bar: number, maxBar: number): string {
  if (maxBar <= 0) return 'rgba(239,68,68,0.05)';
  const a = Math.max(0.05, Math.min(1, bar / maxBar));
  return `rgba(239,68,68,${a.toFixed(2)})`;
}

function pointColor(pt: GpsPoint, ch: HeatChannel, minSpd: number, maxSpd: number, maxBrake: number): string {
  switch (ch) {
    case 'speed':    return speedHex(pt.speed_kph, minSpd, maxSpd);
    case 'throttle': return throttleRgba(pt.throttle_pct);
    case 'brake':    return brakeRgba(pt.brake_bar, maxBrake);
  }
}

// ── Corner card (expanded from TrackMapChart) ─────────────────────────────────
function CornerCard({ corner, sessionColor, onClose }: { corner: BestLapCorner; sessionColor: string; onClose: () => void }) {
  const mph = (k: number) => (k * KPH_TO_MPH).toFixed(0);
  const ft  = (m: number) => (m * M_TO_FEET).toFixed(0);

  return (
    <div className="shrink-0 border-t border-border bg-card/60 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-5 rounded" style={{ background: sessionColor }} />
          <span style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.fg }}>
            {corner.corner_name.toUpperCase()}
          </span>
        </div>
        <button onClick={onClose}
          style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', color: T.muted, textTransform: 'uppercase' }}
          className="hover:text-destructive transition-colors">
          ✕ close
        </button>
      </div>

      {/* Speed trio */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[
          { label: 'Entry', val: mph(corner.entry_speed_kph), color: S.info  },
          { label: 'Apex',  val: mph(corner.min_speed_kph),   color: S.best  },
          { label: 'Exit',  val: mph(corner.exit_speed_kph),  color: S.good  },
        ].map(({ label, val, color }) => (
          <div key={label} className="rounded p-2 text-center bg-background border border-border">
            <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', color: T.muted, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
            <div style={{ fontFamily: FF.mono, fontSize: `${FS.large}px`, fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, marginTop: 2 }}>mph</div>
          </div>
        ))}
      </div>

      {/* Technique metrics */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Brake Pt',  val: corner.brake_point_m > 0 ? `${ft(corner.brake_point_m)}ft` : '—',   warn: false },
          { label: 'Trail',     val: corner.trail_brake_duration_s > 0.05 ? `${corner.trail_brake_duration_s.toFixed(2)}s` : '—', warn: false, good: corner.trail_brake_duration_s > 0.2 },
          { label: 'Throt-On',  val: corner.throttle_on_m > 0 ? `${ft(corner.throttle_on_m)}ft` : '—',  warn: corner.throttle_on_m * M_TO_FEET > 120 },
          { label: 'Peak G',    val: `${corner.peak_lat_g.toFixed(2)}G`, warn: false },
        ].map(({ label, val, warn, good }) => (
          <div key={label} className="rounded p-1.5 text-center bg-background border border-border">
            <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
            <div style={{ fontFamily: FF.mono, fontSize: `${FS.base}px`, fontWeight: 600, color: good ? S.good : warn ? S.warn : T.fg }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Channel toggle button ─────────────────────────────────────────────────────
const CHANNELS: { id: HeatChannel; label: string; color: string }[] = [
  { id: 'speed',    label: 'Speed',    color: S.good },
  { id: 'throttle', label: 'Throttle', color: '#22C55E' },
  { id: 'brake',    label: 'Brake',    color: S.bad  },
];

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  sessions: LoadedSession[];
  selectedCornerId?: string | null;
  onCornerSelect?: (id: string | null) => void;
}

export function TrackHeatMap({ sessions, selectedCornerId, onCornerSelect }: Props) {
  const [channel, setChannel]   = useState<HeatChannel>('speed');
  const [hovered, setHovered]   = useState<string | null>(null);
  const [activeSessionIdx, setActiveSessionIdx] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const session = sessions[activeSessionIdx] ?? sessions[0];
  const trace   = useMemo(() => session?.data.gps_trace ?? [], [session]);

  const refLayout = useMemo(() => findTrackLayout(session?.data.header.track), [session]);

  // Build projection from refLayout or gps_trace
  const proj = useMemo(() => {
    if (refLayout) return buildProjection(refLayout.waypoints.map(([lat, lon]) => ({ lat, lon })));
    if (trace.length > 1) return buildProjection(trace);
    return null;
  }, [refLayout, trace]);

  // Reference track polyline(s)
  const refPts    = useMemo(() => proj && refLayout ? buildPolyline(refLayout.waypoints, proj) : [], [proj, refLayout]);
  const bridgePts = useMemo(() => proj && refLayout?.bridgeWaypoints ? buildPolyline(refLayout.bridgeWaypoints, proj) : [], [proj, refLayout]);
  const tracePts  = useMemo(() => proj && !refLayout && trace.length > 1
    ? trace.map(p => proj([p.lon, p.lat])).filter(Boolean) as [number,number][]
    : [], [proj, refLayout, trace]);

  // Channel stats for scaling
  const stats = useMemo(() => {
    if (!trace.length) return { minSpd: 0, maxSpd: 200, maxBrake: 50 };
    const speeds = trace.map(p => p.speed_kph);
    const brakes = trace.map(p => p.brake_bar);
    return {
      minSpd:  Math.min(...speeds),
      maxSpd:  Math.max(...speeds),
      maxBrake: Math.max(...brakes),
    };
  }, [trace]);

  // Projected GPS points (cached)
  const projGps = useMemo(() => {
    if (!proj || !trace.length) return [];
    return trace.map(p => {
      const xy = proj([p.lon, p.lat]);
      return xy ? { x: xy[0], y: xy[1], pt: p } : null;
    }).filter(Boolean) as { x: number; y: number; pt: GpsPoint }[];
  }, [proj, trace]);

  // Corner apexes
  const apexes = useMemo(() => {
    if (!proj || !refLayout) return [];
    return refLayout.corners.flatMap(rc => {
      const xy = proj([rc.lon, rc.lat]);
      if (!xy) return [];
      const sc = session?.data.best_lap_corners.find(c =>
        c.corner_id.toUpperCase() === rc.id.toUpperCase() ||
        c.corner_name.toUpperCase() === rc.name.toUpperCase()
      ) ?? null;
      return [{ id: rc.id, name: rc.name, x: xy[0], y: xy[1], corner: sc }];
    });
  }, [proj, refLayout, session]);

  const selApex   = apexes.find(a => a.id === selectedCornerId);
  const trackName = session?.data.header.track ?? 'Track Map';
  const accentColor = refLayout?.colors.primary ?? S.info;

  // ── Canvas drawing ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !proj) return;

    const dpr = window.devicePixelRatio ?? 1;
    canvas.width  = SVG_W * dpr;
    canvas.height = SVG_H * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#08080E';
    ctx.fillRect(0, 0, SVG_W, SVG_H);

    // Draw a polyline as thick dark track casing
    function drawCasing(pts: [number,number][], base: string, w1: number, w2: number) {
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.strokeStyle = base; ctx.lineWidth = w1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath();
      pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.strokeStyle = '#0E0E1A'; ctx.lineWidth = w2; ctx.stroke();
    }

    const bgPts = refPts.length ? refPts : tracePts;
    if (bgPts.length) {
      drawCasing(bgPts, '#1C1C28', 18, 13);
      // Edge highlight
      ctx.beginPath();
      bgPts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.strokeStyle = '#2A2A3C'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7; ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── GPS heat trace ────────────────────────────────────────────────────────
    if (projGps.length > 1) {
      const { minSpd, maxSpd, maxBrake } = stats;
      ctx.lineWidth   = 4;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';

      for (let i = 0; i < projGps.length - 1; i++) {
        const a = projGps[i];
        const b = projGps[i + 1];
        // Skip segments that jump too far (lap boundaries)
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > 60) continue;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = pointColor(a.pt, channel, minSpd, maxSpd, maxBrake);
        ctx.stroke();
      }
    }

    // Bridge overpass on top
    if (bridgePts.length) {
      drawCasing(bridgePts, '#1C1C28', 18, 13);
      ctx.beginPath();
      bridgePts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.strokeStyle = '#303048'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8; ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // S/F marker
    if (refLayout && refPts.length) {
      const [sfx, sfy] = refPts[0];
      ctx.beginPath();
      ctx.moveTo(sfx - 8, sfy); ctx.lineTo(sfx + 8, sfy);
      ctx.strokeStyle = accentColor; ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.5;
      ctx.font = `${FS.nano}px ${FF.sans}`;
      ctx.textAlign = 'center';
      ctx.fillText('S/F', sfx, sfy - 10);
      ctx.globalAlpha = 1;
    }

  }, [proj, projGps, channel, stats, refPts, bridgePts, tracePts, refLayout, accentColor]);

  // ── Legend data ───────────────────────────────────────────────────────────
  const legendItems = useMemo(() => {
    if (channel === 'speed') {
      const hi = (stats.maxSpd * KPH_TO_MPH).toFixed(0);
      const lo = (stats.minSpd * KPH_TO_MPH).toFixed(0);
      return [
        { color: S.bad,  label: `${lo} mph` },
        { color: S.warn, label: '' },
        { color: S.good, label: `${hi} mph` },
      ];
    }
    if (channel === 'throttle') return [
      { color: 'rgba(34,197,94,0.08)', label: '0%' },
      { color: S.good, label: '100%' },
    ];
    return [
      { color: 'rgba(239,68,68,0.08)', label: '0 bar' },
      { color: S.bad, label: `${stats.maxBrake.toFixed(0)} bar` },
    ];
  }, [channel, stats]);

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, letterSpacing: '0.1em', color: T.muted, textTransform: 'uppercase' }}>
          Load a session to see the heat map
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden rounded-lg bg-card">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>
            {trackName}
          </span>
          {sessions.length > 1 && (
            <div className="flex gap-1">
              {sessions.map((s, i) => (
                <button key={s.id} onClick={() => setActiveSessionIdx(i)}
                  style={{
                    fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.06em',
                    padding: '2px 8px', borderRadius: 4,
                    border: `1px solid ${i === activeSessionIdx ? s.color : 'transparent'}`,
                    background: i === activeSessionIdx ? `${s.color}18` : 'transparent',
                    color: i === activeSessionIdx ? s.color : T.muted,
                  }}>
                  {sessionLabel(s)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Channel selector */}
        <div className="flex items-center rounded overflow-hidden" style={{ border: '1px solid #1E1E2E' }}>
          {CHANNELS.map(ch => (
            <button key={ch.id} onClick={() => setChannel(ch.id)}
              style={{
                fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.08em',
                padding: '4px 12px', textTransform: 'uppercase',
                background: channel === ch.id ? `${ch.color}20` : 'transparent',
                color: channel === ch.id ? ch.color : T.muted,
                borderRight: ch.id !== 'brake' ? '1px solid #1E1E2E' : undefined,
                transition: 'all 0.15s',
              }}>
              {ch.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-1.5">
          {legendItems.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: item.color, border: '1px solid #2A2A3A' }} />
              {item.label && <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted }}>{item.label}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ── Map area (canvas + SVG) ── */}
      <div className="relative w-full min-h-0" style={{ flex: '1 1 0' }}>
        <canvas ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', position: 'absolute', inset: 0 }} />

        {/* SVG corner marker overlay */}
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" height="100%"
          style={{ display: 'block', position: 'absolute', inset: 0 }}>
          <defs>
            <filter id="hmGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {apexes.map(a => {
            const sel     = selectedCornerId === a.id;
            const hov     = hovered === a.id;
            const hasData = a.corner !== null;
            const active  = sel || hov;

            return (
              <g key={a.id}
                style={{ cursor: hasData ? 'pointer' : 'default' }}
                filter={sel ? 'url(#hmGlow)' : undefined}
                onClick={() => hasData && onCornerSelect?.(sel ? null : a.id)}
                onMouseEnter={() => setHovered(a.id)}
                onMouseLeave={() => setHovered(null)}>

                {sel && <circle cx={a.x} cy={a.y} r={20} fill="none" stroke={accentColor} strokeWidth={1} opacity={0.3} />}

                <circle cx={a.x} cy={a.y}
                  r={sel ? 13 : active ? 11 : 9}
                  fill={sel ? accentColor : active ? `${accentColor}30` : '#0D0D1A'}
                  stroke={sel ? accentColor : active ? accentColor : hasData ? '#303048' : '#202030'}
                  strokeWidth={sel ? 2 : 1.5}
                />
                <text x={a.x} y={a.y + 0.5} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontFamily: FF.sans, fontSize: sel ? '9px' : '8px', fontWeight: 700,
                    fill: sel ? '#FFF' : hasData ? T.label : '#404050',
                    userSelect: 'none', pointerEvents: 'none' }}>
                  {a.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Corner detail card ── */}
      {selApex?.corner && (
        <CornerCard
          corner={selApex.corner}
          sessionColor={session.color}
          onClose={() => onCornerSelect?.(null)}
        />
      )}
    </div>
  );
}
