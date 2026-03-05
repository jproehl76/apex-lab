// Reference GPS outlines for known race tracks.
// Adding a new track: fill in waypoints, corners, colors, logo, aliases.
// Waypoints: [lat, lon], clockwise, S/F first, closing back to start.
// Corners: geographic apex positions used to place markers accurately on the map.
//
// For tracks not in this list the app falls back to the GPS trace from the session,
// which draws the correct outline but places corner markers less precisely.

export interface TrackLayout {
  name: string;
  /** String fragments that might appear in session header.track — case-insensitive */
  aliases: string[];
  /** Brand colors for header tinting and accent lines */
  colors: { primary: string; accent: string };
  /** Official logo URL — ideally SVG with transparent background */
  logo?: string;
  /** [lat, lon] pairs, clockwise, start = S/F, last point closes back to start */
  waypoints: [number, number][];
  /** Overpass segment drawn on top to simulate a bridge (optional) */
  bridgeWaypoints?: [number, number][];
  /**
   * Official corner labels in lap order, starting from T1 (first corner after S/F).
   * Corner positions are auto-detected from waypoint curvature at runtime.
   * If omitted, corners are labeled T1, T2, T3… sequentially.
   */
  cornerNames?: string[];
  /** @deprecated Manual corner positions — ignored when cornerNames is set. */
  corners?: { id: string; name: string; lat: number; lon: number }[];
}

