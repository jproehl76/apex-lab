/**
 * TrackHeatMap — Leaflet satellite map with GPS heat overlay + coaching sidebar
 *
 * Map layers:
 *   Base     : ESRI World Imagery satellite tiles (free, no API key)
 *   Overlay  : Canvas GPS heat trace (speed / throttle / brake)
 *   Markers  : react-leaflet CircleMarkers for each corner apex
 *
 * Coaching sidebar derives tips entirely from the driver's own session data:
 *   brake_point_std_m, trail_brake_duration_s, throttle_on_m, coast_time_avg,
 *   min_speed_delta
 *
 * Track geometry auto-fetches from OpenStreetMap Overpass API when the
 * session GPS trace falls outside any known reference layout bounding box.
 */
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LoadedSession, BestLapCorner, GpsPoint } from '@/types/session';
import { KPH_TO_MPH, M_TO_FEET, sessionLabel } from '@/lib/utils';
import { findTrackLayout } from '@/assets/trackLayouts';
import { fetchOsmTrackLayout } from '@/lib/services/osmTrackFetch';
import { detectCornersFromWaypoints } from '@/lib/services/detectCorners';
import { T, FF, FS, S } from '@/lib/chartTheme';

export type HeatChannel = 'speed' | 'throttle' | 'brake';

// ── Coaching data model ───────────────────────────────────────────────────────
interface CornerCoaching {
  id: string;
  name: string;
  corner: BestLapCorner | null;
  apexGapMph:    number | null;
  brakeStdFt:    number | null;
  coastAvgS:     number | null;
  apexAvgMph:    number | null;
  opportunityPct: number;
  tip: string;
  tipLevel: 'good' | 'warn' | 'bad';
}

function buildCoachingData(session: LoadedSession): CornerCoaching[] {
  const consistency = session.data.consistency.corners;
  const blcMap = new Map<string, BestLapCorner>();
  for (const c of session.data.best_lap_corners) {
    blcMap.set(c.corner_id.toUpperCase(), c);
    blcMap.set(c.corner_name.toUpperCase(), c);
  }

  const rows: CornerCoaching[] = Object.entries(consistency).map(([id, cc]) => {
    const uid = id.toUpperCase();
    const blc = blcMap.get(uid) ?? null;

    const apexGapMph = cc.min_speed_delta * KPH_TO_MPH;
    const brakeStdFt = cc.brake_point_std_m * M_TO_FEET;
    const coastAvgS  = cc.coast_time_avg;
    const apexAvgMph = cc.min_speed_avg * KPH_TO_MPH;
    const trail   = blc?.trail_brake_duration_s ?? null;
    const throtFt = blc ? blc.throttle_on_m * M_TO_FEET : null;

    let tip = '';
    let tipLevel: 'good' | 'warn' | 'bad' = 'good';

    if (brakeStdFt !== null && brakeStdFt > 50) {
      tip = `Brake point varies ±${brakeStdFt.toFixed(0)}ft — pick a fixed trackside reference and commit to it every lap.`;
      tipLevel = 'bad';
    } else if (coastAvgS !== null && coastAvgS > 0.5) {
      tip = `You coast ${coastAvgS.toFixed(2)}s between brake and throttle. Eliminate the dead band — transition directly to throttle.`;
      tipLevel = 'bad';
    } else if (apexGapMph > 3) {
      tip = `Apex speed varies ${apexGapMph.toFixed(1)} mph lap-to-lap. Identify your turn-in point and keep throttle inputs smooth.`;
      tipLevel = 'bad';
    } else if (trail !== null && trail < 0.08) {
      tip = `Trail braking is minimal (${trail.toFixed(2)}s). Adding brake pressure through turn-in rotates the car and widens the effective apex.`;
      tipLevel = 'warn';
    } else if (throtFt !== null && throtFt > 150) {
      tip = `Throttle pickup at ${throtFt.toFixed(0)}ft is late. Move application earlier — the car will track out naturally.`;
      tipLevel = 'warn';
    } else if (brakeStdFt !== null && brakeStdFt > 25) {
      tip = `Brake consistency is moderate (±${brakeStdFt.toFixed(0)}ft). Tighten references — try a painted kerb or shadow line.`;
      tipLevel = 'warn';
    } else {
      tip = 'Consistent corner — technique is solid. Focus on maximising exit speed for the following straight.';
      tipLevel = 'good';
    }

    const gapScore   = Math.min(apexGapMph / 6, 1) * 60;
    const brakeScore = brakeStdFt !== null ? Math.min(brakeStdFt / 60, 1) * 40 : 0;
    const opportunityPct = Math.round(gapScore + brakeScore);

    return { id: uid, name: uid, corner: blc, apexGapMph, brakeStdFt, coastAvgS, apexAvgMph, opportunityPct, tip, tipLevel };
  });

  return rows.sort((a, b) => b.opportunityPct - a.opportunityPct);
}

