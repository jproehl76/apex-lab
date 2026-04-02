// Reference GPS outlines for known race tracks.
// Adding a new track: fill in waypoints, corners, colors, logo, aliases.
// Waypoints: [lat, lon], clockwise (unless noted), S/F first, closing back to start.
// Corners: corner positions are auto-detected from waypoint curvature at runtime.
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
  cornerNames: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T10', 'T11', 'T12'],
};

// ── Road America ──────────────────────────────────────────────────────────────
// Elkhart Lake, WI · 4.048 mi · 14 turns · counterclockwise
// Waypoints sourced from OSM ways 122090239–122090299, 110527567 (OSM © contributors)
// Accurate GPS centerline via Overpass API, 2025
const roadAmerica: TrackLayout = {
  name: 'Road America',
  aliases: ['road america', 'roadamerica', 'road_america', 'elkhart lake'],
  colors: { primary: '#C8102E', accent: '#FFFFFF' },
  logo: 'https://www.roadamerica.com/sites/default/themes/dtheme/img/logo-wh.svg',
  waypoints: [
    // S/F — front straight, heading south (counterclockwise)
    [43.8035408, -87.9897809], [43.8024220, -87.9897543], [43.8003990, -87.9897005],
    [43.7978954, -87.9896282], [43.7937541, -87.9894997], [43.7925465, -87.9894753],
    // T1 — fast right-hander
    [43.7922488, -87.9895554], [43.7919314, -87.9899331], [43.7918456, -87.9901869],
    [43.7917988, -87.9904894], [43.7914469, -87.9930875],
    // T2 — right kink
    [43.7914292, -87.9933128], [43.7913879, -87.9943597], [43.7913839, -87.9946348],
    [43.7913846, -87.9948508],
    // T3 — right-hander
    [43.7914618, -87.9952084], [43.7916389, -87.9954409], [43.7919448, -87.9955431],
    // T4 / Moraine Sweep entry
    [43.7927735, -87.9954522], [43.7944462, -87.9951185], [43.7949916, -87.9949836],
    [43.7953135, -87.9948851], [43.7958233, -87.9947072], [43.7961240, -87.9945759],
    // Long straight (Moraine Sweep → T5)
    [43.7972694, -87.9940895], [43.7988548, -87.9932514], [43.8004455, -87.9926724],
    [43.8014619, -87.9924461],
    // T5 — hard left, uphill (prime overtaking zone)
    [43.8016583, -87.9924239], [43.8018148, -87.9925291], [43.8018742, -87.9929889],
    // T6 — Corvette Bridge area, blind left uphill
    [43.8017929, -87.9955853], [43.8016999, -87.9960681], [43.8013547, -87.9962214],
    // T7 — fast right kink
    [43.7999151, -87.9961003], [43.7996247, -87.9961485], [43.7993149, -87.9964382],
    // Hurry Downs (steep downhill to T8)
    [43.7973343, -87.9998451],
    // T8 — hard left, most technically demanding corner
    [43.7971195, -87.9999999], [43.7968369, -87.9998551],
    // T8 to Carousel
    [43.7959414, -87.9989368],
    // T9/T10 Carousel — multi-apex right-hand sweeper
    [43.7954584, -87.9986805], [43.7946298, -87.9989702], [43.7942394, -87.9995998],
    [43.7941496, -88.0003272], [43.7945175, -88.0014912], [43.7950131, -88.0018614],
    // The Kink (T11) — most famous corner, near-flat right
    [43.7961597, -88.0022232], [43.7978010, -88.0026821], [43.7983189, -88.0027530],
    [43.7986077, -88.0026910],
    // Kettle Bottoms (high-speed straight to Canada Corner)
    [43.8008230, -88.0002500], [43.8023435, -87.9988987], [43.8038724, -87.9980578],
    [43.8046808, -87.9977472],
    // T12 Canada Corner — hard right, best overtaking spot
    [43.8050036, -87.9972875], [43.8049984, -87.9970837],
    // Thunder Valley → T13 Bill Mitchell Bend
    [43.8046318, -87.9955907], [43.8042512, -87.9949237], [43.8041505, -87.9947860],
    [43.8038284, -87.9942402], [43.8037297, -87.9936505], [43.8037737, -87.9932285],
    // T14 — final corner onto front straight
    [43.8039466, -87.9924256], [43.8041931, -87.9907841], [43.8041118, -87.9901243],
    [43.8038370, -87.9898223], [43.8035408, -87.9897809],
  ],
  cornerNames: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14'],
};