// ── Road Atlanta (Michelin Raceway Road Atlanta) ──────────────────────────────
// Braselton, GA · 2.540 mi · 12 turns · clockwise
// Waypoints sourced from OpenStreetMap ways 9292566 + 1360423184 (OSM © contributors)
// Node data retrieved via Overpass API — accurate GPS centerline, 2025
const roadAtlanta: TrackLayout = {
  name: 'Road Atlanta',
  aliases: ['road atlanta', 'michelin raceway road atlanta', 'roadatlanta', 'road_atlanta', 'mrra'],
  colors: { primary: '#27509B', accent: '#FFE601' },
  logo: 'https://michelinracewayroadatlanta.com/images/MichelinRoadAtlanta_logoREV-02.svg',
  waypoints: [
    // S/F — pit-straight entry, heading northeast (OSM way 9292566)
    [34.1433726, -83.8137339], [34.1436808, -83.8136247], [34.1440374, -83.8134995],
    [34.1444824, -83.8132835], [34.1447976, -83.8128593], [34.1450284, -83.8122005],
    [34.1451175, -83.8120794], [34.1453770, -83.8120070], [34.1456212, -83.8119230],
    [34.1459156, -83.8117409], [34.1461533, -83.8115201], [34.1463173, -83.8113157],
    // Pit straight / T1 approach (heading NE, slight eastward arc)
    [34.1466206, -83.8109167], [34.1468597, -83.8106875], [34.1471022, -83.8105291],
    [34.1473796, -83.8103881], [34.1475772, -83.8103092], [34.1477659, -83.8102743],
    [34.1478316, -83.8102755], [34.1480125, -83.8103150], [34.1481721, -83.8104178],
    [34.1483497, -83.8105787], [34.1485317, -83.8107947], [34.1487249, -83.8110964],
    [34.1488017, -83.8112370],
    // T1 uphill sweep — heading northwest toward apex
    [34.1492181, -83.8120297], [34.1503980, -83.8142560], [34.1506995, -83.8148602],
    [34.1507634, -83.8151088], [34.1508001, -83.8153394],
    // T1 apex (northernmost point of circuit)
    [34.1508081, -83.8154362], [34.1508068, -83.8155287], [34.1507998, -83.8156411],
    // T2 left-hander over the hill crest
    [34.1507257, -83.8159543], [34.1506673, -83.8161257], [34.1505770, -83.8163556],
    [34.1504767, -83.8165907], [34.1503062, -83.8169998],
    // T3–T5 esses — sweeping southwest
    [34.1501820, -83.8172647], [34.1500455, -83.8174781], [34.1499209, -83.8176210],
    [34.1497475, -83.8177532], [34.1495901, -83.8178709], [34.1493121, -83.8180306],
    [34.1491125, -83.8181549], [34.1489331, -83.8182609],
    // T6 — banked 90° right (westernmost extent of esses section)
    [34.1488080, -83.8182832], [34.1487036, -83.8182635], [34.1486237, -83.8182191],
    [34.1484761, -83.8180089], [34.1483125, -83.8177878], [34.1481655, -83.8177979],
    // T7 approach — sweeping left down to slowest corner
    [34.1475363, -83.8180128], [34.1468952, -83.8182175], [34.1461687, -83.8184581],
    [34.1453133, -83.8187093],
    // T7 apex — slow left onto back straight (OSM junction node)
    [34.1446939, -83.8188032], [34.1441639, -83.8188129], [34.1436242, -83.8187567],
    // Back straight heading south (OSM way 1360423184)
    [34.1419800, -83.8184920], [34.1412977, -83.8183866], [34.1396160, -83.8181358],
    [34.1385476, -83.8180591], [34.1376244, -83.8181925], [34.1367048, -83.8183600],
    // T10–T11 chicane approach
    [34.1364362, -83.8183919], [34.1362675, -83.8183808],
    // T10 — right into chicane
    [34.1362018, -83.8183160], [34.1361547, -83.8182078], [34.1361480, -83.8181271],
    // T11 — blind apex under bridge, turning north
    [34.1361521, -83.8179855], [34.1361623, -83.8178063], [34.1361836, -83.8174126],
    [34.1362053, -83.8170793], [34.1362579, -83.8168459], [34.1363691, -83.8166662],
    [34.1365199, -83.8165374], [34.1367536, -83.8164746],
    // Post-chicane — heading north toward T12
    [34.1374052, -83.8165240], [34.1382680, -83.8165721], [34.1389087, -83.8165818],
    [34.1398147, -83.8165410], [34.1405406, -83.8164719],
    // T12 entry
    [34.1411785, -83.8164409],
    // T12 — long sweeping right back to S/F (interpolated)
    [34.1416000, -83.8160000], [34.1421000, -83.8153000], [34.1427000, -83.8145000],
    [34.1431000, -83.8139000],
    // Close to S/F
    [34.1433726, -83.8137339],
  ],
  // Bridge overpass: T11 goes under the circuit above the chicane
  bridgeWaypoints: [
    [34.1396160, -83.8181358], [34.1389087, -83.8165818],
  ],
  // Official corner labels in lap order. Positions are auto-detected from
  // waypoint curvature — T1 right after the pit straight, T7 = slowest corner
  // onto back straight, T10/T11 = chicane complex, T12 = final sweeper.
  // Road Atlanta skips T8/T9 (back straight has no numbered corners).
  cornerNames: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T10', 'T11', 'T12'],
};

// ── Road America ──────────────────────────────────────────────────────────────
// Elkhart Lake, WI · 4.048 mi · 14 turns · counterclockwise
// NOTE: waypoints are approximate — will be refined from session GPS data
const roadAmerica: TrackLayout = {
  name: 'Road America',
  aliases: ['road america', 'roadamerica', 'road_america', 'elkhart lake'],
  colors: { primary: '#C8102E', accent: '#FFFFFF' },
  waypoints: [
    // S/F — south end of pit straight, heading east
    [43.7970, -87.9960],
    [43.7970, -87.9940], [43.7970, -87.9918], [43.7970, -87.9898],
    // T1 — left-hander, heading north
    [43.7972, -87.9880], [43.7980, -87.9873],
    // T2/T3 Hurry Downs — heading NE
    [43.7993, -87.9868], [43.8007, -87.9868],
    // T5 Canada Corner — left-hander, heading west/SW
    [43.8020, -87.9875], [43.8025, -87.9890],
    // T6/T7/T8 — Kettle Bottoms section
    [43.8022, -87.9910], [43.8015, -87.9928],
    // T9/T10 — heading south
    [43.8005, -87.9942], [43.7993, -87.9948],
    // T10 Kink — slight right, heading south
    [43.7982, -87.9945], [43.7973, -87.9940],
    // T12/T13 Carousel — heading southwest
    [43.7968, -87.9925], [43.7965, -87.9910],
    // T14 — final hairpin, back onto pit straight heading east
    [43.7966, -87.9890], [43.7968, -87.9872],
    [43.7970, -87.9960], // closes
  ],
  // Road America: 14 turns, counterclockwise. Official numbering includes
  // T1, T3, T5 (Canada Corner), T6, T7, T8 (Kettle Bottom), T9, T10 (Kink),
  // T11, T12, T13 (Carousel), T14 (final hairpin).
  cornerNames: ['T1', 'T3', 'T5', 'T6', 'T7', 'T8', 'T10', 'T12', 'T13', 'T14'],
};