function opportunityColor(pct: number): string {
  if (pct >= 60) return S.bad;
  if (pct >= 30) return S.warn;
  return S.good;
}


// ── Heat overlay ──────────────────────────────────────────────────────────────
// Strategy: if a reference track layout exists, paint its waypoints with the
// telemetry color of the nearest GPS trace point. This guarantees the colored
// path sits pixel-perfect on the track outline (same as AiM/MoTeC approach).
// Falls back to raw GPS trace when no reference layout is available.
interface Stats { minSpd: number; maxSpd: number; maxBrake: number }

function getQuantizedColor(pt: GpsPoint, ch: HeatChannel, stats: Stats): string {
  switch (ch) {
    case 'speed': {
      const t = (pt.speed_kph - stats.minSpd) / Math.max(1, stats.maxSpd - stats.minSpd);
      if (t >= 0.67) return '#22C55E';
      if (t >= 0.33) return '#F59E0B';
      return '#EF4444';
    }
    case 'throttle': {
      const p = pt.throttle_pct;
      if (p >= 70) return '#22C55E';
      if (p >= 25) return '#84CC16';
      return '#15803D';
    }
    case 'brake': {
      if (stats.maxBrake <= 0) return 'rgba(239,68,68,0.3)';
      const t = pt.brake_bar / stats.maxBrake;
      if (t >= 0.6) return '#EF4444';
      if (t >= 0.2) return '#F97316';
      return 'rgba(239,68,68,0.35)';
    }
  }
}

/** Given an array of [lat,lon] path points and their assigned colors, group into
 *  consecutive same-color runs to minimise the number of Polyline elements. */
function buildSegments(
  path: [number, number][],
  colors: string[],
): { color: string; positions: [number, number][] }[] {
  if (path.length < 2) return [];
  const result: { color: string; positions: [number, number][] }[] = [];
  let curColor = colors[0];
  let curPts: [number, number][] = [path[0]];

  for (let i = 1; i < path.length; i++) {
    const c = colors[i];
    if (c === curColor) {
      curPts.push(path[i]);
    } else {
      curPts.push(path[i]); // overlap for seamless join
      result.push({ color: curColor, positions: curPts });
      curColor = c;
      curPts = [path[i - 1], path[i]];
    }
  }
  if (curPts.length > 1) result.push({ color: curColor, positions: curPts });
  return result;
}

