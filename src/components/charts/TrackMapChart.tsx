import { useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { LoadedSession, BestLapCorner } from '@/types/session';
import { KPH_TO_MPH, M_TO_FEET, sessionLabel } from '@/lib/utils';
import { findTrackLayout, type TrackLayout } from '@/assets/trackLayouts';

const SVG_W = 560;
const SVG_H = 500;
const PAD  = 40;

// ── Projection ────────────────────────────────────────────────────────────────
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

function buildPath(waypoints: [number, number][], proj: d3.GeoProjection, close = true): string {
  const pts = waypoints.map(([lat, lon]) => proj([lon, lat])).filter(Boolean) as [number, number][];
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + (close ? 'Z' : '');
}

// ── Corner apex positions ─────────────────────────────────────────────────────
interface Apex {
  id: string;
  name: string;
  x: number;
  y: number;
  corner: BestLapCorner | null; // null = reference position only, no session data matched
}

/** Match a reference corner ID/name to a session corner (case-insensitive, strips non-alphanum) */
function matchCorner(rcId: string, rcName: string, sessionCorners: BestLapCorner[]): BestLapCorner | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sessionCorners.find(c =>
    norm(c.corner_id) === norm(rcId) ||
    norm(c.corner_name) === norm(rcName) ||
    norm(c.corner_name) === norm(rcId)
  ) ?? null;
}

/**
 * Build apex list.
 * - When refLayout is present: project its corner GPS positions (accurate, ON the track).
 * - When no refLayout: divide GPS trace into equal chunks and find min-speed point in each
 *   (approximate, but correct relative to the GPS-drawn outline).
 */
function buildApexes(
  refLayout: TrackLayout | null,
  trace: { lat: number; lon: number; speed_kph: number }[],
  sessionCorners: BestLapCorner[],
  proj: d3.GeoProjection
): Apex[] {
  if (refLayout && (refLayout.corners?.length ?? 0) > 0) {
    return refLayout.corners!.flatMap(rc => {
      const xy = proj([rc.lon, rc.lat]);
      if (!xy) return [];
      const sc = matchCorner(rc.id, rc.name, sessionCorners);
      return [{ id: rc.id, name: rc.name, x: xy[0], y: xy[1], corner: sc }];
    });
  }

  // Fallback: GPS trace chunks
  if (!trace.length || !sessionCorners.length) return [];
  const chunk = Math.ceil(trace.length / sessionCorners.length);
  return sessionCorners.flatMap((c, i) => {
    const slice = trace.slice(i * chunk, Math.min((i + 1) * chunk, trace.length));
    if (!slice.length) return [];
    const apex = slice.reduce((m, p) => p.speed_kph < m.speed_kph ? p : m, slice[0]);
    const xy = proj([apex.lon, apex.lat]);
    if (!xy) return [];
    return [{ id: c.corner_id, name: c.corner_name, x: xy[0], y: xy[1], corner: c }];
  });
}

