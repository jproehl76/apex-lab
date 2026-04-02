import { describe, it, expect } from 'vitest';
import { parseRacechronoCsv } from '@/lib/parseRacechronoCsv';

/**
 * Build a minimal valid RaceChrono v9 tab-separated CSV string.
 *
 * Structure:
 *   Line 0  (index 0): "RaceChrono..." identifier
 *   Lines 1-8 (index 1-8): metadata key/value pairs
 *   Line 9  (index 9): column headers
 *   Line 10 (index 10): units row (skipped by parser)
 *   Lines 11+ (index 11+): data rows
 */
function buildMinimalCsv({
  track = 'Laguna Seca',
  date = '2024-06-15 10:00:00',
  rows = [] as string[],
} = {}) {
  const tab = '\t';
  const lines: string[] = [
    // Line 0: identifier (must contain "RaceChrono")
    `RaceChrono v9 export`,
    // Lines 1-8: metadata
    `Track name${tab}${track}`,
    `Created${tab}${date}`,
    '',
    '',
    '',
    '',
    '',
    '',
    // Line 9: column headers — must have > 5 tab-separated fields
    [
      'Timestamp (s)',
      'Lap',
      'Latitude (deg)',
      'Longitude (deg)',
      'Speed (kph)',
      'Lateral acceleration (G)',
      'Longitudinal acceleration (G)',
      'Throttle position (%)',
      'Brake (bar)',
      'Engine RPM',
      'Gear',
      'Steering angle (deg)',
    ].join(tab),
    // Line 10: units row (parser reads past it)
    ['s', '#', 'deg', 'deg', 'kph', 'G', 'G', '%', 'bar', 'rpm', '', 'deg'].join(tab),
    // Lines 11+: data rows
    ...rows,
  ];
  return lines.join('\n');
}

function makeLapRowStrings(lapNum: number, startTs: number, count = 50, dt = 0.04): string[] {
  const tab = '\t';
  const rows: string[] = [];
  for (let i = 0; i < count; i++) {
    const ts = (startTs + i * dt).toFixed(3);
    rows.push(
      [ts, String(lapNum), '36.5748', '-121.7517', '120', '0.1', '-0.05', '80', '0', '4500', '3', '2'].join(tab),
    );
  }
  return rows;
}

// ─── Validation errors ───────────────────────────────────────────────────────

describe('parseRacechronoCsv — validation', () => {
  it('throws when first line does not contain "RaceChrono"', () => {
    expect(() => parseRacechronoCsv('not a racechrono file\n')).toThrow(
      /RaceChrono/i,
    );
  });

  it('throws when there are no valid data rows', () => {
    const csv = buildMinimalCsv({ rows: [] });
    expect(() => parseRacechronoCsv(csv)).toThrow(/no valid data rows/i);
  });

  it('skips rows where lap < 1', () => {
    // lap = 0 rows should all be skipped -> throws no valid data
    const tab = '\t';
    const badRow = ['1.000', '0', '36.5', '-121.7', '100', '0', '0', '0', '0', '3000', '2', '0'].join(tab);
    const csv = buildMinimalCsv({ rows: [badRow] });
    expect(() => parseRacechronoCsv(csv)).toThrow(/no valid data rows/i);
  });
});

// ─── Successful parse ────────────────────────────────────────────────────────

