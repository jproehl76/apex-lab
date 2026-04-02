import { useEffect, useState } from 'react';
import { fetchOuraDataForDates, type OuraDayData } from '@/lib/services/ouraApi';
import { loadHealthCache, getCacheAge } from '@/lib/healthCache';
import { FF, FS, T, S } from '@/lib/chartTheme';

const OURA_TOKEN = import.meta.env.VITE_OURA_PERSONAL_TOKEN as string | undefined;

interface Props {
  sessionDates: string[];
}

// ── Color helpers ──────────────────────────────────────────────────────────────
function readinessColor(score: number | null): string {
  if (score === null) return T.muted;
  if (score >= 70) return S.good;
  if (score >= 50) return S.warn;
  return S.bad;
}
function sleepColor(score: number | null): string {
  if (score === null) return T.muted;
  if (score >= 85) return S.good;
  if (score >= 70) return S.warn;
  return S.bad;
}
function hrvColor(ms: number | null): string {
  if (ms === null) return T.muted;
  if (ms >= 70) return S.good;
  if (ms >= 50) return S.warn;
  return S.bad;
}
function hrColor(bpm: number | null): string {
  if (bpm === null) return T.muted;
  if (bpm <= 55) return S.good;
  if (bpm <= 65) return S.warn;
  return S.bad;
}
function tempColor(delta: number | null): string {
  if (delta === null) return T.muted;
  const abs = Math.abs(delta);
  if (abs <= 0.3) return S.good;
  if (abs <= 0.6) return S.warn;
  return S.bad;
}
function activityColor(score: number | null): string {
  if (score === null) return T.muted;
  if (score >= 70) return S.good;
  if (score >= 50) return S.warn;
  return S.bad;
}

// ── Format helpers ─────────────────────────────────────────────────────────────
function fmt(v: number | null, decimals = 0, suffix = ''): string {
  if (v === null) return '—';
  return `${decimals === 0 ? Math.round(v) : v.toFixed(decimals)}${suffix}`;
}
function fmtHours(h: number | null): string {
  if (h === null) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}
function fmtTempDelta(v: number | null): string {
  if (v === null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}°C`;
}
function formatDate(iso: string): string {
  const [, month, day] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[(month ?? 1) - 1]} ${day}`;
}
function hasAnyData(d: OuraDayData): boolean {
  return d.readiness_score !== null || d.hrv_average !== null || d.sleep_score !== null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Tile({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded p-2 text-center" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
      <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: `${color}B0`, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: FF.mono, fontSize: '15px', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: `${color}80`, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="relative h-1 rounded-full overflow-hidden" style={{ background: `${color}20` }}>
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  );
}

function MetricRow({ label, value, barPct, color }: { label: string; value: string; barPct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-0.5">
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted }}>
          {label}
        </span>
        <span style={{ fontFamily: FF.mono, fontSize: `${FS.value}px`, fontWeight: 700, color }}>
          {value}
        </span>
      </div>
      <Bar pct={barPct} color={color} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function ReadinessArc({ score, color }: { score: number | null; color: string }) {
  const pct = score ?? 0;
  const r = 38;
  const cx = 52, cy = 52;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  return (
    <svg width="104" height="60" viewBox="0 0 104 60" style={{ overflow: 'visible' }}>
      <path d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`}
        fill="none" stroke="#1A1A2A" strokeWidth={8} strokeLinecap="round" />
      <path d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`}
        fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x={cx} y={cy - 4} textAnchor="middle"
        style={{ fontFamily: FF.mono, fontSize: '22px', fontWeight: 700, fill: color }}>
        {score !== null ? score : '—'}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle"
        style={{ fontFamily: FF.sans, fontSize: '10px', letterSpacing: '0.15em', fill: `${color}90`, textTransform: 'uppercase' }}>
        Readiness
      </text>
    </svg>
  );
}