function HeatPolylines({
  trace, channel, stats, refWaypoints,
}: {
  trace: GpsPoint[];
  channel: HeatChannel;
  stats: Stats;
  refWaypoints: [number, number][] | null;
}) {
  const segments = useMemo(() => {
    if (!trace.length) return [];

    if (refWaypoints && refWaypoints.length >= 2) {
      // ── Layout-mapped mode ─────────────────────────────────────────────────
      // For each reference waypoint, find the nearest GPS trace point and use
      // its telemetry channel value for color. The path itself is the reference
      // layout — pixel-perfect with the satellite tiles.
      const colors: string[] = refWaypoints.map(([wLat, wLon]) => {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < trace.length; i++) {
          const d = Math.hypot(trace[i].lat - wLat, trace[i].lon - wLon);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        return getQuantizedColor(trace[bestIdx], channel, stats);
      });
      return buildSegments(refWaypoints, colors);
    }

    // ── Raw GPS trace mode (no reference layout) ───────────────────────────
    const MAX_JUMP = 0.005; // ~500m — skip GPS discontinuities between laps
    const path: [number, number][] = [];
    const colors: string[] = [];

    for (let i = 0; i < trace.length; i++) {
      if (i > 0) {
        const jump = Math.hypot(trace[i].lat - trace[i-1].lat, trace[i].lon - trace[i-1].lon);
        if (jump > MAX_JUMP) continue;
      }
      path.push([trace[i].lat, trace[i].lon]);
      colors.push(getQuantizedColor(trace[i], channel, stats));
    }

    return buildSegments(path, colors);
  }, [trace, channel, stats, refWaypoints]);

  return (
    <>
      {segments.map((seg, i) => (
        <Polyline
          key={i}
          positions={seg.positions}
          pathOptions={{ color: seg.color, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
          interactive={false}
        />
      ))}
    </>
  );
}

// ── Map bounds fitter — updates bounds when session changes ───────────────────
function MapBoundsFitter({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, bounds]);
  return null;
}

// ── Apex list — auto-detected from waypoint curvature ─────────────────────────
interface Apex {
  id: string; name: string; lat: number; lon: number; corner: BestLapCorner | null;
}

function matchCorner(id: string, name: string, sessionCorners: BestLapCorner[]): BestLapCorner | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return sessionCorners.find(c =>
    norm(c.corner_id) === norm(id) ||
    norm(c.corner_name) === norm(name) ||
    norm(c.corner_name) === norm(id)
  ) ?? null;
}

/**
 * Build the apex list for corner markers.
 *
 * Priority:
 *  1. Known track with waypoints → detectCornersFromWaypoints (official names from cornerNames)
 *  2. OSM-fetched waypoints for unknown track → auto-detect with sequential T1, T2…
 *  3. No waypoints → place markers at speed minima in the GPS trace (rough fallback)
 */
function buildApexes(
  refLayout: ReturnType<typeof findTrackLayout>,
  osmWaypoints: [number, number][] | null,
  trace: GpsPoint[],
  sessionCorners: BestLapCorner[],
): Apex[] {
  const waypoints = refLayout?.waypoints ?? osmWaypoints;
  const cornerNames = refLayout?.cornerNames;

  if (waypoints && waypoints.length >= 5) {
    const detected = detectCornersFromWaypoints(waypoints, cornerNames);
    return detected.map(dc => ({
      id: dc.id, name: dc.name, lat: dc.lat, lon: dc.lon,
      corner: matchCorner(dc.id, dc.name, sessionCorners),
    }));
  }

  // Fallback: place at speed minima in the GPS trace
  if (!trace.length || !sessionCorners.length) return [];
  const chunk = Math.ceil(trace.length / sessionCorners.length);
  return sessionCorners.flatMap((c, i) => {
    const slice = trace.slice(i * chunk, Math.min((i + 1) * chunk, trace.length));
    if (!slice.length) return [];
    const apex = slice.reduce((m, p) => p.speed_kph < m.speed_kph ? p : m, slice[0]);
    return [{ id: c.corner_id, name: c.corner_name, lat: apex.lat, lon: apex.lon, corner: c }];
  });
}