// ── Brainerd International Raceway ────────────────────────────────────────────
// Brainerd, MN · 2.5 mi · road course · clockwise
// NOTE: waypoints are approximate — will be refined from session GPS data
const brainerd: TrackLayout = {
  name: 'Brainerd International Raceway',
  aliases: ['brainerd', 'bir', 'brainerd international', 'brainerd raceway'],
  colors: { primary: '#E31837', accent: '#FFD700' },
  waypoints: [
    // S/F — north end of front straight
    [46.3958, -94.0858],
    [46.3948, -94.0858], [46.3940, -94.0860], [46.3932, -94.0862],
    // T1 — right-hander
    [46.3926, -94.0870], [46.3922, -94.0882],
    // Infield complex
    [46.3920, -94.0896], [46.3925, -94.0910],
    [46.3932, -94.0918], [46.3940, -94.0915],
    // Bowl/Carousel
    [46.3948, -94.0910], [46.3954, -94.0900],
    [46.3958, -94.0888], [46.3960, -94.0874],
    [46.3958, -94.0862],
    [46.3958, -94.0858], // closes
  ],
  cornerNames: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'],
};

// ── Sebring International Raceway ─────────────────────────────────────────────
// Sebring, FL · 3.74 mi · 17 turns · clockwise
// NOTE: waypoints are approximate
const sebring: TrackLayout = {
  name: 'Sebring International Raceway',
  aliases: ['sebring', 'sebring international', 'sebring raceway'],
  colors: { primary: '#003087', accent: '#FF6600' },
  waypoints: [
    [27.4545, -81.3470],
    [27.4548, -81.3450], [27.4550, -81.3430], [27.4548, -81.3412],
    [27.4540, -81.3400], [27.4528, -81.3395],
    [27.4515, -81.3400], [27.4508, -81.3412],
    [27.4505, -81.3428], [27.4508, -81.3445],
    [27.4515, -81.3458], [27.4525, -81.3462],
    [27.4535, -81.3468], [27.4545, -81.3470],
  ],
  cornerNames: ['T1', 'T3', 'T5', 'T7', 'T10', 'T13', 'T17'],
};

// ── Pittsburgh International Race Complex (PittRace) ─────────────────────────
// Wampum, PA · 2.78 mi · clockwise
const pittRace: TrackLayout = {
  name: 'Pittsburgh International Race Complex',
  aliases: ['pitt race', 'pittrace', 'pirc', 'pittsburgh international', 'wampum'],
  colors: { primary: '#FFB612', accent: '#101820' },
  waypoints: [
    [40.8912, -80.3680],
    [40.8920, -80.3668], [40.8928, -80.3655],
    [40.8930, -80.3638], [40.8925, -80.3622],
    [40.8915, -80.3610], [40.8905, -80.3615],
    [40.8898, -80.3628], [40.8895, -80.3645],
    [40.8898, -80.3660], [40.8906, -80.3672],
    [40.8912, -80.3680],
  ],
  cornerNames: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'],
};

export const TRACK_LAYOUTS: TrackLayout[] = [
  roadAtlanta,
  roadAmerica,
  brainerd,
  sebring,
  pittRace,
];

export function findTrackLayout(trackName: string | undefined): TrackLayout | null {
  if (!trackName) return null;
  const lc = trackName.toLowerCase().trim();
  return TRACK_LAYOUTS.find(t =>
    t.aliases.some(a => lc.includes(a) || a.includes(lc))
  ) ?? null;
}
