import { useEffect, useState } from 'react';
import {
  initiateWhoopAuth,
  isWhoopConnected,
  disconnectWhoop,
  getWhoopToken,
} from '@/lib/services/whoopAuth';
import { fetchWhoopDataForDates, type WhoopDayData } from '@/lib/services/whoopApi';
import { FF, FS, T, S } from '@/lib/chartTheme';

const CLIENT_ID = import.meta.env.VITE_WHOOP_CLIENT_ID as string | undefined;

interface Props {
  sessionDates: string[];
  connectedOverride?: boolean;
}

// ── Color helpers ──────────────────────────────────────────────────────────────
function recoveryColor(score: number | null): string {
  if (score === null) return T.muted;
  if (score >= 67) return S.good;
  if (score >= 34) return S.warn;
  return S.bad;
}
function sleepColor(pct: number | null): string {
  if (pct === null) return T.muted;
  if (pct >= 85) return S.good;
  if (pct >= 70) return S.warn;
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
function respColor(rate: number | null): string {
  if (rate === null) return T.muted;
  if (rate >= 12 && rate <= 16) return S.good;
  if (rate <= 18) return S.warn;
  return S.bad;
}
function strainColor(strain: number | null): string {
  if (strain === null) return T.muted;
  if (strain < 10) return S.good;
  if (strain < 14) return S.warn;
  if (strain < 18) return '#F97316';
  return S.bad;
}
function tempColor(delta: number | null): string {
  if (delta === null) return T.muted;
  const abs = Math.abs(delta);
  if (abs <= 0.3) return S.good;
  if (abs <= 0.6) return S.warn;
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
function hasAnyData(d: WhoopDayData): boolean {
  return d.recovery_score !== null || d.hrv_rmssd_ms !== null || d.resting_hr !== null
    || d.sleep_performance_pct !== null || d.day_strain !== null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** A single metric tile */
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

/** Horizontal fill bar */
function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="relative h-1 rounded-full overflow-hidden" style={{ background: `${color}20` }}>
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  );
}

/** Metric row: label + value bar */
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

/** Section label */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted, marginBottom: 6 }}>
      {children}
    </div>
  );
}

/** Recovery score gauge arc (SVG half-circle) */
function RecoveryArc({ score, color }: { score: number | null; color: string }) {
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
        Recovery
      </text>
    </svg>
  );
}