// ── Virginia International Raceway (VIR) ──────────────────────────────────────
// Alton, VA · 3.270 mi · 17 turns · clockwise
// Named corners: T1 Horseshoe, T2/T3 NASCAR Bend, T4 Left Hook, T5/T6 The Snake,
// T7–T9 Climbing Esses (bridge underpass), T10 South Bend, T11/T12 Oak Tree,
// T13 Fish Hook, T14/T15 Roller Coaster/Spiral, T16 Hog Pen
// Front section waypoints from OSM (ways 20293988, 1315957516–1315957529).
// South section (T10–T16) waypoints are approximate; GPS trace used for heat map.
const vir: TrackLayout = {
  name: 'Virginia International Raceway',
  aliases: ['vir', 'virginia international', 'virginia international raceway', 'virnow', 'alton va'],
  colors: { primary: '#00693f', accent: '#fff100' },
  logo: 'https://virnow.com/wp-content/uploads/2023/11/VIR_2017_white-1.png',
  waypoints: [
    // S/F — Hog Pen exit onto front straight, heading NE (OSM Way 20293988)
    [36.5667524, -79.2121158], [36.5672743, -79.2112255], [36.5676234, -79.2103992],
    [36.5679365, -79.2096425], [36.5682199, -79.2089331], [36.5684451, -79.2083579],
    [36.5685888, -79.2079432], [36.5686697, -79.2076368], [36.5687557, -79.2071937],
    [36.5688179, -79.2066694], [36.5688397, -79.2063084], [36.5688769, -79.2052405],
    // T1 Horseshoe — right-hand U-turn at NE end (OSM Way 1315957518)
    [36.5687489, -79.2027059], [36.5686521, -79.2023320], [36.5684074, -79.2021863],
    [36.5682410, -79.2022330], [36.5679590, -79.2025660], [36.5678530, -79.2029000],
    [36.5678855, -79.2035210], [36.5679666, -79.2038561],
    // T2/T3 NASCAR Bend — heading back SW (OSM Ways 1315957519 + 1315957520)
    [36.5681168, -79.2043522], [36.5682678, -79.2049622], [36.5682393, -79.2053789],
    [36.5680040, -79.2060832], [36.5677641, -79.2063944], [36.5674660, -79.2063970],
    // T4 Left Hook (OSM Ways 1315957521 + 1315957522)
    [36.5668745, -79.2062120], [36.5662184, -79.2059381], [36.5660663, -79.2055964],
    [36.5661149, -79.2053970], [36.5660321, -79.2046822], [36.5656019, -79.2042945],
    // T5/T6 The Snake — high-speed left-right sequence (OSM Way 1315957524)
    [36.5651880, -79.2041810], [36.5644230, -79.2044880], [36.5639725, -79.2045454],
    [36.5635754, -79.2046801],
    // T7 bridge underpass + T8/T9 Climbing Esses heading south (OSM Way 1315957525)
    [36.5626725, -79.2046201], [36.5618317, -79.2046348], [36.5611040, -79.2047415],
    [36.5604422, -79.2048131], [36.5601440, -79.2053160], [36.5603523, -79.2059471],
    // T10 South Bend — interpolated connector + OSM apex (Way 1315957526)
    [36.5578000, -79.2056000], [36.5562000, -79.2054000],
    [36.5552320, -79.2053462], [36.5547550, -79.2052980],
    // T11/T12 Oak Tree — interpolated connector + OSM apex (Way 1315957528)
    [36.5533000, -79.2049000], [36.5524000, -79.2047000],
    [36.5520030, -79.2047170], [36.5518991, -79.2050212], [36.5521440, -79.2053040],
    // Back straight heading NW toward Fish Hook (OSM Way 91012202)
    [36.5530250, -79.2059470], [36.5556310, -79.2078450], [36.5566530, -79.2084820],
    [36.5580970, -79.2092920], [36.5593130, -79.2099450], [36.5608350, -79.2107640],
    // T13 Fish Hook — left-hand turn (OSM Way 989707446)
    [36.5579420, -79.2055650], [36.5578530, -79.2048930], [36.5576010, -79.2047370],
    // T14/T15 Roller Coaster — interpolated approach + OSM apex (Way 1315957529)
    [36.5590000, -79.2073000], [36.5605000, -79.2095000], [36.5615000, -79.2110000],
    [36.5620220, -79.2116330], [36.5625282, -79.2119915], [36.5629119, -79.2115833],
    // Spiral — heading back SE (OSM Way 1315957535)
    [36.5565290, -79.2076150], [36.5563590, -79.2072670], [36.5560880, -79.2065120],
    [36.5559370, -79.2061430], [36.5561690, -79.2058090],
    // T16 Hog Pen — interpolated approach + OSM section (Way 1315957516)
    [36.5580000, -79.2075000], [36.5605000, -79.2095000], [36.5625000, -79.2108000],
    [36.5647457, -79.2119505], [36.5651318, -79.2125941], [36.5654765, -79.2128119],
    [36.5660969, -79.2127443], [36.5665780, -79.2123910], [36.5667524, -79.2121158],
  ],
  // Cross-over bridge: North Course passes over Full Course between T6b and T7
  bridgeWaypoints: [
    [36.5635754, -79.2046801], [36.5626725, -79.2046201],
  ],
  cornerNames: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17'],
};