function DayCard({ day }: { day: OuraDayData }) {
  const rdColor = readinessColor(day.readiness_score);
  const slColor = sleepColor(day.sleep_score);

  if (!hasAnyData(day)) {
    return (
      <div className="rounded-lg p-3 border border-border/50"
        style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.muted }}>
        No Oura data — {formatDate(day.date)}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden" style={{ background: '#0B0B14' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40"
        style={{ background: '#0D0D18' }}>
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>
          Oura · {formatDate(day.date)}
        </span>
        {day.activity_score !== null && (
          <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: activityColor(day.activity_score) }}>
            Activity {day.activity_score}
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* ── Readiness ── */}
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <ReadinessArc score={day.readiness_score} color={rdColor} />
          </div>
          <div className="flex-1 space-y-1.5 pt-1">
            {day.hrv_average !== null && (
              <MetricRow
                label="HRV"
                value={fmt(day.hrv_average, 0, 'ms')}
                barPct={(day.hrv_average / 120) * 100}
                color={hrvColor(day.hrv_average)}
              />
            )}
            {day.resting_hr !== null && (
              <MetricRow
                label="Resting HR"
                value={fmt(day.resting_hr, 0, 'bpm')}
                barPct={Math.max(0, 100 - ((day.resting_hr - 40) / 60 * 100))}
                color={hrColor(day.resting_hr)}
              />
            )}
            {day.temperature_deviation !== null && (
              <MetricRow
                label="Temp Deviation"
                value={fmtTempDelta(day.temperature_deviation)}
                barPct={Math.min(100, Math.abs(day.temperature_deviation) / 2 * 100)}
                color={tempColor(day.temperature_deviation)}
              />
            )}
          </div>
        </div>

        {/* ── Sleep ── */}
        {(day.sleep_score !== null || day.sleep_efficiency !== null ||
          day.rem_sleep_hours !== null || day.deep_sleep_hours !== null) && (
          <div>
            <SectionLabel>Sleep</SectionLabel>
            <div className="space-y-1 mb-2">
              {day.sleep_score !== null && (
                <MetricRow
                  label="Sleep Score"
                  value={fmt(day.sleep_score)}
                  barPct={day.sleep_score}
                  color={slColor}
                />
              )}
              {day.sleep_efficiency !== null && (
                <MetricRow
                  label="Efficiency"
                  value={fmt(day.sleep_efficiency, 0, '%')}
                  barPct={day.sleep_efficiency}
                  color={sleepColor(day.sleep_efficiency)}
                />
              )}
            </div>
            {(day.rem_sleep_hours !== null || day.deep_sleep_hours !== null) && (
              <div className="grid grid-cols-2 gap-1.5">
                {day.rem_sleep_hours !== null && (
                  <Tile label="REM Sleep" value={fmtHours(day.rem_sleep_hours)}
                    color={day.rem_sleep_hours >= 1.5 ? S.good : day.rem_sleep_hours >= 1.0 ? S.warn : S.bad}
                    sub="target ≥1.5h" />
                )}
                {day.deep_sleep_hours !== null && (
                  <Tile label="Deep Sleep" value={fmtHours(day.deep_sleep_hours)}
                    color={day.deep_sleep_hours >= 1.0 ? S.good : day.deep_sleep_hours >= 0.5 ? S.warn : S.bad}
                    sub="target ≥1h" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OuraPanel({ sessionDates }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OuraDayData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cacheAge, setCacheAge] = useState<string | null>(null);

  useEffect(() => {
    if (sessionDates.length === 0) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // Try live API first
      if (OURA_TOKEN) {
        try {
          const result = await fetchOuraDataForDates(sessionDates);
          if (!cancelled) { setData(result); setCacheAge(null); setLoading(false); }
          return;
        } catch { /* fall through to cache */ }
      }

      // Fall back to health cache
      try {
        const cache = await loadHealthCache();
        if (cancelled) return;
        if (cache?.oura) {
          const filtered = cache.oura.filter(d => sessionDates.includes(d.date));
          setData(filtered);
          setCacheAge(getCacheAge(cache.updatedAt));
        } else if (!OURA_TOKEN) {
          // No token, no cache — show setup message (handled below)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Oura data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sessionDates.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!OURA_TOKEN) {
    return (
      <div className="rounded-lg p-4 border border-border/50 text-center space-y-1">
        <p style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.muted }}>
          Add <code style={{ color: T.label }}>VITE_OURA_PERSONAL_TOKEN</code> to your{' '}
          <code style={{ color: T.label }}>.env</code> to enable Oura
        </p>
        <p style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.ghost }}>
          Generate a token at cloud.ouraring.com/personal-access-tokens
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2" style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.label }}>
        <span className="animate-spin">⟳</span>
        Loading Oura data…
      </div>
    );
  }

  if (error) {
    return (
      <p style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: S.bad }}>{error}</p>
    );
  }

  return (
    <div className="space-y-3">
      {cacheAge && (
        <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.ghost, letterSpacing: '0.1em' }}>
          Cached · {cacheAge}
        </div>
      )}
      {data.map(day => <DayCard key={day.date} day={day} />)}
    </div>
  );
}