/** A single day driver card */
function DriverCard({ day }: { day: WhoopDayData }) {
  const recColor = recoveryColor(day.recovery_score);
  const slColor  = sleepColor(day.sleep_performance_pct);

  if (!hasAnyData(day)) {
    return (
      <div className="rounded-lg p-3 border border-border/50"
        style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.muted }}>
        No WHOOP data — {formatDate(day.date)}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden" style={{ background: '#0B0B14' }}>

      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40"
        style={{ background: '#0D0D18' }}>
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>
          WHOOP · {formatDate(day.date)}
        </span>
        {day.day_strain !== null && (
          <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: strainColor(day.day_strain) }}>
            Strain {fmt(day.day_strain, 1)}
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">

        {/* ── Readiness ── */}
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <RecoveryArc score={day.recovery_score} color={recColor} />
          </div>
          <div className="flex-1 space-y-1.5 pt-1">
            <MetricRow
              label="HRV"
              value={fmt(day.hrv_rmssd_ms, 0, 'ms')}
              barPct={(day.hrv_rmssd_ms ?? 0) / 120 * 100}
              color={hrvColor(day.hrv_rmssd_ms)}
            />
            <MetricRow
              label="Resting HR"
              value={fmt(day.resting_hr, 0, 'bpm')}
              barPct={day.resting_hr !== null ? Math.max(0, 100 - ((day.resting_hr - 40) / 60 * 100)) : 0}
              color={hrColor(day.resting_hr)}
            />
            {day.respiratory_rate !== null && (
              <MetricRow
                label="Resp Rate"
                value={fmt(day.respiratory_rate, 1, '/min')}
                barPct={(day.respiratory_rate / 25) * 100}
                color={respColor(day.respiratory_rate)}
              />
            )}
          </div>
        </div>

        {/* ── Sleep ── */}
        <div>
          <SectionLabel>Sleep</SectionLabel>
          <div className="space-y-1 mb-2">
            {day.sleep_performance_pct !== null && (
              <MetricRow
                label="Performance"
                value={fmt(day.sleep_performance_pct, 0, '%')}
                barPct={day.sleep_performance_pct}
                color={slColor}
              />
            )}
            {day.sleep_consistency_pct !== null && (
              <MetricRow
                label="Consistency"
                value={fmt(day.sleep_consistency_pct, 0, '%')}
                barPct={day.sleep_consistency_pct}
                color={sleepColor(day.sleep_consistency_pct)}
              />
            )}
          </div>
          {(day.rem_sleep_hours !== null || day.swe_sleep_hours !== null) && (
            <div className="grid grid-cols-2 gap-1.5">
              {day.rem_sleep_hours !== null && (
                <Tile label="REM Sleep" value={fmtHours(day.rem_sleep_hours)}
                  color={day.rem_sleep_hours >= 1.5 ? S.good : day.rem_sleep_hours >= 1.0 ? S.warn : S.bad}
                  sub="target ≥1.5h" />
              )}
              {day.swe_sleep_hours !== null && (
                <Tile label="Deep Sleep" value={fmtHours(day.swe_sleep_hours)}
                  color={day.swe_sleep_hours >= 1.0 ? S.good : day.swe_sleep_hours >= 0.5 ? S.warn : S.bad}
                  sub="target ≥1h" />
              )}
            </div>
          )}
        </div>

        {/* ── Autonomic markers ── */}
        {(day.spo2_pct !== null || day.skin_temp_celsius !== null || day.max_hr !== null) && (
          <div>
            <SectionLabel>Markers</SectionLabel>
            <div className={`grid gap-1.5 ${[day.spo2_pct, day.skin_temp_celsius, day.max_hr].filter(v => v !== null).length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {day.spo2_pct !== null && (
                <Tile label="SpO₂" value={fmt(day.spo2_pct, 1, '%')}
                  color={day.spo2_pct >= 98 ? S.good : day.spo2_pct >= 95 ? S.warn : S.bad} />
              )}
              {day.skin_temp_celsius !== null && (
                <Tile label="Skin Temp" value={fmtTempDelta(day.skin_temp_celsius)}
                  color={tempColor(day.skin_temp_celsius)} sub="vs baseline" />
              )}
              {day.max_hr !== null && (
                <Tile label="Max HR" value={fmt(day.max_hr, 0, 'bpm')} color={T.label} />
              )}
            </div>
          </div>
        )}

        {/* ── Strain load ── */}
        {day.day_strain !== null && (
          <div>
            <SectionLabel>Load</SectionLabel>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted }}>
                    Day Strain
                  </span>
                  <span style={{ fontFamily: FF.mono, fontSize: `${FS.value}px`, fontWeight: 700, color: strainColor(day.day_strain) }}>
                    {fmt(day.day_strain, 1)}{' '}
                    <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, color: T.muted }}>/ 21</span>
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: '#1A1A2A' }}>
                  <div className="absolute inset-0 flex">
                    <div style={{ width: '47.6%', background: `${S.good}30` }} />
                    <div style={{ width: '19%',   background: `${S.warn}30` }} />
                    <div style={{ width: '19%',   background: '#F9731630' }} />
                    <div style={{ width: '14.4%', background: `${S.bad}30` }} />
                  </div>
                  <div className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(day.day_strain / 21) * 100}%`, background: strainColor(day.day_strain) }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  {['Easy', 'Mod', 'Hard', 'Max'].map(z => (
                    <span key={z} style={{ fontFamily: FF.sans, fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase', color: T.muted }}>
                      {z}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function WhoopPanel({ sessionDates, connectedOverride }: Props) {
  const [connected, setConnected] = useState<boolean>(() => isWhoopConnected());
  const [loading, setLoading]     = useState<boolean>(false);
  const [data, setData]           = useState<WhoopDayData[]>([]);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (connectedOverride) setConnected(true);
  }, [connectedOverride]);

  useEffect(() => {
    if (!CLIENT_ID || !connected || sessionDates.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const token = await getWhoopToken();
        if (!token) {
          if (!cancelled) { setError('WHOOP session expired. Please reconnect.'); setConnected(false); }
          return;
        }
        const result = await fetchWhoopDataForDates(sessionDates, token);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load WHOOP data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [connected, sessionDates.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDisconnect() {
    disconnectWhoop();
    setConnected(false);
    setData([]);
    setError(null);
  }

  if (!CLIENT_ID) return null;

  if (!connected) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={initiateWhoopAuth} className="px-3 py-1.5 rounded-lg transition-colors"
          style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, fontWeight: 600, letterSpacing: '0.05em',
            background: `${S.good}18`, border: `1px solid ${S.good}40`, color: S.good }}>
          Connect WHOOP
        </button>
        <p style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.muted }}>
          See your biometrics on race day
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2" style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.label }}>
        <span className="animate-spin">⟳</span>
        Loading WHOOP data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: S.bad }}>{error}</p>
        <button onClick={handleDisconnect} className="underline transition-colors"
          style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.muted }}
          onMouseEnter={e => (e.currentTarget.style.color = S.bad)}
          onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map(day => <DriverCard key={day.date} day={day} />)}
      <button onClick={handleDisconnect} className="underline transition-colors"
        style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.muted }}
        onMouseEnter={e => (e.currentTarget.style.color = S.bad)}
        onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
        Disconnect WHOOP
      </button>
    </div>
  );
}
