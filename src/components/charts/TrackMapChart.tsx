import { useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { LoadedSession, GpsPoint, BestLapCorner } from '@/types/session';
import { KPH_TO_MPH, BAR_TO_PSI, M_TO_FEET, sessionLabel } from '@/lib/utils';
import { findTrackLayout } from '@/assets/trackLayouts';

type ColorMode = 'speed' | 'throttle' | 'brake';

const SVG_W = 560;
const SVG_H = 500;
const PAD  = 44;

// ── Color scales ──────────────────────────────────────────────────────────────
function getColor(t: number, mode: ColorMode): string {
  const c = Math.max(0, Math.min(1, t));
  if (mode === 'brake')    return d3.interpolateRgb('#0D0D12', '#EF3340')(c);
  if (mode === 'throttle') return d3.interpolateRgb('#0D0D12', '#00C853')(c);
  if (c < 0.40) return d3.interpolateRgb('#1C2B4A', '#1C69D4')(c / 0.40);
  if (c < 0.75) return d3.interpolateRgb('#1C69D4', '#00D4FF')((c - 0.40) / 0.35);
  return d3.interpolateRgb('#00D4FF', '#CCFFE8')((c - 0.75) / 0.25);
}

// ── Projection builder ────────────────────────────────────────────────────────
function buildProjection(points: { lat: number; lon: number }[]): d3.GeoProjection | null {
  if (points.length < 2) return null;
  return d3.geoMercator().fitExtent(
    [[PAD, PAD], [SVG_W - PAD, SVG_H - PAD]],
    {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: points.map(p => [p.lon, p.lat]) },
        properties: {},
      }],
    } as GeoJSON.FeatureCollection
  );
}

// ── Segment builder ───────────────────────────────────────────────────────────
interface Seg { x1: number; y1: number; x2: number; y2: number; t: number }

function buildSegments(points: GpsPoint[], mode: ColorMode, proj: d3.GeoProjection): Seg[] {
  if (points.length < 2) return [];
  const raw = points.map(p =>
    mode === 'speed'    ? p.speed_kph * KPH_TO_MPH :
    mode === 'throttle' ? p.throttle_pct :
    p.brake_bar * BAR_TO_PSI
  );
  const lo = d3.min(raw) ?? 0;
  const hi = d3.max(raw) ?? 1;
  const range = hi - lo || 1;

  const segs: Seg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = proj([points[i].lon,     points[i].lat]);
    const b = proj([points[i + 1].lon, points[i + 1].lat]);
    if (!a || !b) continue;
    segs.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], t: (raw[i] - lo) / range });
  }
  return segs;
}

// ── Reference track path ──────────────────────────────────────────────────────
function buildRefPath(waypoints: [number, number][], proj: d3.GeoProjection): string {
  const pts = waypoints.map(([lat, lon]) => proj([lon, lat])).filter(Boolean) as [number, number][];
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z';
}

// ── Corner apex detection (from GPS trace) ────────────────────────────────────
interface Apex { id: string; name: string; x: number; y: number; corner: BestLapCorner }

