import { useMemo } from 'react';
import * as d3 from 'd3';
import type { LoadedSession, BestLapCorner } from '@/types/session';
import { KPH_TO_MPH, M_TO_FEET, sessionLabel } from '@/lib/utils';
import { findTrackLayout } from '@/assets/trackLayouts';

const SVG_W = 560;
const SVG_H = 500;
const PAD  = 44;

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

function buildRefPath(waypoints: [number, number][], proj: d3.GeoProjection): string {
  const pts = waypoints.map(([lat, lon]) => proj([lon, lat])).filter(Boolean) as [number, number][];
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z';
}

// ── Corner apex positions from GPS trace ──────────────────────────────────────
interface Apex { id: string; name: string; x: number; y: number; corner: BestLapCorner }

function computeApexes(
  trace: { lat: number; lon: number; speed_kph: number }[],
  corners: BestLapCorner[],
  proj: d3.GeoProjection
): Apex[] {
  if (!trace.length || !corners.length) return [];
  const chunk = Math.ceil(trace.length / corners.length);
  return corners.flatMap((c, i) => {
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
    <div className="shrink-0 border-t border-border p-4 bg-card/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold tracking-widest text-foreground uppercase">{corner.corner_name}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-destructive transition-colors text-xs tracking-widest uppercase">
          ✕ close
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        {[
          { label: 'Entry', val: mph(corner.entry_speed_kph), color: '#3B82F6' },
          { label: 'Apex',  val: mph(corner.min_speed_kph),   color: '#A855F7' },
          { label: 'Exit',  val: mph(corner.exit_speed_kph),  color: '#22C55E' },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-2.5 text-center bg-background border border-border">
            <div className="text-[9px] tracking-widest text-muted-foreground uppercase mb-1">{s.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '18px', fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.val}</div>
            <div className="text-[9px] text-muted-foreground mt-1">mph</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Brake',  val: corner.brake_point_m > 0 ? `${ft(corner.brake_point_m)}ft` : '—', warn: false },
          { label: 'Coast',  val: corner.coast_time_s > 0.05 ? `${corner.coast_time_s.toFixed(2)}s` : 'none', warn: corner.coast_time_s > 0.2 },
          { label: 'Peak G', val: `${corner.peak_lat_g.toFixed(2)}G`, warn: false },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-2 text-center bg-background border border-border">
            <div className="text-[9px] tracking-widest text-muted-foreground uppercase mb-1">{s.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', fontWeight: 600, color: s.warn ? '#F59E0B' : undefined }}
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
  const session = sessions[0];
  const trace   = session?.data.gps_trace ?? [];

  const refLayout = useMemo(() => findTrackLayout(session?.data.header.track), [session]);

  const proj = useMemo(() => {
    if (refLayout) return buildProjection(refLayout.waypoints.map(([lat, lon]) => ({ lat, lon })));
    if (trace.length > 1) return buildProjection(trace);
    return null;
  }, [refLayout, trace]);

  const refPath = useMemo(() => proj && refLayout ? buildRefPath(refLayout.waypoints, proj) : '', [proj, refLayout]);

  const apexes = useMemo(
    () => (proj && session ? computeApexes(trace, session.data.best_lap_corners, proj) : []),
    [trace, session, proj]
  );

  const selApex = apexes.find(a => a.id === selectedCornerId);

  const trackName = session?.data.header.track || 'Track Map';

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
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs tracking-widest text-muted-foreground uppercase">{trackName}</span>
        {sessions.length > 1 && (
          <div className="flex gap-1">
            {sessions.map(s => (
              <span key={s.id} className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground" style={{ borderColor: s.color, color: s.color }}>
                {sessionLabel(s)}
              </span>
            ))}
          </div>
        )}
        <span className="text-[10px] tracking-widest text-muted-foreground/40 uppercase">tap corner for data</span>
      </div>

      {/* SVG */}
      <div className="w-full min-h-0"
        style={{ flex: variant === 'panel' ? '1 1 0' : undefined, aspectRatio: variant === 'chart' ? `${SVG_W}/${SVG_H}` : undefined, padding: '0 8px' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <filter id="cGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width={SVG_W} height={SVG_H} fill="#08080E" />

          {/* Reference track */}
          {refPath && (
            <>
              <path d={refPath} fill="none" stroke="#1A1A26" strokeWidth={16} strokeLinejoin="round" />
              <path d={refPath} fill="none" stroke="#101018" strokeWidth={12} strokeLinejoin="round" />
              <path d={refPath} fill="none" stroke="#252538" strokeWidth={1.5} strokeLinejoin="round" opacity={0.6} />
            </>
          )}

          {/* No-track fallback */}
          {!refPath && !proj && (
            <text x={SVG_W / 2} y={SVG_H / 2} textAnchor="middle" dominantBaseline="middle"
              style={{ fontFamily: 'BMWTypeNext', fontSize: '11px', letterSpacing: '0.2em', fill: '#252535', textTransform: 'uppercase' }}>
              No track reference — load Road Atlanta session
            </text>
          )}

          {/* S/F marker */}
          {proj && refLayout && (() => {
            const pt = proj([refLayout.waypoints[0][1], refLayout.waypoints[0][0]]);
            if (!pt) return null;
            return (
              <g>
                <line x1={pt[0] - 7} y1={pt[1]} x2={pt[0] + 7} y2={pt[1]} stroke="#4A4A60" strokeWidth={2} />
                <text x={pt[0]} y={pt[1] - 9} textAnchor="middle"
                  style={{ fontFamily: 'BMWTypeNext', fontSize: '8px', letterSpacing: '0.15em', fill: '#383848', textTransform: 'uppercase' }}>
                  S/F
                </text>
              </g>
            );
          })()}

          {/* Corner markers */}
          {apexes.map(a => {
            const sel = selectedCornerId === a.id;
            return (
              <g key={a.id} style={{ cursor: 'pointer' }}
                filter={sel ? 'url(#cGlow)' : undefined}
                onClick={() => onCornerSelect?.(sel ? null : a.id)}>
                {sel && <circle cx={a.x} cy={a.y} r={18} fill="none" stroke="#A855F7" strokeWidth={1} opacity={0.35} />}
                <circle cx={a.x} cy={a.y} r={sel ? 12 : 9}
                  fill={sel ? '#A855F7' : '#0D0D18'}
                  stroke={sel ? '#A855F7' : '#2E2E48'} strokeWidth={1.5} />
                <text x={a.x} y={a.y + 0.5} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontFamily: 'BMWTypeNext', fontSize: sel ? '9px' : '8px', fontWeight: 700,
                    fill: sel ? '#FFF' : '#7070A0', userSelect: 'none', pointerEvents: 'none' }}>
                  {a.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Corner card */}
      {selApex && <CornerCard corner={selApex.corner} onClose={() => onCornerSelect?.(null)} />}
    </div>
  );
}