// ── Corner detail card ────────────────────────────────────────────────────────
function CornerCard({ corner, onClose }: { corner: BestLapCorner; onClose: () => void }) {
  const mph = (k: number) => (k * KPH_TO_MPH).toFixed(0);
  const ft  = (m: number) => (m * M_TO_FEET).toFixed(0);

  return (
    <div className="shrink-0 border-t border-border p-3 bg-card/50">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-sm font-bold tracking-widest text-foreground uppercase">{corner.corner_name}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-destructive transition-colors text-[10px] tracking-widest uppercase">
          ✕ close
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-1.5">
        {[
          { label: 'Entry', val: mph(corner.entry_speed_kph), color: '#3B82F6' },
          { label: 'Apex',  val: mph(corner.min_speed_kph),   color: '#A855F7' },
          { label: 'Exit',  val: mph(corner.exit_speed_kph),  color: '#22C55E' },
        ].map(s => (
          <div key={s.label} className="rounded p-2 text-center bg-background border border-border">
            <div className="text-[8px] tracking-widest text-muted-foreground uppercase mb-0.5">{s.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '17px', fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.val}</div>
            <div className="text-[8px] text-muted-foreground mt-0.5">mph</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Brake',  val: corner.brake_point_m > 0 ? `${ft(corner.brake_point_m)}ft` : '—', warn: false },
          { label: 'Coast',  val: corner.coast_time_s > 0.05 ? `${corner.coast_time_s.toFixed(2)}s` : 'none', warn: corner.coast_time_s > 0.2 },
          { label: 'Peak G', val: `${corner.peak_lat_g.toFixed(2)}G`, warn: false },
        ].map(s => (
          <div key={s.label} className="rounded p-1.5 text-center bg-background border border-border">
            <div className="text-[8px] tracking-widest text-muted-foreground uppercase mb-0.5">{s.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: 600, color: s.warn ? '#F59E0B' : undefined }}
              className={s.warn ? '' : 'text-muted-foreground'}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export interface TrackMapProps {
  sessions: LoadedSession[];
  variant?: 'panel' | 'chart';
  selectedCornerId?: string | null;
  onCornerSelect?: (id: string | null) => void;
}

export function TrackMapChart({ sessions, variant = 'chart', selectedCornerId, onCornerSelect }: TrackMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const session = sessions[0];
  const trace   = session?.data.gps_trace ?? [];

  const refLayout = useMemo(() => findTrackLayout(session?.data.header.track), [session]);

  const proj = useMemo(() => {
    if (refLayout) return buildProjection(refLayout.waypoints.map(([lat, lon]) => ({ lat, lon })));
    if (trace.length > 1) return buildProjection(trace);
    return null;
  }, [refLayout, trace]);

  const refPath = useMemo(() => proj && refLayout ? buildPath(refLayout.waypoints, proj) : '', [proj, refLayout]);

  const bridgePath = useMemo(() => {
    if (!proj || !refLayout?.bridgeWaypoints) return '';
    return buildPath(refLayout.bridgeWaypoints, proj, false);
  }, [proj, refLayout]);

  // GPS trace fallback path (when no reference layout)
  const tracePath = useMemo(() => {
    if (refLayout || !proj || trace.length < 2) return '';
    return buildPath(trace.map(p => [p.lat, p.lon]), proj);
  }, [refLayout, trace, proj]);

  const apexes = useMemo(
    () => proj ? buildApexes(refLayout, trace, session?.data.best_lap_corners ?? [], proj) : [],
    [refLayout, trace, session, proj]
  );

  const selApex = apexes.find(a => a.id === selectedCornerId);
  const trackName = session?.data.header.track || 'Track Map';
  const accentColor = refLayout?.colors.primary ?? '#1C69D4';

  if (!session) {
    return (
      <div className="flex items-center justify-center w-full rounded-lg bg-card"
        style={{ height: variant === 'panel' ? '100%' : undefined, aspectRatio: variant === 'chart' ? `${SVG_W}/${SVG_H}` : undefined }}>
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Load a session</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full overflow-hidden rounded-lg bg-card"
      style={{ height: variant === 'panel' ? '100%' : undefined }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">{trackName}</span>
        {sessions.length > 1 && (
          <div className="flex gap-1">
            {sessions.map(s => (
              <span key={s.id} className="text-[9px] px-1.5 py-0.5 rounded border text-muted-foreground"
                style={{ borderColor: s.color, color: s.color }}>
                {sessionLabel(s)}
              </span>
            ))}
          </div>
        )}
        <span className="text-[9px] tracking-widest text-muted-foreground/40 uppercase">tap corner</span>
      </div>

      {/* SVG map */}
      <div className="w-full min-h-0"
        style={{ flex: variant === 'panel' ? '1 1 0' : undefined, aspectRatio: variant === 'chart' ? `${SVG_W}/${SVG_H}` : undefined }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <filter id="cGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="hGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width={SVG_W} height={SVG_H} fill="#08080E" />

          {/* Reference track outline */}
          {(refPath || tracePath) && (() => {
            const d = refPath || tracePath;
            return (
              <>
                <path d={d} fill="none" stroke="#1C1C28" strokeWidth={18} strokeLinejoin="round" strokeLinecap="round" />
                <path d={d} fill="none" stroke="#0E0E1A" strokeWidth={13} strokeLinejoin="round" strokeLinecap="round" />
                <path d={d} fill="none" stroke="#2A2A3C" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
              </>
            );
          })()}

          {/* Bridge overpass — drawn on top */}
          {bridgePath && (
            <>
              <path d={bridgePath} fill="none" stroke="#1C1C28" strokeWidth={18} strokeLinecap="round" />
              <path d={bridgePath} fill="none" stroke="#141420" strokeWidth={13} strokeLinecap="round" />
              <path d={bridgePath} fill="none" stroke="#303048" strokeWidth={1.5} strokeLinecap="round" opacity={0.8} />
            </>
          )}

          {/* No-track fallback */}
          {!refPath && !tracePath && (
            <text x={SVG_W / 2} y={SVG_H / 2} textAnchor="middle" dominantBaseline="middle"
              style={{ fontFamily: 'BMWTypeNext', fontSize: '10px', letterSpacing: '0.2em', fill: '#252535', textTransform: 'uppercase' }}>
              No GPS data — load a session
            </text>
          )}

          {/* S/F marker */}
          {proj && refLayout && (() => {
            const pt = proj([refLayout.waypoints[0][1], refLayout.waypoints[0][0]]);
            if (!pt) return null;
            return (
              <g>
                <line x1={pt[0] - 8} y1={pt[1]} x2={pt[0] + 8} y2={pt[1]} stroke={accentColor} strokeWidth={2} opacity={0.6} />
                <text x={pt[0]} y={pt[1] - 10} textAnchor="middle"
                  style={{ fontFamily: 'BMWTypeNext', fontSize: '7px', letterSpacing: '0.18em', fill: accentColor, opacity: 0.5, textTransform: 'uppercase' }}>
                  S/F
                </text>
              </g>
            );
          })()}

          {/* Corner markers */}
          {apexes.map(a => {
            const sel = selectedCornerId === a.id;
            const hov = hovered === a.id;
            const hasData = a.corner !== null;
            const active = sel || hov;

            return (
              <g key={a.id}
                style={{ cursor: hasData ? 'pointer' : 'default' }}
                filter={sel ? 'url(#cGlow)' : hov ? 'url(#hGlow)' : undefined}
                onClick={() => hasData && onCornerSelect?.(sel ? null : a.id)}
                onMouseEnter={() => setHovered(a.id)}
                onMouseLeave={() => setHovered(null)}>

                {/* Selection ring */}
                {sel && <circle cx={a.x} cy={a.y} r={20} fill="none" stroke={accentColor} strokeWidth={1} opacity={0.3} />}

                {/* Dot */}
                <circle cx={a.x} cy={a.y}
                  r={sel ? 13 : active ? 11 : 9}
                  fill={sel ? accentColor : active ? `${accentColor}30` : '#0D0D1A'}
                  stroke={sel ? accentColor : active ? accentColor : hasData ? '#303048' : '#202030'}
                  strokeWidth={sel ? 2 : 1.5}
                />

                {/* Label */}
                <text x={a.x} y={a.y + 0.5} textAnchor="middle" dominantBaseline="middle"
                  style={{
                    fontFamily: 'BMWTypeNext',
                    fontSize: sel ? '10px' : '9px',
                    fontWeight: 700,
                    fill: sel ? '#FFF' : hasData ? '#C0C0D4' : '#5A5A72',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}>
                  {a.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Corner data card */}
      {selApex?.corner && <CornerCard corner={selApex.corner} onClose={() => onCornerSelect?.(null)} />}
    </div>
  );
}