// ── Blackhawk Farms Raceway ───────────────────────────────────────────────────
// South Beloit, IL · 1.95 mi · ~10 turns · counterclockwise
// Named corners: T1, T2, T3 (Carousel), T3A chicane (3A-1/3A-2/3A-3), T4, T5,
// T6 (flat kink), Silo Turn, T7
// OSM has only a property boundary polygon (Way 343329140); centerline waypoints
// are derived from boundary extents + published corner geometry.
const blackhawkFarms: TrackLayout = {
  name: 'Blackhawk Farms Raceway',
  aliases: ['blackhawk', 'blackhawk farms', 'bhf', 'black hawk farms', 'south beloit'],
  colors: { primary: '#2EA3F2', accent: '#222222' },
  waypoints: [
    // S/F — north end of front straight, heading south (counterclockwise)
    [42.4910000, -89.1170000], [42.4905000, -89.1165000], [42.4898000, -89.1160000],
    // T1 — hard braking 90° right-hander
    [42.4892000, -89.1158000], [42.4886000, -89.1162000],
    // T2 — slight left bend
    [42.4880000, -89.1168000], [42.4874000, -89.1170000], [42.4868000, -89.1168000],
    // T3 Carousel — double-apex right-hand sweeper (highest-speed corner)
    [42.4860000, -89.1162000], [42.4855000, -89.1150000], [42.4853000, -89.1138000],
    [42.4857000, -89.1128000],
    // T3A chicane (added 1992) — left/right/right sequence
    [42.4862000, -89.1122000], [42.4867000, -89.1118000], [42.4872000, -89.1115000],
    [42.4876000, -89.1118000],
    // T4 — sub-90° left turn
    [42.4878000, -89.1126000], [42.4880000, -89.1132000],
    // T5 — left-hand sweeper
    [42.4883000, -89.1138000], [42.4886000, -89.1135000], [42.4890000, -89.1130000],
    [42.4895000, -89.1125000],
    // T6 — high-speed flat kink
    [42.4900000, -89.1122000], [42.4904000, -89.1120000], [42.4908000, -89.1122000],
    // Silo Turn / pre-T7 kink
    [42.4911000, -89.1128000],
    // T7 — tight right-hander, last braking zone before front straight
    [42.4912000, -89.1135000], [42.4911000, -89.1143000], [42.4910000, -89.1152000],
    [42.4910000, -89.1162000], [42.4910000, -89.1170000],
  ],
  cornerNames: ['T1', 'T2', 'T3', 'T3A', 'T4', 'T5', 'T6', 'T7'],
};

