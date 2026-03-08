import type { LoadedSession } from '@/types/session';
import { formatLapTime } from '@/lib/utils';

/**
 * Compact share payload — just what a coach needs to see.
 * Encodes to ~400–800 bytes, well within URL limits.
 */
export interface ShareSummary {
  v: 1;
  track: string;
  date: string;
  bestLap: number;         // seconds
  laps: [number, number][]; // [lap_num, time_s] for clean laps only
  coaching: string[];       // top 3 insight labels + details
  corners: [string, number][]; // [corner_name, min_speed_kph] top 5 corners
}

/** Build a ShareSummary from a LoadedSession */
function buildSummary(session: LoadedSession): ShareSummary {
  const { header, laps, consistency, best_lap_corners } = session.data;

  const cleanLaps = laps
    .filter(l => !l.is_outlier)
    .sort((a, b) => a.lap_num - b.lap_num)
    .map(l => [l.lap_num, l.lap_time_s] as [number, number]);

  // Top coaching bullets: worst consistency corners
  const coachingBullets: string[] = [];
  const cornersByStd = Object.entries(consistency.corners)
    .sort((a, b) => b[1].min_speed_std - a[1].min_speed_std)
    .slice(0, 3);
  for (const [, c] of cornersByStd) {
    coachingBullets.push(
      `${c.name}: ${c.min_speed_std.toFixed(1)} km/h std dev`
    );
  }

  // Top 5 corners by apex speed
  const cornerSpeeds = (best_lap_corners ?? [])
    .slice(0, 5)
    .map(c => [c.corner_name, c.min_speed_kph] as [string, number]);

  return {
    v: 1,
    track: header.track,
    date: header.date,
    bestLap: consistency.best_lap_s,
    laps: cleanLaps,
    coaching: coachingBullets,
    corners: cornerSpeeds,
  };
}

/** Encode a session to a URL-safe base64 string */
export function encodeSession(session: LoadedSession): string {
  const summary = buildSummary(session);
  return btoa(encodeURIComponent(JSON.stringify(summary)));
}

/** Decode a share hash back to ShareSummary. Returns null on any error. */
export function decodeSession(encoded: string): ShareSummary | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const parsed = JSON.parse(json) as ShareSummary;
    if (parsed.v !== 1 || !parsed.track || !parsed.date) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Format the shareable URL for the current page */
export function buildShareUrl(session: LoadedSession): string {
  const encoded = encodeSession(session);
  const base = `${window.location.origin}/apex-lab/`;
  return `${base}#share=${encoded}`;
}

/** Format a lap time seconds value as m:ss.xxx */
export { formatLapTime };
