/**
 * ProgressTab — Personal Bests, Lap Time Progression, Consistency Trend
 *
 * Works from zero active sessions (reads trackHistory from IndexedDB memory).
 * When sessions are loaded, they also appear in the charts.
 */
import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import type { LoadedSession } from '@/types/session';
import type { AppMemory } from '@/lib/memory';
import { formatLapTime, sessionLabel } from '@/lib/utils';
import { FF, FS, T, S, SESSION_COLORS } from '@/lib/chartTheme';

interface Props {
  sessions: LoadedSession[];
  trackHistory: AppMemory['trackHistory'];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [, month, day] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[(month ?? 1) - 1]} ${day}`;
}

function lapSecondsToDisplay(s: number): string {
  return formatLapTime(s);
}

// ── Personal Bests Board ───────────────────────────────────────────────────────

interface TrackBest {
  track: string;
  bestLap: string;        // formatted mm:ss.xxx
  bestLapS: number;       // raw seconds for sorting
  date: string;
  lapCount: number;
  sessions: number;
}

function buildPersonalBests(
  trackHistory: AppMemory['trackHistory'],
  sessions: LoadedSession[]
): TrackBest[] {
  // Merge history entries + any loaded sessions not yet in history
  const byTrack = new Map<string, TrackBest>();

  // From persisted history
  for (const h of trackHistory) {
    // bestLap is stored as formatted string; parse to seconds for comparison
    const existing = byTrack.get(h.track);
    // parse "1:23.456" → seconds
    const parts = h.bestLap.split(':');
    let secs = 0;
    if (parts.length === 2) {
      secs = parseInt(parts[0]!) * 60 + parseFloat(parts[1]!);
    } else {
      secs = parseFloat(parts[0]!);
    }
    if (!existing || secs < existing.bestLapS) {
      byTrack.set(h.track, {
        track: h.track,
        bestLap: h.bestLap,
        bestLapS: secs,
        date: h.date,
        lapCount: h.lapCount,
        sessions: 1,
      });
    } else if (existing) {
      existing.sessions++;
    }
  }

  // From loaded sessions (may be more recent / better)
  for (const s of sessions) {
    const { header, consistency } = s.data;
    const existing = byTrack.get(header.track);
    if (!existing || consistency.best_lap_s < existing.bestLapS) {
      byTrack.set(header.track, {
        track: header.track,
        bestLap: lapSecondsToDisplay(consistency.best_lap_s),
        bestLapS: consistency.best_lap_s,
        date: header.date,
        lapCount: header.analyzed_laps,
        sessions: (existing?.sessions ?? 0) + 1,
      });
    } else if (existing) {
      existing.sessions++;
    }
  }

  return [...byTrack.values()].sort((a, b) => a.track.localeCompare(b.track));
}

function PersonalBestsBoard({ bests }: { bests: TrackBest[] }) {
  if (bests.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 rounded-lg border border-border/40"
        style={{ fontFamily: FF.sans, fontSize: `${FS.small}px`, color: T.muted }}>
        No sessions recorded yet — load a session to start tracking
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
      {bests.map(b => (
        <div key={b.track}
          className="rounded-lg border border-border/60 overflow-hidden"
          style={{ background: '#0B0B14' }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40"
            style={{ background: '#0D0D18' }}>
            <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>
              {b.track}
            </span>
            <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.ghost }}>
              {b.sessions} session{b.sessions !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="px-3 py-2 flex items-end justify-between gap-2">
            <div>
              <div style={{ fontFamily: FF.mono, fontSize: '22px', fontWeight: 700, color: '#A855F7', lineHeight: 1 }}>
                {b.bestLap}
              </div>
              <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.ghost, marginTop: 4 }}>
                {b.lapCount} laps · {formatDate(b.date)}
              </div>
            </div>
            <div className="shrink-0 w-1 h-8 rounded-full"
              style={{ background: 'linear-gradient(to bottom, #A855F7, #1C69D4)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Lap Time Progression Chart ─────────────────────────────────────────────────
// One data point per session entry in trackHistory, grouped by track.

interface ProgressPoint {
  dateLabel: string;
  dateIso: string;
  [track: string]: string | number;  // bestLap_s per track
}

function buildProgressionData(
  trackHistory: AppMemory['trackHistory'],
  sessions: LoadedSession[]
): { points: ProgressPoint[]; tracks: string[] } {
  // Combine history + loaded sessions (deduplicated by sessionId)
  const allEntries: Array<{ sessionId: string; track: string; date: string; bestLap_s: number }> = [];

  const historyIds = new Set(trackHistory.map(h => h.sessionId));

  for (const h of trackHistory) {
    const parts = h.bestLap.split(':');
    let secs = 0;
    if (parts.length === 2) {
      secs = parseInt(parts[0]!) * 60 + parseFloat(parts[1]!);
    } else {
      secs = parseFloat(parts[0]!);
    }
    allEntries.push({ sessionId: h.sessionId, track: h.track, date: h.date, bestLap_s: secs });
  }

  for (const s of sessions) {
    if (!historyIds.has(s.id)) {
      allEntries.push({
        sessionId: s.id,
        track: s.data.header.track,
        date: s.data.header.date,
        bestLap_s: s.data.consistency.best_lap_s,
      });
    }
  }

  if (allEntries.length === 0) return { points: [], tracks: [] };

  // Sort by date ascending
  allEntries.sort((a, b) => a.date.localeCompare(b.date));

  const tracks = [...new Set(allEntries.map(e => e.track))];

  // Build a point per entry date (each date = one dot per track if exists)
  const pointMap = new Map<string, ProgressPoint>();
  for (const e of allEntries) {
    if (!pointMap.has(e.date)) {
      pointMap.set(e.date, { dateIso: e.date, dateLabel: formatDate(e.date) });
    }
    const pt = pointMap.get(e.date)!;
    const key = `${e.track}_s`;
    // Keep the best (lowest) for that date if multiple sessions on same day
    if (pt[key] === undefined || (e.bestLap_s < (pt[key] as number))) {
      pt[key] = e.bestLap_s;
    }
  }

  const points = [...pointMap.values()].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  return { points, tracks };
}

function formatYAxisTick(value: number): string {
  if (typeof value !== 'number' || !isFinite(value)) return '';
  const m = Math.floor(value / 60);
  const s = value - m * 60;
  return `${m}:${s.toFixed(0).padStart(2, '0')}`;
}

interface ProgressionTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function ProgressionTooltip({ active, payload, label }: ProgressionTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-border p-2 space-y-1"
      style={{ background: '#0E0E1A', fontFamily: FF.sans, fontSize: `${FS.nano}px` }}>
      <div style={{ color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span style={{ display: 'inline-block', width: 8, height: 2, background: p.color, borderRadius: 1 }} />
          <span style={{ color: T.label }}>{p.name.replace('_s', '')}</span>
          <span style={{ fontFamily: FF.mono, color: p.color, fontWeight: 700 }}>
            {formatLapTime(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function LapTimeProgressionChart({ points, tracks }: { points: ProgressPoint[]; tracks: string[] }) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 rounded-lg border border-border/40"
        style={{ fontFamily: FF.sans, fontSize: `${FS.small}px`, color: T.muted }}>
        {points.length === 0
          ? 'No session history yet'
          : 'Load more sessions across multiple dates to see progression'}
      </div>
    );
  }

  // Compute Y domain with some padding
  let minS = Infinity, maxS = -Infinity;
  for (const pt of points) {
    for (const t of tracks) {
      const v = pt[`${t}_s`];
      if (typeof v === 'number') {
        minS = Math.min(minS, v);
        maxS = Math.max(maxS, v);
      }
    }
  }
  const pad = (maxS - minS) * 0.1 || 2;
  // Y-axis reversed: lower lap times = top of chart (better)
  const yDomain: [number, number] = [maxS + pad, minS - pad];

  return (
    <div>
      <p style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, letterSpacing: '0.04em', marginBottom: 8 }}>
        Best lap per session — lower is faster. Y-axis reversed so improvement goes up.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="#1C1C2C" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontFamily: FF.sans, fontSize: FS.nano, fill: T.muted }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={yDomain}
            reversed
            tickFormatter={formatYAxisTick}
            tick={{ fontFamily: FF.mono, fontSize: FS.nano, fill: T.muted }}
            axisLine={false} tickLine={false}
            width={52}
          />
          <Tooltip content={<ProgressionTooltip />} />
          {tracks.length > 1 && (
            <Legend
              iconType="plainline"
              formatter={v => v.replace('_s', '')}
              wrapperStyle={{ fontFamily: FF.sans, fontSize: FS.nano, color: T.label }}
            />
          )}
          {tracks.map((track, i) => (
            <Line
              key={track}
              type="monotone"
              dataKey={`${track}_s`}
              name={`${track}_s`}
              stroke={SESSION_COLORS[i % SESSION_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: SESSION_COLORS[i % SESSION_COLORS.length], strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Consistency Trend Chart ────────────────────────────────────────────────────
// std_dev_s over sessions. Target reference line at 0.5s (tight consistency).

interface ConsistencyPoint {
  dateLabel: string;
  dateIso: string;
  sessionLabel: string;
  stdDev: number;
  spread: number;
  consistencyScore: number;
}

function buildConsistencyData(
  trackHistory: AppMemory['trackHistory'],
  sessions: LoadedSession[]
): ConsistencyPoint[] {
  const points: ConsistencyPoint[] = [];
  const usedIds = new Set<string>();

  // From loaded sessions (most accurate, has std_dev_s)
  for (const s of sessions) {
    usedIds.add(s.id);
    points.push({
      dateLabel: formatDate(s.data.header.date),
      dateIso: s.data.header.date,
      sessionLabel: sessionLabel(s),
      stdDev: s.data.consistency.std_dev_s,
      spread: s.data.consistency.spread_s,
      consistencyScore: s.data.consistency.consistency_score,
    });
  }

  // From history for sessions not currently loaded
  for (const h of trackHistory) {
    if (!usedIds.has(h.sessionId)) {
      // trackHistory only stores bestLap, not std_dev — skip unless it's a loaded session
      // We still add it as a placeholder with no stdDev
    }
  }

  return points.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

interface ConsistencyTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ConsistencyPoint; value: number }>;
  label?: string;
}

function ConsistencyTooltip({ active, payload }: ConsistencyTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  return (
    <div className="rounded border border-border p-2 space-y-1"
      style={{ background: '#0E0E1A', fontFamily: FF.sans, fontSize: `${FS.nano}px` }}>
      <div style={{ color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{d.sessionLabel}</div>
      <div className="flex items-center gap-2">
        <span style={{ color: T.label }}>Std Dev</span>
        <span style={{ fontFamily: FF.mono, color: d.stdDev < 0.5 ? S.good : d.stdDev < 1.0 ? S.warn : S.bad, fontWeight: 700 }}>
          {d.stdDev.toFixed(3)}s
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span style={{ color: T.label }}>Spread</span>
        <span style={{ fontFamily: FF.mono, color: T.label }}>{d.spread.toFixed(2)}s</span>
      </div>
      <div className="flex items-center gap-2">
        <span style={{ color: T.label }}>Score</span>
        <span style={{ fontFamily: FF.mono, color: T.label }}>{d.consistencyScore.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function stdDevColor(v: number): string {
  if (v < 0.5) return S.good;
  if (v < 1.0) return S.warn;
  return S.bad;
}

function ConsistencyTrendChart({ points }: { points: ConsistencyPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 rounded-lg border border-border/40"
        style={{ fontFamily: FF.sans, fontSize: `${FS.small}px`, color: T.muted }}>
        {points.length === 0
          ? 'Load sessions to see consistency trend'
          : 'Load sessions across multiple dates to see trend'}
      </div>
    );
  }

  const maxDev = Math.max(...points.map(p => p.stdDev));
  const yMax = Math.ceil((maxDev + 0.3) * 10) / 10;

  return (
    <div>
      <p style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted, letterSpacing: '0.04em', marginBottom: 8 }}>
        Lap time standard deviation per session. Below 0.5s = consistent; below 1.0s = target.
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="#1C1C2C" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontFamily: FF.sans, fontSize: FS.nano, fill: T.muted }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            domain={[0, yMax]}
            tickFormatter={v => `${v.toFixed(1)}s`}
            tick={{ fontFamily: FF.mono, fontSize: FS.nano, fill: T.muted }}
            axisLine={false} tickLine={false}
            width={40}
          />
          <Tooltip content={<ConsistencyTooltip />} />

          {/* Target reference lines */}
          <ReferenceLine y={0.5} stroke={S.good} strokeDasharray="4 4" strokeWidth={1}
            label={{ value: '0.5s', position: 'right', fontFamily: FF.sans, fontSize: FS.nano, fill: S.good }} />
          <ReferenceLine y={1.0} stroke={S.warn} strokeDasharray="4 4" strokeWidth={1}
            label={{ value: '1.0s', position: 'right', fontFamily: FF.sans, fontSize: FS.nano, fill: S.warn }} />

          <Line
            type="monotone"
            dataKey="stdDev"
            name="Std Dev"
            stroke="#1C69D4"
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: ConsistencyPoint };
              const color = stdDevColor(payload.stdDev);
              return <circle key={`dot-${payload.dateIso}`} cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
            }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────────────────
function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.muted }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
import React from 'react';

export function ProgressTab({ sessions, trackHistory }: Props) {
  const bests = useMemo(() => buildPersonalBests(trackHistory, sessions), [trackHistory, sessions]);
  const { points: progressPoints, tracks } = useMemo(
    () => buildProgressionData(trackHistory, sessions),
    [trackHistory, sessions]
  );
  const consistencyPoints = useMemo(
    () => buildConsistencyData(trackHistory, sessions),
    [trackHistory, sessions]
  );

  return (
    <div className="space-y-8">
      <SubSection title="Personal Bests">
        <PersonalBestsBoard bests={bests} />
      </SubSection>

      <SubSection title="Lap Time Progression">
        <LapTimeProgressionChart points={progressPoints} tracks={tracks} />
      </SubSection>

      <SubSection title="Consistency Trend">
        <ConsistencyTrendChart points={consistencyPoints} />
      </SubSection>
    </div>
  );
}
