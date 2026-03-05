import { useEffect, useState } from 'react';
import {
  initiateWhoopAuth,
  isWhoopConnected,
  disconnectWhoop,
  getWhoopToken,
} from '@/lib/services/whoopAuth';
import { fetchWhoopDataForDates, type WhoopDayData } from '@/lib/services/whoopApi';

// Guard: hide the panel entirely when credentials are not configured
const CLIENT_ID = import.meta.env.VITE_WHOOP_CLIENT_ID as string | undefined;

interface Props {
  sessionDates: string[]; // ISO date strings from active sessions
  connectedOverride?: boolean; // set to true by App after successful OAuth callback
}

function recoveryColor(score: number | null): string {
  if (score === null) return '#9898A8';
  if (score >= 67) return '#22C55E';
  if (score >= 34) return '#F59E0B';
  return '#EF4444';
}

function fmt(value: number | null, suffix: string): string {
  if (value === null) return '—';
  return `${Math.round(value)}${suffix}`;
}

function fmtDecimal(value: number | null, digits = 1): string {
  if (value === null) return '—';
  return value.toFixed(digits);
}

// Format a date string like "2025-05-02" → "May 2"
function formatDate(iso: string): string {
  const [, month, day] = iso.split('-').map(Number);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[(month ?? 1) - 1]} ${day}`;
}

function hasAnyData(d: WhoopDayData): boolean {
  return (
    d.recovery_score !== null ||
    d.hrv_rmssd_ms !== null ||
    d.resting_hr !== null ||
    d.sleep_performance_pct !== null ||
    d.day_strain !== null
  );
}

export function WhoopPanel({ sessionDates, connectedOverride }: Props) {
  // Feature gate: no credentials → don't render
  if (!CLIENT_ID) return null;

  const [connected, setConnected] = useState<boolean>(() => isWhoopConnected());

  // When App signals a successful OAuth callback, flip connected on
  useEffect(() => {
    if (connectedOverride) setConnected(true);
  }, [connectedOverride]);
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<WhoopDayData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || sessionDates.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const token = await getWhoopToken();
        if (!token) {
          if (!cancelled) {
            setError('WHOOP session expired. Please reconnect.');
            setConnected(false);
          }
          return;
        }
        const result = await fetchWhoopDataForDates(sessionDates, token);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load WHOOP data');
        }
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

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={initiateWhoopAuth}
          className="px-3 py-1.5 rounded-lg transition-colors"
          style={{
            fontFamily: 'Barlow Condensed',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.4)',
            color: '#22C55E',
          }}
        >
          Connect WHOOP
        </button>
        <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', color: '#606070' }}>
          See your recovery &amp; HRV on race day
        </p>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2" style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', color: '#9898A8' }}>
        <span className="animate-spin">⟳</span>
        Loading WHOOP data…
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-2">
        <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', color: '#EF4444' }}>{error}</p>
        <button
          onClick={handleDisconnect}
          className="underline transition-colors"
          style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', color: '#606070' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#606070')}
        >
          Disconnect
        </button>
      </div>
    );
  }

  // ── Connected with data ────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3">
        {data.map((day) => (
          <div
            key={day.date}
            className="card p-3 space-y-2"
          >
            <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', fontWeight: 600, color: '#9898A8' }}>
              WHOOP — {formatDate(day.date)}
            </p>

            {hasAnyData(day) ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <WhoopStat label="Recovery" value={fmt(day.recovery_score, '%')} valueColor={recoveryColor(day.recovery_score)} />
                <WhoopStat label="HRV" value={fmt(day.hrv_rmssd_ms, 'ms')} />
                <WhoopStat label="RHR" value={fmt(day.resting_hr, 'bpm')} />
                <WhoopStat label="Sleep" value={fmt(day.sleep_performance_pct, '%')} />
                <WhoopStat label="Strain" value={fmtDecimal(day.day_strain)} />
              </div>
            ) : (
              <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', color: '#606070' }}>No WHOOP data found for this date.</p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleDisconnect}
        className="underline transition-colors"
        style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', color: '#606070' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
        onMouseLeave={e => (e.currentTarget.style.color = '#606070')}
      >
        Disconnect WHOOP
      </button>
    </div>
  );
}

interface WhoopStatProps {
  label: string;
  value: string;
  valueColor?: string;
}

function WhoopStat({ label, value, valueColor }: WhoopStatProps) {
  return (
    <span>
      <span style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', color: '#606070' }}>{label}: </span>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: 600, color: valueColor ?? '#E8E8F0' }}>
        {value}
      </span>
    </span>
  );
}
