/**
 * detectCorners — derives corner apex positions from a GPS/OSM waypoint path
 * using curvature analysis. Works for any circuit at any waypoint density.
 *
 * Algorithm:
 *  1. Compute the turning angle (direction change) at each interior waypoint.
 *  2. Smooth the angle array with an adaptive rolling mean.
 *  3. Find local maxima above a threshold — these are corner apexes.
 *  4. Merge peaks that are within ~100 m of each other (same physical corner).
 *  5. Label corners with supplied official names in order, or T1, T2, T3… if none.
 *
 * This matches how professional data-logging tools (AiM Race Studio, MoTeC i2)
 * place corner markers — from the track geometry, not from manual entry.
 */

export interface DetectedCorner {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

function rollingMean(arr: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return arr.map((_, i) => {
    const s = Math.max(0, i - half);
    const e = Math.min(arr.length, i + half + 1);
    const slice = arr.slice(s, e);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/**
 * Detect corners from an ordered array of [lat, lon] waypoints.
 *
 * @param waypoints  Ordered track centerline points (first = S/F).
 * @param names      Optional official turn labels in lap order, e.g.
 *                   ['T1','T2','T3','T4','T5','T6','T7','T10','T11','T12'].
 *                   If omitted, corners are labeled T1, T2, T3…
 * @param minAngle   Minimum turning angle in radians to qualify as a corner.
 *                   Default 0.10 rad (~5.7°) — catches tight chicanes and
 *                   gradual sweepers alike.
 * @param mergeDist  Maximum distance (degrees) to merge nearby peaks into one
 *                   corner. Default 0.0010 ≈ 110 m.
 */
export function detectCornersFromWaypoints(
  waypoints: [number, number][],
  names?: string[],
  minAngle = 0.10,
  mergeDist = 0.0010,
): DetectedCorner[] {
  // Drop the closing duplicate point if the path loops back to start.
  const pts = waypoints.length > 2 &&
    Math.hypot(
      waypoints[0][0] - waypoints[waypoints.length - 1][0],
      waypoints[0][1] - waypoints[waypoints.length - 1][1],
    ) < 0.0003
    ? waypoints.slice(0, -1)
    : waypoints;

  const n = pts.length;
  if (n < 5) return [];

  // Step 1 — turning angle at each interior point.
  const angles = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const [lat0, lon0] = pts[i - 1];
    const [lat1, lon1] = pts[i];
    const [lat2, lon2] = pts[i + 1];
    const d1: [number, number] = [lat1 - lat0, lon1 - lon0];
    const d2: [number, number] = [lat2 - lat1, lon2 - lon1];
    const len1 = Math.hypot(d1[0], d1[1]);
    const len2 = Math.hypot(d2[0], d2[1]);
    if (len1 < 1e-10 || len2 < 1e-10) continue;
    const cos = (d1[0] * d2[0] + d1[1] * d2[1]) / (len1 * len2);
    angles[i] = Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  // Step 2 — smooth (adaptive window: ~5% of total waypoints, min 3).
  const window = Math.max(3, Math.round(n * 0.05));
  const smoothed = rollingMean(angles, window);

  // Step 3 — local maxima above threshold.
  const peaks: { idx: number; lat: number; lon: number; angle: number }[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (
      smoothed[i] >= minAngle &&
      smoothed[i] >= smoothed[i - 1] &&
      smoothed[i] >= smoothed[i + 1]
    ) {
      peaks.push({ idx: i, lat: pts[i][0], lon: pts[i][1], angle: smoothed[i] });
    }
  }

  // Step 4 — merge nearby peaks, keep the sharpest.
  const merged: typeof peaks = [];
  for (const p of peaks) {
    const last = merged[merged.length - 1];
    if (last && Math.hypot(p.lat - last.lat, p.lon - last.lon) < mergeDist) {
      if (p.angle > last.angle) merged[merged.length - 1] = p;
    } else {
      merged.push(p);
    }
  }

  // Step 5 — label with official names or sequential T1, T2, T3…
  return merged.map((p, i) => {
    const label = names?.[i] ?? `T${i + 1}`;
    const id = label.toLowerCase().replace(/[^a-z0-9]/g, '');
    return { id, name: label, lat: p.lat, lon: p.lon };
  });
}