function computeApexes(trace: GpsPoint[], corners: BestLapCorner[], proj: d3.GeoProjection): Apex[] {
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

// ── Corner coaching card ──────────────────────────────────────────────────────
function CornerCard({ corner, onClose }: { corner: BestLapCorner; onClose: () => void }) {
  const mph = (k: number) => (k * KPH_TO_MPH).toFixed(0);
  const ft  = (m: number) => (m * M_TO_FEET).toFixed(0);

  return (
    <div className="shrink-0 border-t border-[#252535] p-4" style={{ background: 'rgba(168,85,247,0.04)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-px h-4 rounded-full" style={{ background: 'linear-gradient(to bottom, #A855F7, #6366F1)' }} />
          <span style={{ fontFamily: 'Barlow Condensed', fontSize: '15px', fontWeight: 700, letterSpacing: '0.15em', color: '#E8E8F0', textTransform: 'uppercase' }}>
            {corner.corner_name}
          </span>
        </div>
        <button onClick={onClose}
          style={{ fontFamily: 'Barlow Condensed', fontSize: '10px', letterSpacing: '0.12em', color: '#404058', textTransform: 'uppercase' }}
          className="hover:text-[#EF3340] transition-colors px-1">✕ close</button>
      </div>

      {/* Speed trio */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {[
          { label: 'Entry', val: mph(corner.entry_speed_kph), color: '#3B82F6' },
          { label: 'Apex',  val: mph(corner.min_speed_kph),   color: '#A855F7' },
          { label: 'Exit',  val: mph(corner.exit_speed_kph),  color: '#22C55E' },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-2.5 text-center" style={{ background: '#08080E', border: `1px solid ${s.color}22` }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: '9px', letterSpacing: '0.18em', color: '#404058', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '18px', fontWeight: 600, color: s.color, lineHeight: 1, textShadow: `0 0 12px ${s.color}55` }}>{s.val}</div>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: '9px', color: '#303040', marginTop: 2 }}>mph</div>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Brake',  val: corner.brake_point_m > 0 ? `${ft(corner.brake_point_m)}ft` : '—', warn: false },
          { label: 'Coast',  val: corner.coast_time_s > 0.05 ? `${corner.coast_time_s.toFixed(2)}s` : 'none', warn: corner.coast_time_s > 0.2 },
          { label: 'Peak G', val: `${corner.peak_lat_g.toFixed(2)}G`, warn: false },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: '#08080E', border: '1px solid #18181E' }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: '9px', letterSpacing: '0.15em', color: '#404058', textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', fontWeight: 600, color: s.warn ? '#F59E0B' : '#9898A8', lineHeight: 1.1 }}>{s.val}</div>
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
  const [mode, setMode]   = useState<ColorMode>('speed');
  const [activeId, setId] = useState(sessions[0]?.id ?? '');

  const session = useMemo(() => sessions.find(s => s.id === activeId) ?? sessions[0], [sessions, activeId]);
  const trace   = session?.data.gps_trace ?? [];

  // Find reference layout for this track
  const refLayout = useMemo(() => findTrackLayout(session?.data.header.track), [session]);

  // Build projection from reference layout (preferred) or GPS trace
  const proj = useMemo(() => {
    if (refLayout && refLayout.waypoints.length > 1) {
      return buildProjection(refLayout.waypoints.map(([lat, lon]) => ({ lat, lon })));
    }
    if (trace.length > 1) {
      return buildProjection(trace);
    }
    return null;
  }, [refLayout, trace]);

  const refPath = useMemo(() => {
    if (!proj || !refLayout) return '';
    return buildRefPath(refLayout.waypoints, proj);
  }, [proj, refLayout]);

  const segs = useMemo(() => {
    if (!proj || !trace.length) return [];
    return buildSegments(trace, mode, proj);
  }, [trace, mode, proj]);

  const apexes = useMemo(
    () => (proj && session ? computeApexes(trace, session.data.best_lap_corners, proj) : []),
    [trace, session, proj]
  );
  const selApex = apexes.find(a => a.id === selectedCornerId);

  const modeAccent: Record<ColorMode, string> = { speed: '#1C69D4', throttle: '#00C853', brake: '#EF3340' };

  if (!session) {
    return (
      <div className="flex items-center justify-center w-full rounded-xl"
        style={{
          background: '#06060C',
          height: variant === 'panel' ? '100%' : undefined,
          aspectRatio: variant === 'chart' ? `${SVG_W}/${SVG_H}` : undefined,
        }}>
        <p style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', letterSpacing: '0.2em', color: '#202028', textTransform: 'uppercase' }}>
          Load a session · GPS trace appears here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full overflow-hidden rounded-xl"
      style={{ background: '#06060C', height: variant === 'panel' ? '100%' : undefined }}>

      {/* ── Controls ── */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5 shrink-0">
        {sessions.length > 1 ? (
          <div className="flex gap-1 flex-wrap min-w-0">
            {sessions.map(s => (
              <button key={s.id} onClick={() => setId(s.id)} style={{
                fontFamily: 'Barlow Condensed', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '2px 8px', borderRadius: 3, border: '1px solid',
                borderColor: s.id === activeId ? s.color : '#1C1C28',
                color: s.id === activeId ? s.color : '#404058',
                background: s.id === activeId ? `${s.color}14` : 'transparent',
              }}>{sessionLabel(s)}</button>
            ))}
          </div>
        ) : (
          <span style={{ fontFamily: 'Barlow Condensed', fontSize: '10px', letterSpacing: '0.15em', color: '#383848', textTransform: 'uppercase' }}>
            {session.data.header.track || 'GPS Trace'}
            {refLayout && <span style={{ color: '#252535', marginLeft: 6 }}>· ref</span>}
          </span>
        )}
        <div className="flex gap-0.5 shrink-0">
          {(['speed', 'throttle', 'brake'] as ColorMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              fontFamily: 'Barlow Condensed', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 3, border: '1px solid',
              borderColor: mode === m ? modeAccent[m] : '#1C1C28',
              color: mode === m ? modeAccent[m] : '#404058',
              background: mode === m ? `${modeAccent[m]}14` : 'transparent',
            }}>{m}</button>
          ))}
        </div>
      </div>

      {/* ── SVG map ── */}
      <div className="w-full min-h-0" style={{
        flex: variant === 'panel' ? '1 1 0' : undefined,
        aspectRatio: variant === 'chart' ? `${SVG_W}/${SVG_H}` : undefined,
        padding: '0 8px',
      }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <filter id="tGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="cGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="refGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width={SVG_W} height={SVG_H} fill="#06060C" />

          {/* Reference track outline — always visible if available */}
          {refPath && (
            <>
              {/* Outer glow (wide stroke) */}
              <path d={refPath} fill="none" stroke="#1C1C28" strokeWidth={14} strokeLinejoin="round" />
              {/* Track surface */}
              <path d={refPath} fill="none" stroke="#141420" strokeWidth={10} strokeLinejoin="round" />
              {/* Center line */}
              <path d={refPath} fill="none" stroke="#1E1E2E" strokeWidth={1} strokeLinejoin="round" filter="url(#refGlow)" />
            </>
          )}

          {/* Telemetry overlay — glowing speed/throttle/brake line */}
          {segs.length > 0 && (
            <g filter="url(#tGlow)">
              {segs.map((s, i) => (
                <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                  stroke={getColor(s.t, mode)} strokeWidth={4} strokeLinecap="round" />
              ))}
            </g>
          )}

          {/* No GPS trace fallback text */}
          {segs.length === 0 && refPath && (
            <text x={SVG_W / 2} y={SVG_H - 16} textAnchor="middle"
              style={{ fontFamily: 'Barlow Condensed', fontSize: '9px', letterSpacing: '0.2em', fill: '#252535', textTransform: 'uppercase' }}>
              No GPS trace · load session to overlay telemetry
            </text>
          )}

          {/* Start/finish marker */}
          {proj && (() => {
            const sfPoint = refLayout
              ? proj([refLayout.waypoints[0][1], refLayout.waypoints[0][0]])
              : (trace.length ? proj([trace[0].lon, trace[0].lat]) : null);
            if (!sfPoint) return null;
            return (
              <g>
                <line x1={sfPoint[0] - 6} y1={sfPoint[1]} x2={sfPoint[0] + 6} y2={sfPoint[1]}
                  stroke="#F0F0F0" strokeWidth={2} opacity={0.6} />
                <text x={sfPoint[0]} y={sfPoint[1] - 8} textAnchor="middle"
                  style={{ fontFamily: 'Barlow Condensed', fontSize: '8px', letterSpacing: '0.15em', fill: '#505060', textTransform: 'uppercase' }}>
                  S/F
                </text>
              </g>
            );
          })()}

          {/* Corner markers */}
          {apexes.map(a => {
            const sel = selectedCornerId === a.id;
            return (
              <g key={a.id} style={{ cursor: 'pointer' }} filter={sel ? 'url(#cGlow)' : undefined}
                onClick={() => onCornerSelect?.(sel ? null : a.id)}>
                {sel && <circle cx={a.x} cy={a.y} r={18} fill="none" stroke="#A855F7" strokeWidth={1} opacity={0.3} />}
                <circle cx={a.x} cy={a.y} r={sel ? 11 : 8}
                  fill={sel ? '#A855F7' : '#0D0D16'}
                  stroke={sel ? '#A855F7' : '#383848'} strokeWidth={sel ? 0 : 1.5} />
                <text x={a.x} y={a.y + 0.5} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontFamily: 'Barlow Condensed', fontSize: sel ? '9px' : '8px', fontWeight: 700,
                    fill: sel ? '#FFF' : '#9898A8', userSelect: 'none', pointerEvents: 'none' }}>
                  {a.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Color legend */}
      <div className="flex items-center gap-2 px-4 pb-2.5 shrink-0">
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: '8px', letterSpacing: '0.12em', color: '#252535', textTransform: 'uppercase' }}>
          {mode === 'speed' ? 'slow' : '0'}
        </span>
        <div className="h-px flex-1 rounded" style={{
          background:
            mode === 'brake'    ? 'linear-gradient(to right,#0D0D12,#EF3340)' :
            mode === 'throttle' ? 'linear-gradient(to right,#0D0D12,#00C853)' :
            'linear-gradient(to right,#1C2B4A,#1C69D4,#00D4FF,#CCFFE8)',
        }} />
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: '8px', letterSpacing: '0.12em', color: '#404050', textTransform: 'uppercase' }}>
          {mode === 'speed' ? 'fast' : mode === 'throttle' ? '100%' : 'max'}
        </span>
      </div>

      {/* Corner coaching card */}
      {selApex && <CornerCard corner={selApex.corner} onClose={() => onCornerSelect?.(null)} />}
    </div>
  );
}