// ── Brainerd International Raceway (Donnybrooke Road Course) ──────────────────
// Brainerd, MN · 3.1 mi · 10 turns · clockwise
// Waypoints sourced from OSM Way 137243010 (52 nodes, tagged highway=raceway)
// NOTE: previous registry entry had S/F coordinates wrong by ~10 miles.
//       Corrected to actual track location at 46.418°N, -94.273°W.
const brainerd: TrackLayout = {
  name: 'Brainerd International Raceway',
  aliases: ['brainerd', 'bir', 'brainerd international', 'brainerd raceway', 'donnybrooke'],
  colors: { primary: '#DA0000', accent: '#FFFFFF' },
  waypoints: [
    // S/F — main straight / tower area, heading clockwise (OSM Way 137243010)
    [46.4188056, -94.2729179], [46.4186718, -94.2725307], [46.4181135, -94.2710938],
    [46.4172173, -94.2686957], [46.4169954, -94.2681606], [46.4165713, -94.2675342],
    // T1 entry zone — banked right-hander
    [46.4160820, -94.2671644], [46.4155127, -94.2667920], [46.4147537, -94.2666543],
    [46.4129620, -94.2668081], [46.4119126, -94.2669863], [46.4112818, -94.2672453],
    [46.4109246, -94.2675772], [46.4104055, -94.2681844],
    // T2/T3 — sweeping infield section heading west
    [46.4100259, -94.2694393], [46.4098640, -94.2714875], [46.4097021, -94.2736734],
    [46.4097635, -94.2743454], [46.4100817, -94.2746368], [46.4105618, -94.2744992],
    // T4/T5 — heading northeast back across infield
    [46.4128447, -94.2726048], [46.4132410, -94.2726048], [46.4134811, -94.2730986],
    [46.4136094, -94.2744506], [46.4138104, -94.2749363], [46.4141899, -94.2750983],
    [46.4158309, -94.2749930], [46.4161379, -94.2751792], [46.4163220, -94.2756002],
    // T6/T7 — heading west along back section
    [46.4162830, -94.2769360], [46.4161713, -94.2789600], [46.4160883, -94.2793638],
    [46.4156523, -94.2801339], [46.4156280, -94.2806126], [46.4157806, -94.2811054],
    // T8/T9 — turning northeast toward back straight (T9 goes under bridge)
    [46.4163834, -94.2829188], [46.4166904, -94.2833155], [46.4171090, -94.2835098],
    [46.4179442, -94.2835378], [46.4180746, -94.2835422], [46.4210479, -94.2835342],
    // Back straight heading east (main straight)
    [46.4210939, -94.2835341], [46.4220817, -94.2835179],
    // T10 — wide right-hander returning to front straight
    [46.4223440, -94.2832346], [46.4224667, -94.2826517], [46.4222397, -94.2818798],
    [46.4216593, -94.2804280], [46.4212575, -94.2793783], [46.4208557, -94.2783097],
    [46.4202343, -94.2766824], [46.4199276, -94.2758769], [46.4194437, -94.2746316],
    // Close to S/F
    [46.4188056, -94.2729179],
  ],
  cornerNames: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'],
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

// ── Mid-Ohio Sports Car Course ────────────────────────────────────────────────
// Lexington, OH · 2.258 mi · 13 turns · clockwise
// Waypoints sourced from OSM ways 444205375, 1315957511-1315957515 (OSM © contributors)
// Accurate GPS centerline via Overpass API, 2025
const midOhio: TrackLayout = {
  name: 'Mid-Ohio Sports Car Course',
  aliases: ['mid-ohio', 'mid ohio', 'midohio', 'mid_ohio', 'lexington'],
  colors: { primary: '#d6242e', accent: '#FFFFFF' },
  logo: 'https://midohio.com/wp-content/uploads/2024/02/mid-ohio-logo-white.svg',
  waypoints: [
    // S/F — Keyhole exit onto front straight, heading NE (OSM Way 1315957511 exit)
    [40.6843694, -82.6401586], [40.6874855, -82.6403109], [40.6884307, -82.6402564],
    // Front straight approach to T1
    [40.6898041, -82.6396564],
    // T1 — blind uphill right, heavy braking from 130+ mph
    [40.6922294, -82.6383810], [40.6923910, -82.6381507], [40.6924271, -82.6378730],
    // T2 — fast left-hander
    [40.6920955, -82.6370019],
    // T3/T4 The Esses — high-speed S-bends, downhill
    [40.6921090, -82.6365195], [40.6924243, -82.6362632],
    // T5/T6/T7 Madness — blind crest, off-camber, under bridge
    [40.6933900, -82.6363079], [40.6936240, -82.6361612], [40.6936906, -82.6358868],
    [40.6936855, -82.6348702],
    // T8/T9 — medium right + banked left
    [40.6940607, -82.6342933], [40.6944740, -82.6338774], [40.6945293, -82.6337073],
    // T10 Thunder Valley entry — right, downhill braking
    [40.6945741, -82.6325936], [40.6944545, -82.6322653], [40.6942104, -82.6321025],
    // T11 Thunder Valley exit (OSM Way 1315957515)
    [40.6939389, -82.6320465], [40.6926500, -82.6319724], [40.6922429, -82.6320167],
    [40.6916577, -82.6322860], [40.6909465, -82.6329295], [40.6907241, -82.6330139],
    [40.6904524, -82.6329417],
    // T12/T13 Carousel — near-360° right (OSM Way 1315957514)
    [40.6898048, -82.6323891], [40.6894988, -82.6322524], [40.6892089, -82.6322145],
    [40.6889672, -82.6323210], [40.6887627, -82.6326777], [40.6887944, -82.6330101],
    [40.6889377, -82.6332559], [40.6893451, -82.6335813], [40.6894299, -82.6338026],
    // Back straight heading west (OSM Way 1315957513)
    [40.6895839, -82.6380309], [40.6895246, -82.6384901], [40.6893597, -82.6388446],
    [40.6890134, -82.6391683], [40.6885911, -82.6392457],
    [40.6842882, -82.6389966],
    // The Keyhole — tight hairpin (OSM Way 1315957511)
    [40.6839953, -82.6392058], [40.6838814, -82.6396135],
    [40.6840563, -82.6400212], [40.6843694, -82.6401586],
  ],
  cornerNames: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13'],
};

// ── Ozarks International Raceway ──────────────────────────────────────────────
// Gravois Mills, MO · 3.97 mi · 19 turns · clockwise
// Opened 2022. Named sections: The Carousel (T4), The Esses (T5–T7),
// The Rollercoaster (T8–T10). Significant elevation change (~150 ft net).
// OSM has only a property boundary polygon (Way 1425294962); centerline waypoints
// are derived from boundary extents + published NASA Speed News corner descriptions.
const ozarks: TrackLayout = {
  name: 'Ozarks International Raceway',
  aliases: ['ozarks', 'oir', 'ozarks international', 'gravois mills', 'ozarks raceway'],
  colors: { primary: '#EA0505', accent: '#020F4D' },
  logo: 'https://ozarksinternationalraceway.com/wp-content/uploads/2021/08/logo__full_white_stroke.png',
  waypoints: [
    // S/F — pit exit SE area, heading north on front straight
    [38.2705000, -92.8800000], [38.2720000, -92.8798000], [38.2740000, -92.8795000],
    [38.2760000, -92.8793000], [38.2778000, -92.8793000],
    // T1 — downhill right-hander, heavy braking from front straight
    [38.2790000, -92.8800000], [38.2800000, -92.8812000], [38.2808000, -92.8825000],
    // T2 — uphill left turn
    [38.2812000, -92.8838000], [38.2810000, -92.8855000],
    // T3 — right turn after crest
    [38.2806000, -92.8868000], [38.2800000, -92.8878000],
    // T4 Carousel — continuous right-hand sweeper
    [38.2792000, -92.8882000], [38.2782000, -92.8888000], [38.2772000, -92.8890000],
    [38.2760000, -92.8887000],
    // T5–T7 The Esses — right-left-left, high-speed uphill (140–145 mph)
    [38.2749000, -92.8882000], [38.2738000, -92.8878000],
    // T8–T10 The Rollercoaster — left-hand series, compression, blind uphill exit
    [38.2727000, -92.8876000], [38.2716000, -92.8878000], [38.2706000, -92.8882000],
    [38.2696000, -92.8886000],
    // T11 — downhill closing left-hander, major braking zone
    [38.2686000, -92.8888000], [38.2677000, -92.8890000], [38.2672000, -92.8882000],
    // T12–T14 — right, uphill complex
    [38.2671000, -92.8870000], [38.2671000, -92.8856000], [38.2673000, -92.8845000],
    [38.2676000, -92.8838000], [38.2680000, -92.8832000],
    // T15 — downhill right (mirrors T1)
    [38.2683000, -92.8825000], [38.2685000, -92.8818000],
    // T16–T17 — valley approach, banked uphill
    [38.2688000, -92.8812000], [38.2691000, -92.8818000], [38.2694000, -92.8824000],
    [38.2698000, -92.8828000],
    // T18 — ~180° hairpin
    [38.2702000, -92.8822000], [38.2706000, -92.8815000],
    // T19 — double-apex downhill left returning to front straight
    [38.2706000, -92.8808000], [38.2705000, -92.8800000],
  ],
  cornerNames: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19'],
};

export const TRACK_LAYOUTS: TrackLayout[] = [
  roadAtlanta,
  roadAmerica,
  vir,
  blackhawkFarms,
  brainerd,
  ozarks,
  sebring,
  midOhio,
];

export function findTrackLayout(trackName: string | undefined): TrackLayout | null {
  if (!trackName) return null;
  const lc = trackName.toLowerCase().trim();
  return TRACK_LAYOUTS.find(t =>
    t.aliases.some(a => lc.includes(a) || a.includes(lc))
  ) ?? null;
}
