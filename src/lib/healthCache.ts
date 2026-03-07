export interface OuraDayData {
  date: string;
  readiness_score: number | null;
  hrv_average: number | null;
  resting_hr: number | null;
  temperature_deviation: number | null;
  sleep_score: number | null;
  sleep_efficiency: number | null;
  deep_sleep_hours: number | null;
  rem_sleep_hours: number | null;
  activity_score: number | null;
}

export interface WhoopDayData {
  date: string;
  recovery_score: number | null;
  hrv_rmssd_milli: number | null;
  resting_heart_rate: number | null;
  sleep_performance_percentage: number | null;
}

export interface HealthCache {
  updatedAt: string;
  oura: OuraDayData[] | null;
  whoop: WhoopDayData[] | null;
}

let _cache: HealthCache | null | 'failed' = null;

export async function loadHealthCache(): Promise<HealthCache | null> {
  if (_cache === 'failed') return null;
  if (_cache) return _cache;

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/health-cache.json`);
    if (!res.ok) { _cache = 'failed'; return null; }
    _cache = await res.json() as HealthCache;
    return _cache;
  } catch {
    _cache = 'failed';
    return null;
  }
}

export function getCacheAge(updatedAt: string): string {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}