// ── Coaching sidebar ──────────────────────────────────────────────────────────
function CoachingPanel({
  coaching, selectedId, onSelect, session,
}: {
  coaching: CornerCoaching[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  session: LoadedSession;
}) {
  const sel = coaching.find(c => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-full border-l border-border bg-card/40" style={{ width: 280, minWidth: 280 }}>
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.15em', textTransform: 'uppercase', color: T.muted }}>
          Corner Coaching
        </div>
        <div style={{ fontFamily: FF.sans, fontSize: '9px', letterSpacing: '0.08em', color: T.muted, marginTop: 2 }}>
          {session.data.consistency.lap_count} clean laps · tap a corner to drill down
        </div>
      </div>

      {sel && (
        <div className="shrink-0 border-b border-border p-3 space-y-2"
          style={{ background: `${opportunityColor(sel.opportunityPct)}08` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded" style={{ background: opportunityColor(sel.opportunityPct) }} />
              <span style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, fontWeight: 700, letterSpacing: '0.08em', color: T.fg }}>
                {sel.name}
              </span>
            </div>
            <button onClick={() => onSelect(null)}
              style={{ fontFamily: FF.sans, fontSize: '9px', color: T.muted, letterSpacing: '0.1em' }}
              className="hover:text-destructive transition-colors">✕</button>
          </div>

          {sel.corner && (
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Entry', val: (sel.corner.entry_speed_kph * KPH_TO_MPH).toFixed(0), color: S.info },
                { label: 'Apex',  val: (sel.corner.min_speed_kph  * KPH_TO_MPH).toFixed(0), color: S.best },
                { label: 'Exit',  val: (sel.corner.exit_speed_kph * KPH_TO_MPH).toFixed(0), color: S.good },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded p-1.5 text-center" style={{ background: '#0E0E1A', border: '1px solid #1E1E2E' }}>
                  <div style={{ fontFamily: FF.sans, fontSize: '9px', letterSpacing: '0.08em', color: T.muted, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontFamily: FF.mono, fontSize: `${FS.large}px`, fontWeight: 700, color, lineHeight: 1.2 }}>{val}</div>
                  <div style={{ fontFamily: FF.sans, fontSize: '9px', color: T.muted }}>mph</div>
                </div>
              ))}
            </div>
          )}

          {sel.apexGapMph !== null && (
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Apex Variance</span>
              <span style={{ fontFamily: FF.mono, fontSize: `${FS.value}px`, fontWeight: 700, color: opportunityColor(sel.opportunityPct) }}>
                {sel.apexGapMph.toFixed(1)} mph
              </span>
            </div>
          )}

          {sel.corner && (
            <div className="space-y-1">
              {sel.brakeStdFt !== null && (
                <MetricRow label="Brake σ" value={`±${sel.brakeStdFt.toFixed(0)}ft`} sub="consistency"
                  color={sel.brakeStdFt > 40 ? S.bad : sel.brakeStdFt > 20 ? S.warn : S.good} />
              )}
              {sel.corner.brake_point_m > 0 && (
                <MetricRow label="Brake Pt (best lap)" value={`${(sel.corner.brake_point_m * M_TO_FEET).toFixed(0)}ft`}
                  sub="from entry" color={T.fg} />
              )}
              {sel.corner.trail_brake_duration_s > 0 && (
                <MetricRow label="Trail Brake" value={`${sel.corner.trail_brake_duration_s.toFixed(2)}s`} sub="best lap"
                  color={sel.corner.trail_brake_duration_s > 0.2 ? S.good : sel.corner.trail_brake_duration_s > 0.08 ? S.warn : S.bad} />
              )}
              {sel.corner.throttle_on_m > 0 && (
                <MetricRow label="Throttle Pickup" value={`${(sel.corner.throttle_on_m * M_TO_FEET).toFixed(0)}ft`} sub="before apex"
                  color={sel.corner.throttle_on_m * M_TO_FEET < 80 ? S.good : sel.corner.throttle_on_m * M_TO_FEET < 150 ? S.warn : S.bad} />
              )}
              {sel.coastAvgS !== null && sel.coastAvgS > 0.05 && (
                <MetricRow label="Avg Coast" value={`${sel.coastAvgS.toFixed(2)}s`} sub="brake→throttle gap"
                  color={sel.coastAvgS > 0.4 ? S.bad : sel.coastAvgS > 0.2 ? S.warn : S.good} />
              )}
              {sel.corner.peak_lat_g > 0 && (
                <MetricRow label="Peak Lat G" value={`${sel.corner.peak_lat_g.toFixed(2)}G`} sub="best lap" color={T.fg} />
              )}
            </div>
          )}

          <div className="rounded p-2.5"
            style={{ background: `${sel.tipLevel === 'good' ? S.good : sel.tipLevel === 'warn' ? S.warn : S.bad}0D`,
              border: `1px solid ${sel.tipLevel === 'good' ? S.good : sel.tipLevel === 'warn' ? S.warn : S.bad}25` }}>
            <div style={{ fontFamily: FF.sans, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: sel.tipLevel === 'good' ? S.good : sel.tipLevel === 'warn' ? S.warn : S.bad, marginBottom: 4 }}>
              {sel.tipLevel === 'good' ? '✓ Solid' : sel.tipLevel === 'warn' ? '↑ Opportunity' : '⚑ Focus Area'}
            </div>
            <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.label, lineHeight: 1.5 }}>
              {sel.tip}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-1.5 border-b border-border/50">
          <span style={{ fontFamily: FF.sans, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>
            All Corners · Biggest Opportunity First
          </span>
        </div>
        {coaching.map((c, i) => {
          const color = opportunityColor(c.opportunityPct);
          const isSelected = selectedId === c.id;
          return (
            <button key={c.id} onClick={() => onSelect(isSelected ? null : c.id)}
              className="w-full flex items-center gap-2 px-3 py-2 transition-colors"
              style={{ background: isSelected ? `${color}12` : undefined, borderBottom: '1px solid #12121C' }}>
              <span style={{ fontFamily: FF.mono, fontSize: '9px', color: T.muted, width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
              <div className="relative rounded-full overflow-hidden" style={{ width: 32, height: 4, background: '#1A1A2A', flexShrink: 0 }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${c.opportunityPct}%`, background: color }} />
              </div>
              <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, fontWeight: isSelected ? 700 : 400,
                color: isSelected ? color : T.label, flex: 1, textAlign: 'left' }}>{c.name}</span>
              {c.apexGapMph !== null && (
                <span style={{ fontFamily: FF.mono, fontSize: `${FS.nano}px`, color, flexShrink: 0 }}>
                  {c.apexGapMph.toFixed(1)}<span style={{ fontFamily: FF.sans, fontSize: '8px', color: T.muted }}> mph</span>
                </span>
              )}
              <span style={{ fontSize: 9, flexShrink: 0 }}>
                {c.tipLevel === 'good' ? '✓' : c.tipLevel === 'warn' ? '↑' : '⚑'}
              </span>
            </button>
          );
        })}
        {coaching.length === 0 && (
          <div className="p-4" style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted }}>
            No corner data available — load a session with lap data.
          </div>
        )}
      </div>
    </div>
  );
}

function MetricRow({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, letterSpacing: '0.06em' }}>{label}</span>
        {sub && <span style={{ fontFamily: FF.sans, fontSize: '9px', color: T.muted, marginLeft: 4 }}>({sub})</span>}
      </div>
      <span style={{ fontFamily: FF.mono, fontSize: `${FS.value}px`, fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

// ── Channel toggle ─────────────────────────────────────────────────────────────
const CHANNELS: { id: HeatChannel; label: string; color: string }[] = [
  { id: 'speed',    label: 'Speed',    color: S.good },
  { id: 'throttle', label: 'Throttle', color: '#22C55E' },
  { id: 'brake',    label: 'Brake',    color: S.bad  },
];

// Satellite tile layer options
const TILE_LAYERS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DigitalGlobe, GeoEye, i-cubed, USDA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, GIS User Community',
    maxZoom: 19,
  },
  streets: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  sessions: LoadedSession[];
  selectedCornerId?: string | null;
  onCornerSelect?: (id: string | null) => void;
}

export function TrackHeatMap({ sessions, selectedCornerId, onCornerSelect }: Props) {
  const [channel, setChannel]         = useState<HeatChannel>('speed');
  const [activeSessionIdx, setActiveSessionIdx] = useState(0);
  const [showCoaching, setShowCoaching] = useState(true);
  const [tileMode, setTileMode]       = useState<'satellite' | 'streets'>('satellite');
  const [osmWaypoints, setOsmWaypoints] = useState<[number, number][] | null>(null);

  const session   = sessions[activeSessionIdx] ?? sessions[0];
  const trace     = useMemo(() => session?.data.gps_trace ?? [], [session]);
  const refLayout = useMemo(() => findTrackLayout(session?.data.header.track), [session]);
  const coaching  = useMemo(() => session ? buildCoachingData(session) : [], [session]);

  const stats = useMemo(() => {
    if (!trace.length) return { minSpd: 0, maxSpd: 200, maxBrake: 50 };
    const speeds = trace.map(p => p.speed_kph);
    const brakes = trace.map(p => p.brake_bar);
    return { minSpd: Math.min(...speeds), maxSpd: Math.max(...speeds), maxBrake: Math.max(...brakes) };
  }, [trace]);

  const apexes = useMemo(
    () => buildApexes(refLayout, osmWaypoints, trace, session?.data.best_lap_corners ?? []),
    [refLayout, osmWaypoints, trace, session]
  );

  // Auto-fetch OSM track geometry when we have GPS trace but no precise reference layout
  useEffect(() => {
    if (!trace.length) return;
    if (refLayout && refLayout.waypoints.length > 20) return; // have good local data
    fetchOsmTrackLayout(trace).then(result => {
      if (result) setOsmWaypoints(result.waypoints);
    });
  }, [trace, refLayout]);

  // Calculate map bounds for initial fit
  const mapBounds = useMemo((): L.LatLngBoundsExpression | null => {
    const pts = trace.length > 1 ? trace
      : (osmWaypoints ?? refLayout?.waypoints.map(([lat, lon]) => ({ lat, lon })) ?? []);
    if (!pts.length) return null;
    const lats = pts.map(p => 'lat' in p ? p.lat : p[0]);
    const lons = pts.map(p => 'lat' in p ? p.lon : p[1]);
    return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
  }, [trace, refLayout, osmWaypoints]);

  const accentColor = refLayout?.colors.primary ?? S.info;
  const trackName   = session?.data.header.track ?? 'Track Map';

  const legendItems = useMemo(() => {
    if (channel === 'speed') {
      const hi = (stats.maxSpd * KPH_TO_MPH).toFixed(0);
      const lo = (stats.minSpd * KPH_TO_MPH).toFixed(0);
      return [{ color: S.bad, label: `${lo} mph` }, { color: S.warn, label: '' }, { color: S.good, label: `${hi} mph` }];
    }
    if (channel === 'throttle') return [{ color: 'rgba(34,197,94,0.2)', label: '0%' }, { color: S.good, label: '100%' }];
    return [{ color: 'rgba(239,68,68,0.2)', label: '0 bar' }, { color: S.bad, label: `${stats.maxBrake.toFixed(0)} bar` }];
  }, [channel, stats]);

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, letterSpacing: '0.1em', color: T.muted, textTransform: 'uppercase' }}>
          Load a session to see the map
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden rounded-lg bg-card">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-border flex-wrap">
        {/* Track + session selector */}
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>
            {trackName}
          </span>
          {sessions.length > 1 && sessions.map((s, i) => (
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
        <div className="flex items-center gap-1.5">
          {legendItems.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: item.color, border: '1px solid #2A2A3A' }} />
              {item.label && <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted }}>{item.label}</span>}
            </span>
          ))}
        </div>

        {/* Tile toggle */}
        <button onClick={() => setTileMode(v => v === 'satellite' ? 'streets' : 'satellite')}
          style={{
            fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.08em',
            padding: '3px 10px', borderRadius: 4, textTransform: 'uppercase',
            border: '1px solid #1E1E2E', background: 'transparent', color: T.muted,
            transition: 'all 0.15s',
          }}>
          {tileMode === 'satellite' ? '🛰 Satellite' : '🗺 Streets'}
        </button>

        {/* Coaching toggle */}
        <button onClick={() => setShowCoaching(v => !v)} className="ml-auto"
          style={{
            fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.08em',
            padding: '3px 10px', borderRadius: 4, textTransform: 'uppercase',
            border: `1px solid ${showCoaching ? S.best : '#1E1E2E'}`,
            background: showCoaching ? `${S.best}15` : 'transparent',
            color: showCoaching ? S.best : T.muted,
            transition: 'all 0.15s',
          }}>
          Coaching {showCoaching ? '▸' : '◂'}
        </button>
      </div>

      {/* ── GPS missing notice ── */}
      {trace.length === 0 && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border"
          style={{ background: `${S.warn}10`, borderColor: `${S.warn}30` }}>
          <span style={{ color: S.warn, fontSize: 14 }}>⚠</span>
          <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: S.warn, letterSpacing: '0.06em' }}>
            No GPS data — re-export from RaceChrono with <strong>Latitude</strong> and <strong>Longitude</strong> channels enabled.
          </div>
        </div>
      )}

      {/* ── Map + coaching layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Leaflet map */}
        <div className="relative flex-1 min-w-0">
          {mapBounds ? (
            <MapContainer
              key={session.id}
              bounds={mapBounds}
              boundsOptions={{ padding: [40, 40] }}
              style={{ width: '100%', height: '100%' }}
              zoomControl={true}
              attributionControl={true}
            >
              <TileLayer
                key={tileMode}
                url={TILE_LAYERS[tileMode].url}
                attribution={TILE_LAYERS[tileMode].attribution}
                maxZoom={TILE_LAYERS[tileMode].maxZoom}
              />

              {/* Fit bounds when session changes */}
              <MapBoundsFitter bounds={mapBounds} />

              {/* Heat overlay — painted onto reference layout waypoints for pixel-perfect alignment */}
              {trace.length > 1 && (
                <HeatPolylines
                  trace={trace}
                  channel={channel}
                  stats={stats}
                  refWaypoints={refLayout?.waypoints ?? osmWaypoints}
                />
              )}

              {/* Corner apex markers */}
              {apexes.map(a => {
                const coachEntry = coaching.find(c => c.id === a.id);
                const color = coachEntry ? opportunityColor(coachEntry.opportunityPct) : accentColor;
                const isSelected = selectedCornerId === a.id;
                const hasData = a.corner !== null;

                return (
                  <CircleMarker
                    key={a.id}
                    center={[a.lat, a.lon]}
                    radius={isSelected ? 12 : 8}
                    pathOptions={{
                      color,
                      fillColor: isSelected ? color : '#0D0D1A',
                      fillOpacity: isSelected ? 0.95 : hasData ? 0.85 : 0.5,
                      weight: isSelected ? 2.5 : 1.5,
                      opacity: hasData ? 0.9 : 0.5,
                    }}
                    eventHandlers={{
                      click: () => hasData && onCornerSelect?.(isSelected ? null : a.id),
                    }}
                  >
                    <Tooltip
                      permanent
                      direction="top"
                      offset={[0, -8]}
                      className="leaflet-corner-label"
                    >
                      <span style={{
                        fontFamily: FF.sans, fontSize: '9px', fontWeight: 700,
                        color: isSelected ? '#FFF' : T.label,
                        background: 'transparent', border: 'none', boxShadow: 'none', padding: 0,
                      }}>
                        {a.name}
                      </span>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, textTransform: 'uppercase' }}>
                No location data available
              </span>
            </div>
          )}
        </div>

        {/* Coaching sidebar */}
        {showCoaching && coaching.length > 0 && (
          <CoachingPanel
            coaching={coaching}
            selectedId={selectedCornerId ?? null}
            onSelect={id => onCornerSelect?.(id)}
            session={session}
          />
        )}
      </div>
    </div>
  );
}
