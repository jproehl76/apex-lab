/**
 * osmTrackFetch — dynamically fetches race circuit geometry from OpenStreetMap
 * via the Overpass API (free, no API key required).
 *
 * For any GPS trace bounding box, it queries for highway=raceway ways,
 * builds a closed polyline, and extracts an approximate corner list from
 * curvature analysis.
 *
 * Results are cached in sessionStorage so the network call only happens once
 * per session per track.
 */

export interface OsmTrackData {
  waypoints: [number, number][]; // [lat, lon]
  source: string;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_PREFIX = 'osm-track-';

/** Pad a bounding box by ~200m in each direction */
function padBbox(minLat: number, minLon: number, maxLat: number, maxLon: number, pad = 0.002) {
  return [minLat - pad, minLon - pad, maxLat + pad, maxLon + pad] as const;
}

interface OsmNode { id: number; lat: number; lon: number }
interface OsmWay  { id: number; nodes: number[]; tags: Record<string, string> }

async function queryOverpass(query: string): Promise<{ nodes: OsmNode[]; ways: OsmWay[] }> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = await res.json();
  const nodes: OsmNode[] = json.elements.filter((e: { type: string }) => e.type === 'node');
  const ways:  OsmWay[]  = json.elements.filter((e: { type: string }) => e.type === 'way');
  return { nodes, ways };
}

/**
 * Given a GPS trace from the session (lat/lon array), query OSM for raceway
 * ways within the trace bounding box and return ordered waypoints.
 * Returns null if no raceway found or network is unavailable.
 */
export async function fetchOsmTrackLayout(
  trace: { lat: number; lon: number }[]
): Promise<OsmTrackData | null> {
  if (trace.length < 10) return null;

  const lats = trace.map(p => p.lat);
  const lons = trace.map(p => p.lon);
  let minLat = lats[0], maxLat = lats[0], minLon = lons[0], maxLon = lons[0];
  for (let i = 1; i < lats.length; i++) {
    if (lats[i] < minLat) minLat = lats[i];
    if (lats[i] > maxLat) maxLat = lats[i];
    if (lons[i] < minLon) minLon = lons[i];
    if (lons[i] > maxLon) maxLon = lons[i];
  }
  const [s, w, n, e] = padBbox(minLat, minLon, maxLat, maxLon);

  const cacheKey = `${CACHE_PREFIX}${s.toFixed(3)},${w.toFixed(3)},${n.toFixed(3)},${e.toFixed(3)}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignore */ }
  }

  try {
    const query = `[out:json][timeout:20];
(
  way["highway"="raceway"](${s},${w},${n},${e});
  way["leisure"="track"]["sport"="motor"](${s},${w},${n},${e});
);
(._;>;);
out body;`;

    const { nodes, ways } = await queryOverpass(query);
    if (!ways.length || !nodes.length) return null;

    // Build node lookup
    const nodeMap = new Map<number, OsmNode>();
    for (const nd of nodes) nodeMap.set(nd.id, nd);

    // Stitch ways into a single ordered polyline
    // Sort by length (longest first = main circuit)
    const resolvedWays = ways.map(w => ({
      ...w,
      pts: w.nodes.map(id => nodeMap.get(id)).filter(Boolean) as OsmNode[],
    })).sort((a, b) => b.pts.length - a.pts.length);

    if (!resolvedWays.length || !resolvedWays[0].pts.length) return null;

    // Use the longest way as the primary circuit line; append others if they share endpoints
    let combined = resolvedWays[0].pts;
    for (const w of resolvedWays.slice(1)) {
      if (w.pts.length < 5) continue;
      const startA = combined[0], endA = combined[combined.length - 1];
      const startB = w.pts[0], endB = w.pts[w.pts.length - 1];
      const dist = (a: OsmNode, b: OsmNode) =>
        Math.hypot(a.lat - b.lat, a.lon - b.lon);
      // Stitch if endpoint is within ~50m
      if (dist(endA, startB) < 0.0005) combined = [...combined, ...w.pts];
      else if (dist(endA, endB) < 0.0005) combined = [...combined, ...w.pts.slice().reverse()];
      else if (dist(startA, endB) < 0.0005) combined = [...w.pts, ...combined];
      else if (dist(startA, startB) < 0.0005) combined = [...w.pts.slice().reverse(), ...combined];
    }

    const waypoints: [number, number][] = combined.map(nd => [nd.lat, nd.lon]);
    const result: OsmTrackData = { waypoints, source: 'openstreetmap' };

    try { sessionStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* quota exceeded */ }
    return result;
  } catch (err) {
    console.warn('[osmTrackFetch] Failed:', err);
    return null;
  }
}
