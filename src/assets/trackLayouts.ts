// Reference GPS coordinates for known race tracks.
// These are used to draw a recognizable reference outline behind telemetry data.
// Coordinates are [lat, lon] pairs in track order (clockwise), derived from
// OSM centroid (34.1543, -83.8165) + published corner-by-corner geometry.
// Accuracy: ±10–30m per point — correct for SVG reference outlines.

export interface TrackLayout {
  name: string;
  /** Aliases that might appear in session header.track */
  aliases: string[];
  /** [lat, lon] pairs in clockwise order, start/finish first, closing back to start */
  waypoints: [number, number][];
  /** Apex positions for each numbered corner [lat, lon] */
  corners: { id: string; name: string; lat: number; lon: number }[];
}

// ── Road Atlanta (Michelin Raceway Road Atlanta) ──────────────────────────────
// Braselton, GA · 2.540 mi / 4.088 km · 12 turns · clockwise
const roadAtlanta: TrackLayout = {
  name: 'Road Atlanta',
  aliases: ['road atlanta', 'michelin raceway road atlanta', 'roadatlanta', 'road_atlanta', 'mrra'],
  waypoints: [
    // START / FINISH (pit straight, west side, heading N)
    [34.1500, -83.8193],
    [34.1510, -83.8193],
    [34.1522, -83.8191],
    // TURN 1 — uphill banked right-hander
    [34.1530, -83.8185],
    [34.1535, -83.8175],
    [34.1538, -83.8165],
    // Short straight uphill to T2
    [34.1542, -83.8158],
    [34.1548, -83.8150],
    // TURN 2 — blind left over crest
    [34.1552, -83.8143],
    [34.1555, -83.8138],
    [34.1557, -83.8130],
    // TURN 3 — blind downhill right (hardest corner)
    [34.1558, -83.8120],
    [34.1555, -83.8112],
    [34.1550, -83.8105],
    // THE ESSES — T4a/T4b/T5 sweeping downhill complex
    [34.1545, -83.8100],
    [34.1540, -83.8097],
    [34.1535, -83.8095],
    [34.1530, -83.8097],
    [34.1525, -83.8100],
    // TURN 5 — uphill left, end of Esses
    [34.1520, -83.8105],
    [34.1516, -83.8110],
    [34.1512, -83.8118],
    // Straight over the rise to T6
    [34.1508, -83.8125],
    [34.1505, -83.8132],
    // TURN 6 — downhill entry / uphill camber
    [34.1502, -83.8138],
    [34.1498, -83.8143],
    [34.1495, -83.8150],
    [34.1492, -83.8155],
    // TURN 7 — sharp left hairpin, slowest corner, onto back straight
    [34.1488, -83.8158],
    [34.1484, -83.8162],
    [34.1480, -83.8168],
    // BACK STRAIGHT — T8/T9 flat kinks (near 140+ mph)
    [34.1475, -83.8173],
    [34.1468, -83.8178],
    [34.1462, -83.8180],
    [34.1455, -83.8180],
    [34.1448, -83.8177],
    [34.1442, -83.8173],
    // TURN 10a/10b CHICANE — left-right, hardest braking
    [34.1437, -83.8168],
    [34.1433, -83.8162],
    [34.1430, -83.8157],
    [34.1428, -83.8152],
    [34.1426, -83.8145],
    [34.1425, -83.8138],
    // Short straight to T11 (under bridge)
    [34.1426, -83.8130],
    [34.1428, -83.8122],
    // TURN 11 — "The Bridge" slight right kink
    [34.1430, -83.8118],
    [34.1433, -83.8115],
    // TURN 12 — "The Dive" steep downhill right-hander
    [34.1438, -83.8113],
    [34.1445, -83.8115],
    [34.1452, -83.8120],
    [34.1460, -83.8130],
    // Return to front straight
    [34.1468, -83.8145],
    [34.1478, -83.8165],
    [34.1490, -83.8180],
    [34.1500, -83.8193],  // closes loop
  ],
  corners: [
    { id: 't1',  name: 'T1',  lat: 34.1535, lon: -83.8175 },
    { id: 't2',  name: 'T2',  lat: 34.1555, lon: -83.8138 },
    { id: 't3',  name: 'T3',  lat: 34.1555, lon: -83.8112 },
    { id: 't4',  name: 'T4',  lat: 34.1535, lon: -83.8095 },
    { id: 't5',  name: 'T5',  lat: 34.1516, lon: -83.8110 },
    { id: 't6',  name: 'T6',  lat: 34.1498, lon: -83.8143 },
    { id: 't7',  name: 'T7',  lat: 34.1484, lon: -83.8162 },
    { id: 't10', name: 'T10', lat: 34.1430, lon: -83.8157 },
    { id: 't11', name: 'T11', lat: 34.1430, lon: -83.8118 },
    { id: 't12', name: 'T12', lat: 34.1445, lon: -83.8115 },
  ],
};

export const TRACK_LAYOUTS: TrackLayout[] = [roadAtlanta];

/** Find a reference layout matching a session's track name */
export function findTrackLayout(trackName: string | undefined): TrackLayout | null {
  if (!trackName) return null;
  const lc = trackName.toLowerCase().trim();
  return TRACK_LAYOUTS.find(t =>
    t.aliases.some(a => lc.includes(a) || a.includes(lc))
  ) ?? null;
}
