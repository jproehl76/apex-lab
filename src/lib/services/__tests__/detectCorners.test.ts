import { describe, it, expect } from 'vitest';
import { detectCornersFromWaypoints } from '@/lib/services/detectCorners';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a regular N-gon (polygon) centered at (lat, lon) with a given radius
 * in degrees. A polygon is a good proxy for a circuit with sharp apexes.
 */
function makePolygon(
  sides: number,
  centerLat = 36.0,
  centerLon = -121.0,
  radius = 0.01,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides;
    pts.push([
      centerLat + Math.sin(angle) * radius,
      centerLon + Math.cos(angle) * radius,
    ]);
  }
  // Close the loop so the algorithm can detect the first corner
  pts.push(pts[0]);
  return pts;
}

/**
 * Generate a nearly-straight line of N waypoints — should yield no corners.
 */
function makeStraight(n = 20): [number, number][] {
  return Array.from({ length: n }, (_, i) => [36.0 + i * 0.001, -121.0] as [number, number]);
}

// ─── Basic interface / return type ────────────────────────────────────────────

describe('detectCornersFromWaypoints — return type', () => {
  it('returns an array', () => {
    const result = detectCornersFromWaypoints(makePolygon(4));
    expect(Array.isArray(result)).toBe(true);
  });

  it('each corner has id, name, lat, lon', () => {
    const result = detectCornersFromWaypoints(makePolygon(4));
    for (const c of result) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.name).toBe('string');
      expect(typeof c.lat).toBe('number');
      expect(typeof c.lon).toBe('number');
    }
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('detectCornersFromWaypoints — edge cases', () => {
  it('returns [] for fewer than 5 waypoints', () => {
    expect(detectCornersFromWaypoints([[36, -121], [36.001, -121], [36.002, -121]])).toEqual([]);
  });

  it('returns [] for a straight line (no corners above threshold)', () => {
    const result = detectCornersFromWaypoints(makeStraight(30), undefined, 0.10);
    expect(result).toEqual([]);
  });

  it('does not throw on exactly 5 points', () => {
    expect(() => detectCornersFromWaypoints(makeStraight(5))).not.toThrow();
  });
});

// ─── Corner detection on a square (4 sides) ──────────────────────────────────

describe('detectCornersFromWaypoints — polygon circuits', () => {
  it('detects corners from a hexagon (6 sharp turns)', () => {
    // A 6-sided polygon has 6 sharp ~60° turns; after dedup we have 6 pts (above the n<5 guard)
    const result = detectCornersFromWaypoints(makePolygon(6));
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it('detects corners from an octagon (8 sharp turns)', () => {
    const result = detectCornersFromWaypoints(makePolygon(8));
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

// ─── Custom names ─────────────────────────────────────────────────────────────

describe('detectCornersFromWaypoints — custom names', () => {
  it('uses provided names in order', () => {
    const names = ['Hairpin', 'Chicane', 'Sweeper', 'T4', 'T5', 'T6'];
    const result = detectCornersFromWaypoints(makePolygon(6), names);
    result.forEach((c, i) => {
      expect(c.name).toBe(names[i]);
    });
  });

  it('falls back to T1, T2, T3... when no names provided', () => {
    const result = detectCornersFromWaypoints(makePolygon(6));
    result.forEach((c, i) => {
      expect(c.name).toBe(`T${i + 1}`);
    });
  });

  it('generates id as lowercased alphanumeric from name', () => {
    const result = detectCornersFromWaypoints(makePolygon(4), ['T1', 'T2', 'T3', 'T4']);
    for (const c of result) {
      expect(c.id).toMatch(/^[a-z0-9]+$/);
    }
  });
});

// ─── minAngle parameter ───────────────────────────────────────────────────────

describe('detectCornersFromWaypoints — minAngle parameter', () => {
  it('detects more corners with a lower minAngle threshold', () => {
    const liberal = detectCornersFromWaypoints(makePolygon(8), undefined, 0.01);
    const strict = detectCornersFromWaypoints(makePolygon(8), undefined, 0.50);
    // Lower threshold = more sensitive = more corners (or equal)
    expect(liberal.length).toBeGreaterThanOrEqual(strict.length);
  });

  it('detects zero corners when minAngle is very high', () => {
    const result = detectCornersFromWaypoints(makePolygon(4), undefined, Math.PI);
    expect(result.length).toBe(0);
  });
});

// ─── Merge behavior ───────────────────────────────────────────────────────────

describe('detectCornersFromWaypoints — merge behavior', () => {
  it('returns fewer corners with a larger mergeDist', () => {
    const small = detectCornersFromWaypoints(makePolygon(8), undefined, 0.05, 0.0001);
    const large = detectCornersFromWaypoints(makePolygon(8), undefined, 0.05, 1.0);
    // A very large merge distance collapses more peaks into one
    expect(large.length).toBeLessThanOrEqual(small.length);
  });
});

// ─── Coordinate accuracy ──────────────────────────────────────────────────────

describe('detectCornersFromWaypoints — coordinate accuracy', () => {
  it('corner lat/lon are within the bounding box of the input waypoints', () => {
    const waypoints = makePolygon(4);
    const lats = waypoints.map(p => p[0]);
    const lons = waypoints.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const result = detectCornersFromWaypoints(waypoints);
    for (const c of result) {
      expect(c.lat).toBeGreaterThanOrEqual(minLat);
      expect(c.lat).toBeLessThanOrEqual(maxLat);
      expect(c.lon).toBeGreaterThanOrEqual(minLon);
      expect(c.lon).toBeLessThanOrEqual(maxLon);
    }
  });
});