describe('parseRacechronoCsv — successful parse', () => {
  // Build a 3-lap CSV: lap 1 (out lap), laps 2 and 3 (clean), lap 4 (cool-down)
  // Each lap: 100 rows at dt=0.04 s = 4 seconds of data
  // Lap 2 and 3 should be roughly equal -> both non-outliers
  // Lap 1 and 4 will be outliers (significantly longer due to out/cool-down detection)
  function buildMultiLapCsv() {
    const tab = '\t';
    const rows: string[] = [];

    function addLap(lapNum: number, startTs: number, count: number, speedKph: number, latG: number) {
      for (let i = 0; i < count; i++) {
        const ts = (startTs + i * 0.04).toFixed(3);
        rows.push(
          [ts, String(lapNum), '36.5748', '-121.7517', String(speedKph), String(latG), '-0.05', '80', '0', '4500', '3', '2'].join(tab),
        );
      }
    }

    // Out lap: 200 rows (8 s) — much longer than clean laps
    addLap(1, 0, 200, 80, 0.1);
    // Clean lap 2: 100 rows (4 s)
    addLap(2, 200 * 0.04, 100, 120, 0.3);
    // Clean lap 3: 100 rows (4 s)
    addLap(3, 200 * 0.04 + 100 * 0.04, 100, 120, 0.3);
    // Cool-down lap 4: 200 rows (8 s)
    addLap(4, 200 * 0.04 + 200 * 0.04, 200, 60, 0.05);

    return buildMinimalCsv({ rows });
  }

  it('returns a SessionSummary with the correct track name', () => {
    const result = parseRacechronoCsv(buildMultiLapCsv());
    expect(result.header.track).toBe('Laguna Seca');
  });

  it('parses the date from metadata', () => {
    const result = parseRacechronoCsv(buildMultiLapCsv());
    expect(result.header.date).toBe('2024-06-15');
  });

  it('reports total_laps equal to distinct lap numbers in data', () => {
    const result = parseRacechronoCsv(buildMultiLapCsv());
    expect(result.header.total_laps).toBe(4);
  });

  it('populates the laps array with one entry per lap number', () => {
    const result = parseRacechronoCsv(buildMultiLapCsv());
    expect(result.laps).toHaveLength(4);
  });

  it('marks the out lap and cool-down lap as outliers', () => {
    const result = parseRacechronoCsv(buildMultiLapCsv());
    const lap1 = result.laps.find(l => l.lap_num === 1)!;
    const lap4 = result.laps.find(l => l.lap_num === 4)!;
    expect(lap1.is_outlier).toBe(true);
    expect(lap4.is_outlier).toBe(true);
  });

  it('marks the middle laps as non-outliers', () => {
    const result = parseRacechronoCsv(buildMultiLapCsv());
    const lap2 = result.laps.find(l => l.lap_num === 2)!;
    const lap3 = result.laps.find(l => l.lap_num === 3)!;
    expect(lap2.is_outlier).toBe(false);
    expect(lap3.is_outlier).toBe(false);
  });

  it('provides a consistency object with non-negative best_lap_s', () => {
    const result = parseRacechronoCsv(buildMultiLapCsv());
    expect(result.consistency).toBeDefined();
    expect(result.consistency.best_lap_s).toBeGreaterThan(0);
  });

  it('reports analyzed_laps equal to the number of non-outlier laps', () => {
    const result = parseRacechronoCsv(buildMultiLapCsv());
    const nonOutlierCount = result.laps.filter(l => !l.is_outlier).length;
    expect(result.header.analyzed_laps).toBe(nonOutlierCount);
  });

  it('has a positive consistency_score between 0 and 100', () => {
    const result = parseRacechronoCsv(buildMultiLapCsv());
    expect(result.consistency.consistency_score).toBeGreaterThanOrEqual(0);
    expect(result.consistency.consistency_score).toBeLessThanOrEqual(100);
  });

  it('returns best_lap_trace when GPS columns are present', () => {
    const result = parseRacechronoCsv(buildMultiLapCsv());
    expect(result.best_lap_trace).toBeDefined();
    expect(result.best_lap_trace!.length).toBeGreaterThan(0);
  });
});

// ─── Single-lap edge case ────────────────────────────────────────────────────

describe('parseRacechronoCsv — single lap', () => {
  it('handles a CSV with only one lap without throwing', () => {
    const rows = makeLapRowStrings(1, 0, 50);
    const csv = buildMinimalCsv({ rows });
    const result = parseRacechronoCsv(csv);
    expect(result.header.total_laps).toBe(1);
    expect(result.laps).toHaveLength(1);
  });
});
