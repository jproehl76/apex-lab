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
  if (score === null) return '#94a3b8'; // slate-400
  if (score >= 67) return '#4ade80';   // green-400
  if (score >= 34) return '#facc15';   // yellow-400
  return '#f87171';                    // red-400
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
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors"
        >
          Connect WHOOP
        </button>
        <p className="text-xs text-slate-500">See your recovery &amp; HRV on race day</p>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="animate-spin">⟳</span>
        Loading WHOOP data…
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-400">{error}</p>
        <button onClick={handleDisconnect} className="text-xs text-slate-500 hover:text-red-400 transition-colors underline">
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
            className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 space-y-2"
          >
            <p className="text-xs font-semibold text-slate-300">
              WHOOP — {formatDate(day.date)}
            </p>

            {hasAnyData(day) ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono">
                <span>
                  Recovery:{' '}
                  <span style={{ color: recoveryColor(day.recovery_score) }} className="font-semibold">
                    {fmt(day.recovery_score, '%')}
                  </span>
                </span>
                <span className="text-slate-400">|</span>
                <span>
                  HRV:{' '}
                  <span className="text-slate-200 font-semibold">
                    {fmt(day.hrv_rmssd_ms, 'ms')}
                  </span>
                </span>
                <span className="text-slate-400">|</span>
                <span>
                  RHR:{' '}
                  <span className="text-slate-200 font-semibold">
                    {fmt(day.resting_hr, 'bpm')}
                  </span>
                </span>
                <span className="text-slate-400">|</span>
                <span>
                  Sleep:{' '}
                  <span className="text-slate-200 font-semibold">
                    {fmt(day.sleep_performance_pct, '%')}
                  </span>
                </span>
                <span className="text-slate-400">|</span>
                <span>
                  Strain:{' '}
                  <span className="text-slate-200 font-semibold">
                    {fmtDecimal(day.day_strain)}
                  </span>
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No WHOOP data found for this date.</p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleDisconnect}
        className="text-xs text-slate-500 hover:text-red-400 transition-colors underline"
      >
        Disconnect WHOOP
      </button>
    </div>
  );
}
