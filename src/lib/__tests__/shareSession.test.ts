import { describe, it, expect } from 'vitest';
import { encodeSession, decodeSession } from '@/lib/shareSession';
import type { LoadedSession, SessionSummary } from '@/types/session';

// ─── Minimal mock helpers ─────────────────────────────────────────────────────

function makeMinimalSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    header: {
      track: 'Laguna Seca',
      date: '2024-06-15',
      session_type: 'track',
      export_format: 'racechrono-csv-v9',
      channels_found: ['ts', 'lap', 'spd'],
      channels_missing: [],
      total_laps: 3,
      analyzed_laps: 2,
      excluded_laps: [{ lap: 1, reason: 'out lap' }],
      total_rows: 300,
      duration_minutes: 12,
      sample_rate_hz: 25,
    },
    laps: [
      {
        lap_num: 1,
        lap_time_s: 95.1,
        sector_times: [],
        max_speed_kph: 180,
        avg_speed_kph: 120,
        coast_time_s: 5,
        total_g_mean: 0.4,
        total_g_p95: 0.9,
        steering_reversals: 12,
        peak_lat_g: 1.2,
        peak_long_g_brake: 0.8,
        is_outlier: true,
        outlier_reason: 'out lap',
      },
      {
        lap_num: 2,
        lap_time_s: 82.456,
        sector_times: [],
        max_speed_kph: 195,
        avg_speed_kph: 130,
        coast_time_s: 4,
        total_g_mean: 0.5,
        total_g_p95: 1.1,
        steering_reversals: 10,
        peak_lat_g: 1.3,
        peak_long_g_brake: 0.9,
        is_outlier: false,
        outlier_reason: '',
      },
      {
        lap_num: 3,
        lap_time_s: 83.012,
        sector_times: [],
        max_speed_kph: 193,
        avg_speed_kph: 129,
        coast_time_s: 4.2,
        total_g_mean: 0.48,
        total_g_p95: 1.05,
        steering_reversals: 11,
        peak_lat_g: 1.25,
        peak_long_g_brake: 0.85,
        is_outlier: false,
        outlier_reason: '',
      },
    ],
    consistency: {
      lap_count: 2,
      best_lap_s: 82.456,
      worst_lap_s: 83.012,
      mean_lap_s: 82.734,
      median_lap_s: 82.734,
      spread_s: 0.556,
      std_dev_s: 0.278,
      consistency_score: 99.6,
      corners: {
        t1: {
          name: 'T1',
          min_speed_best: 60,
          min_speed_avg: 58,
          min_speed_std: 1.5,
          min_speed_delta: 2,
          brake_point_std_m: 3.2,
          coast_time_avg: 0.8,
          total_g_avg: 0.85,
        },
      },
    },
    best_lap_corners: [
      {
        corner_id: 't1',
        corner_name: 'T1',
        entry_speed_kph: 120,
        min_speed_kph: 60,
        exit_speed_kph: 90,
        peak_lat_g: 1.2,
        brake_point_m: 40,
        trail_brake_duration_s: 0.3,
        coast_time_s: 0.5,
        throttle_on_m: 10,
        total_g_mean: 0.9,
        gear_at_apex: 3,
      },
    ],
    thermals: [],
    friction_circle: {
      total_g_mean: 0.5,
      total_g_p95: 1.1,
      total_g_max: 1.4,
      peak_lat_g: 1.3,
      peak_long_g_brake: 0.9,
      peak_long_g_accel: 0.7,
      time_above_08g_pct: 20,
      time_above_10g_pct: 5,
    },
    ...overrides,
  };
}

function makeLoadedSession(overrides: Partial<SessionSummary> = {}): LoadedSession {
  return {
    id: 'laguna-seca__2024-06-15',
    filename: 'laguna_seca_2024.csv',
    color: '#2563EB',
    data: makeMinimalSession(overrides),
  };
}

// ─── encodeSession ────────────────────────────────────────────────────────────

describe('encodeSession', () => {
  it('returns a non-empty string', () => {
    const encoded = encodeSession(makeLoadedSession());
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('does not contain base64 padding characters', () => {
    const encoded = encodeSession(makeLoadedSession());
    expect(encoded).not.toContain('=');
  });

  it('uses URL-safe characters only (no + or /)', () => {
    const encoded = encodeSession(makeLoadedSession());
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
  });
});

// ─── decodeSession ────────────────────────────────────────────────────────────

describe('decodeSession', () => {
  it('returns null for an empty string', () => {
    expect(decodeSession('')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(decodeSession('not-valid-base64!!!')).toBeNull();
  });

  it('returns null for valid base64 that is not a ShareSummary', () => {
    const junk = btoa(encodeURIComponent(JSON.stringify({ foo: 'bar' })));
    expect(decodeSession(junk)).toBeNull();
  });
});

// ─── roundtrip ───────────────────────────────────────────────────────────────

describe('encodeSession / decodeSession roundtrip', () => {
  it('recovers the same track and date', () => {
    const session = makeLoadedSession();
    const encoded = encodeSession(session);
    const decoded = decodeSession(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.track).toBe('Laguna Seca');
    expect(decoded!.date).toBe('2024-06-15');
  });

  it('recovers version = 1', () => {
    const decoded = decodeSession(encodeSession(makeLoadedSession()));
    expect(decoded!.v).toBe(1);
  });

  it('recovers the best lap time', () => {
    const session = makeLoadedSession();
    const decoded = decodeSession(encodeSession(session));
    expect(decoded!.bestLap).toBeCloseTo(82.456, 2);
  });

  it('recovers only the non-outlier laps', () => {
    const decoded = decodeSession(encodeSession(makeLoadedSession()));
    // Session has 3 laps, 1 outlier -> 2 clean laps in payload
    expect(decoded!.laps).toHaveLength(2);
    expect(decoded!.laps[0][0]).toBe(2);
    expect(decoded!.laps[1][0]).toBe(3);
  });

  it('recovers corner speeds (up to 5)', () => {
    const decoded = decodeSession(encodeSession(makeLoadedSession()));
    expect(decoded!.corners).toHaveLength(1);
    expect(decoded!.corners[0][0]).toBe('T1');
    expect(decoded!.corners[0][1]).toBe(60);
  });

  it('recovers coaching bullets derived from consistency.corners', () => {
    const decoded = decodeSession(encodeSession(makeLoadedSession()));
    expect(Array.isArray(decoded!.coaching)).toBe(true);
    // T1 has std dev 1.5, so it should appear in the bullet
    expect(decoded!.coaching[0]).toContain('T1');
  });

  it('is stable across multiple encodes of the same session', () => {
    const session = makeLoadedSession();
    expect(encodeSession(session)).toBe(encodeSession(session));
  });
});
