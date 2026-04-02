import { useEffect, useState } from 'react';
import {
  initiateStravaAuth,
  isStravaConnected,
  disconnectStrava,
  getStravaToken,
} from '@/lib/services/stravaAuth';
import { fetchStravaActivities, type StravaActivity } from '@/lib/services/stravaApi';
import { FF, FS, T, S } from '@/lib/chartTheme';

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined;

interface Props {
  sessionDates: string[];
  connectedOverride?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sportEmoji(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('run')) return '🏃';
  if (t.includes('ride') || t.includes('cycling') || t.includes('virtual')) return '🚴';
  if (t.includes('swim')) return '🏊';
  if (t.includes('hike') || t.includes('walk')) return '🚶';
  if (t.includes('ski')) return '⛷️';
  if (t.includes('weight') || t.includes('strength') || t.includes('crossfit')) return '🏋️';
  if (t.includes('yoga') || t.includes('pilates')) return '🧘';
  return '⚡';
}

function fmtDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(meters)} m`;
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(isoString: string): string {
  const [datePart] = isoString.split('T');
  const [, month, day] = (datePart ?? isoString).split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[(month ?? 1) - 1]} ${day}`;
}

function dateToUnix(dateStr: string, endOfDay = false): number {
  const d = new Date(dateStr);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return Math.floor(d.getTime() / 1000);
}

function expandDate(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Activity card ──────────────────────────────────────────────────────────────

function ActivityCard({ activity }: { activity: StravaActivity }) {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden" style={{ background: '#0B0B14' }}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40" style={{ background: '#0D0D18' }}>
        <span style={{ fontSize: 16 }}>{sportEmoji(activity.type)}</span>
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, fontWeight: 600, color: T.fg, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activity.name}
        </span>
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, flexShrink: 0 }}>
          {fmtDate(activity.start_date)}
        </span>
      </div>

      <div className="p-3">
        {/* Primary stats row */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="text-center">
            <div style={{ fontFamily: FF.mono, fontSize: '15px', fontWeight: 700, color: S.info }}>{fmtDistance(activity.distance)}</div>
            <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted }}>Distance</div>
          </div>
          <div className="text-center">
            <div style={{ fontFamily: FF.mono, fontSize: '15px', fontWeight: 700, color: T.fg }}>{fmtDuration(activity.moving_time)}</div>
            <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted }}>Duration</div>
          </div>
          <div className="text-center">
            <div style={{ fontFamily: FF.mono, fontSize: '15px', fontWeight: 700, color: T.fg }}>
              {activity.total_elevation_gain > 0 ? `+${Math.round(activity.total_elevation_gain)}m` : '—'}
            </div>
            <div style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted }}>Elevation</div>
          </div>
        </div>

        {/* HR + suffer row */}
        {(activity.average_heartrate !== null || activity.suffer_score !== null) && (
          <div className="flex gap-4">
            {activity.average_heartrate !== null && (
              <div>
                <span style={{ fontFamily: FF.mono, fontSize: `${FS.value}px`, fontWeight: 700, color: S.bad }}>
                  {Math.round(activity.average_heartrate)}
                </span>
                {activity.max_heartrate !== null && (
                  <span style={{ fontFamily: FF.mono, fontSize: `${FS.nano}px`, color: T.muted }}>
                    /{Math.round(activity.max_heartrate)}
                  </span>
                )}
                <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginLeft: 4 }}>bpm</span>
              </div>
            )}
            {activity.suffer_score !== null && (
              <div>
                <span style={{ fontFamily: FF.mono, fontSize: `${FS.value}px`, fontWeight: 700, color: S.warn }}>
                  {activity.suffer_score}
                </span>
                <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginLeft: 4 }}>suffer</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Aggregate row ──────────────────────────────────────────────────────────────

function AggregateRow({ activities }: { activities: StravaActivity[] }) {
  if (activities.length === 0) return null;
  const totalDist = activities.reduce((s, a) => s + a.distance, 0);
  const totalTime = activities.reduce((s, a) => s + a.moving_time, 0);
  const totalElev = activities.reduce((s, a) => s + a.total_elevation_gain, 0);

  return (
    <div className="rounded-lg px-4 py-2.5 border border-border/40 flex items-center gap-6 flex-wrap"
      style={{ background: '#0D0D18' }}>
      <div>
        <span style={{ fontFamily: FF.mono, fontSize: '14px', fontWeight: 700, color: S.info }}>{activities.length}</span>
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginLeft: 4 }}>activities</span>
      </div>
      <div>
        <span style={{ fontFamily: FF.mono, fontSize: '14px', fontWeight: 700, color: S.info }}>{fmtDistance(totalDist)}</span>
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginLeft: 4 }}>total</span>
      </div>
      <div>
        <span style={{ fontFamily: FF.mono, fontSize: '14px', fontWeight: 700, color: T.fg }}>{fmtDuration(totalTime)}</span>
        <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginLeft: 4 }}>time</span>
      </div>
      {totalElev > 0 && (
        <div>
          <span style={{ fontFamily: FF.mono, fontSize: '14px', fontWeight: 700, color: T.fg }}>+{Math.round(totalElev)}m</span>
          <span style={{ fontFamily: FF.sans, fontSize: `${FS.nano}px`, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted, marginLeft: 4 }}>elev</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function StravaPanel({ sessionDates, connectedOverride }: Props) {
  const [connected, setConnected] = useState<boolean>(() => isStravaConnected());
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connectedOverride) setConnected(true);
  }, [connectedOverride]);

  useEffect(() => {
    if (!STRAVA_CLIENT_ID || !connected || sessionDates.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const token = await getStravaToken();
        if (!token) {
          if (!cancelled) { setError('Strava session expired. Please reconnect.'); setConnected(false); }
          return;
        }
        const sorted = [...sessionDates].sort();
        const afterDate = expandDate(sorted[0], -3);
        const beforeDate = expandDate(sorted[sorted.length - 1], 1);
        const afterUnix = dateToUnix(afterDate);
        const beforeUnix = dateToUnix(beforeDate, true);
        const result = await fetchStravaActivities(token, afterUnix, beforeUnix);
        if (!cancelled) setActivities(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Strava data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [connected, sessionDates.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDisconnect() {
    disconnectStrava();
    setConnected(false);
    setActivities([]);
    setError(null);
  }

  if (!STRAVA_CLIENT_ID) return null;

  if (!connected) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={initiateStravaAuth} className="px-3 py-1.5 rounded-lg transition-colors"
          style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, fontWeight: 600, letterSpacing: '0.05em',
            background: '#FC4C0218', border: '1px solid #FC4C0240', color: '#FC4C02' }}>
          Connect Strava
        </button>
        <p style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.muted }}>
          See your training load around race days
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2" style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.label }}>
        <span className="animate-spin">⟳</span>
        Loading Strava activities…
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
      {activities.length > 0 && <AggregateRow activities={activities} />}
      {activities.length === 0 && (
        <p style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.muted }}>
          No Strava activities found in the ±3 day window around your session dates.
        </p>
      )}
      {activities.map(a => <ActivityCard key={a.id} activity={a} />)}
      <button onClick={handleDisconnect} className="underline transition-colors"
        style={{ fontFamily: FF.sans, fontSize: `${FS.base}px`, color: T.muted }}
        onMouseEnter={e => (e.currentTarget.style.color = S.bad)}
        onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
        Disconnect Strava
      </button>
    </div>
  );
}
