// ─── RaceChrono CSV Parser ───────────────────────────────────────────────────
// Converts a RaceChrono v9 tab-separated CSV export into a SessionSummary.

import { celsiusToF, thermalAlertLevel, THERMAL_THRESHOLDS } from './utils';
import type {
  SessionSummary,
  SessionHeader,
  LapData,
  Consistency,
  CornerConsistency,
  BestLapCorner,
  ThermalChannel,
  FrictionCircle,
  GpsPoint,
  TracePoint,
  XDrive,
} from '@/types/session';

// ─── Internal row type ───────────────────────────────────────────────────────

interface Row {
  ts: number;
  lap: number;
  lat: number;
  lon: number;
  spd: number;
  lat_g: number;
  long_g: number;
  thr: number;
  brk: number;
  rpm: number;
  gear: number;
  steer: number;
  oil_temp: number;
  trans_temp: number;
  coolant_temp: number;
  iat: number;
  boost: number;
  batt: number;
  ws_fl: number;
  ws_fr: number;
  ws_rl: number;
  ws_rr: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pf(s: string): number {
  if (s === '' || s === undefined || s === null) return NaN;
  return parseFloat(s);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[Math.min(idx, sorted.length - 1)];
}

function rollingMean(arr: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(arr.length, start + window);
    const slice = arr.slice(start, end);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

// ─── Column mapper ────────────────────────────────────────────────────────────

function mapColumns(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const lc = h.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (lc.includes('timestamp')) idx['ts'] = i;
    else if (lc.includes('lap')) idx['lap'] = i;
    else if (lc.includes('latitude')) idx['lat'] = i;
    else if (lc.includes('longitude')) idx['lon'] = i;
    else if (lc.includes('speed') && !lc.includes('wheel')) idx['spd'] = i;
    else if (lc.includes('lateral accel') || lc.includes('lateral acceleration')) idx['lat_g'] = i;
    else if (lc.includes('longitudinal accel') || lc.includes('longitudinal acceleration')) idx['long_g'] = i;
    else if (lc.includes('throttle')) idx['thr'] = i;
    else if (lc.includes('brake')) idx['brk'] = i;
    else if (lc.includes('engine rpm')) idx['rpm'] = i;
    else if (lc.includes('wheel speed fl')) idx['ws_fl'] = i;
    else if (lc.includes('wheel speed fr')) idx['ws_fr'] = i;
    else if (lc.includes('wheel speed rl')) idx['ws_rl'] = i;
    else if (lc.includes('wheel speed rr')) idx['ws_rr'] = i;
    else if (lc.includes('gear')) idx['gear'] = i;
    else if (lc.includes('steering')) idx['steer'] = i;
    else if (lc.includes('yaw')) { /* skip */ }
    else if (lc.includes('can lateral')) { /* skip */ }
    else if (lc.includes('oil')) idx['oil_temp'] = i;
    else if (lc.includes('transmission')) idx['trans_temp'] = i;
    else if (lc.includes('coolant')) idx['coolant_temp'] = i;
    else if (lc.includes('intake air') || lc.includes('intake')) idx['iat'] = i;
    else if (lc.includes('boost')) idx['boost'] = i;
    else if (lc.includes('battery')) idx['batt'] = i;
  });
  return idx;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

// Strip surrounding quotes and whitespace from a CSV cell value
function stripQuotes(s: string): string {
  return s.trim().replace(/^["']|["']$/g, '').trim();
}

// Auto-detect delimiter: try tab first, then comma
function detectDelimiter(line: string): string {
  if (line.split('\t').length > 5) return '\t';
  if (line.split(',').length > 5) return ',';
  return '\t';
}

export function parseRacechronoCsv(csvText: string): SessionSummary {
  const lines = csvText.split(/\r?\n/);

  // Validate format
  if (!lines[0] || !lines[0].includes('RaceChrono')) {
    throw new Error('Not a RaceChrono export file. Expected "RaceChrono" in the first line.');
  }

  // ── Detect delimiter from headers line (index 9) ─────────────────────────
  const delim = detectDelimiter(lines[9] ?? '');

  const splitLine = (line: string) => line.split(delim).map(stripQuotes);

  // ── Parse metadata (lines 2-9, 0-indexed: lines[1]-lines[8]) ───────────────
  let trackName = 'Unknown Track';
  let sessionDate = '';

  for (let i = 1; i <= 9; i++) {
    if (!lines[i]) continue;
    const parts = splitLine(lines[i]);
    if (parts.length < 2) continue;
    const key = parts[0].trim().toLowerCase();
    const val = parts[1].trim();
    if (key.includes('track name')) trackName = val || trackName;
    if (key.includes('created')) sessionDate = val;
  }

  // Try to format date as ISO
  let isoDate = sessionDate;
  if (sessionDate) {
    const d = new Date(sessionDate);
    if (!isNaN(d.getTime())) isoDate = d.toISOString().split('T')[0];
  }

  // ── Find header line and units line ─────────────────────────────────────────
  // Line index 9 (0-based) = line 10 (1-based) = column headers
  // Line index 10 = units
  // Lines from index 11 onward = data
  const headerLineIndex = 9;
  const dataStartIndex = 11;

  const rawHeaders = splitLine(lines[headerLineIndex] ?? '');
  if (rawHeaders.length < 5) {
    throw new Error('RaceChrono CSV header line not found or malformed.');
  }

  const colIdx = mapColumns(rawHeaders);

  // Determine which channels are present
  const channelsFound: string[] = [];
  const channelKeys = ['ts', 'lap', 'lat', 'lon', 'spd', 'lat_g', 'long_g', 'thr', 'brk',
    'rpm', 'gear', 'steer', 'oil_temp', 'trans_temp', 'coolant_temp', 'iat', 'boost', 'batt',
    'ws_fl', 'ws_fr', 'ws_rl', 'ws_rr'];
  for (const key of channelKeys) {
    if (colIdx[key] !== undefined) channelsFound.push(key);
  }

  // ── Parse data rows ──────────────────────────────────────────────────────────
  const rows: Row[] = [];

  function getNum(cells: string[], key: string): number {
    const i = colIdx[key];
    if (i === undefined || i >= cells.length) return NaN;
    return pf(cells[i]);
  }

  for (let li = dataStartIndex; li < lines.length; li++) {
    const line = lines[li];
    if (!line || line.trim() === '') continue;
    const cells = splitLine(line);
    if (cells.length < 2) continue;

    const ts = getNum(cells, 'ts');
    const lap = getNum(cells, 'lap');
    if (!isFinite(ts) || !isFinite(lap) || lap < 1) continue;

    rows.push({
      ts,
      lap,
      lat: getNum(cells, 'lat'),
      lon: getNum(cells, 'lon'),
      spd: getNum(cells, 'spd') || 0,
      lat_g: getNum(cells, 'lat_g') || 0,
      long_g: getNum(cells, 'long_g') || 0,
      thr: getNum(cells, 'thr') || 0,
      brk: getNum(cells, 'brk') || 0,
      rpm: getNum(cells, 'rpm') || 0,
      gear: getNum(cells, 'gear') || 0,
      steer: getNum(cells, 'steer') || 0,
      oil_temp: getNum(cells, 'oil_temp'),
      trans_temp: getNum(cells, 'trans_temp'),
      coolant_temp: getNum(cells, 'coolant_temp'),
      iat: getNum(cells, 'iat'),
      boost: getNum(cells, 'boost'),
      batt: getNum(cells, 'batt'),
      ws_fl: getNum(cells, 'ws_fl'),
      ws_fr: getNum(cells, 'ws_fr'),
      ws_rl: getNum(cells, 'ws_rl'),
      ws_rr: getNum(cells, 'ws_rr'),
    });
  }

  if (rows.length === 0) {
    throw new Error('RaceChrono CSV contains no valid data rows.');
  }

  // ── Compute median dt (sample rate) ─────────────────────────────────────────
  const firstN = Math.min(20, rows.length - 1);
  const dts: number[] = [];
  for (let i = 1; i <= firstN; i++) {
    const dt = rows[i].ts - rows[i - 1].ts;
    if (dt > 0) dts.push(dt);
  }
  const medianDt = dts.length > 0 ? median(dts) : 0.04;
  const sampleRateHz = medianDt > 0 ? Math.round((1 / medianDt) * 10) / 10 : 25;

  // ── Group rows by lap ────────────────────────────────────────────────────────
  const lapMap = new Map<number, Row[]>();
  for (const row of rows) {
    const lapNum = Math.round(row.lap);
    if (!lapMap.has(lapNum)) lapMap.set(lapNum, []);
    lapMap.get(lapNum)!.push(row);
  }

  const lapNums = [...lapMap.keys()].sort((a, b) => a - b);

  // ── Compute lap times ────────────────────────────────────────────────────────
  const rawLapTimes = new Map<number, number>();
  for (const lapNum of lapNums) {
    const lapRows = lapMap.get(lapNum)!;
    if (lapRows.length < 2) {
      rawLapTimes.set(lapNum, Infinity);
      continue;
    }
    const first = lapRows[0].ts;
    const last = lapRows[lapRows.length - 1].ts;
    const lapTime = last - first + medianDt;
    rawLapTimes.set(lapNum, lapTime);
  }

  // ── Detect outlier laps ──────────────────────────────────────────────────────
  const validTimes = [...rawLapTimes.values()].filter(isFinite);
  const medianLapTime = validTimes.length > 0 ? median(validTimes) : Infinity;

  const lapDataList: LapData[] = [];

  for (const lapNum of lapNums) {
    const lapRows = lapMap.get(lapNum)!;
    const lapTime = rawLapTimes.get(lapNum)!;

    let isOutlier = false;
    let outlierReason = '';

    if (!isFinite(lapTime) || lapTime <= 0) {
      isOutlier = true;
      outlierReason = 'insufficient data';
    } else if (lapTime > medianLapTime * 1.15) {
      isOutlier = true;
      outlierReason = lapNum === lapNums[0] ? 'out lap' : lapNum === lapNums[lapNums.length - 1] ? 'cool-down lap' : 'outlier lap time';
    }

    // Per-lap stats
    const speeds = lapRows.map(r => r.spd).filter(isFinite);
    const lat_gs = lapRows.map(r => r.lat_g).filter(isFinite);
    const long_gs = lapRows.map(r => r.long_g).filter(isFinite);
    const totalGs = lapRows.map(r => Math.sqrt((r.lat_g || 0) ** 2 + (r.long_g || 0) ** 2));

    // Coast time: thr < 5 AND brk < 0.5
    let coastTime = 0;
    for (let i = 0; i < lapRows.length; i++) {
      const r = lapRows[i];
      const dt = i > 0 ? lapRows[i].ts - lapRows[i - 1].ts : medianDt;
      if (r.thr < 5 && r.brk < 0.5) coastTime += dt > 0 ? dt : medianDt;
    }

    // Steering reversals: sign changes in smoothed steer_deg
    const steerSmoothed = rollingMean(lapRows.map(r => r.steer), 5);
    let steeringReversals = 0;
    for (let i = 1; i < steerSmoothed.length; i++) {
      if (Math.sign(steerSmoothed[i]) !== Math.sign(steerSmoothed[i - 1]) &&
          Math.abs(steerSmoothed[i] - steerSmoothed[i - 1]) > 0.5) {
        steeringReversals++;
      }
    }

    // Peak G values
    const peakLatG = lat_gs.length > 0 ? Math.max(...lat_gs.map(Math.abs)) : 0;
    const brakingGs = long_gs.filter(g => g < 0);
    const peakLongGBrake = brakingGs.length > 0 ? Math.max(...brakingGs.map(v => Math.abs(v))) : 0;

    lapDataList.push({
      lap_num: lapNum,
      lap_time_s: isFinite(lapTime) ? lapTime : 0,
      sector_times: [],
      max_speed_kph: speeds.length > 0 ? Math.max(...speeds) : 0,
      avg_speed_kph: speeds.length > 0 ? mean(speeds) : 0,
      coast_time_s: coastTime,
      total_g_mean: totalGs.length > 0 ? mean(totalGs) : 0,
      total_g_p95: totalGs.length > 0 ? percentile(totalGs, 95) : 0,
      steering_reversals: steeringReversals,
      peak_lat_g: peakLatG,
      peak_long_g_brake: peakLongGBrake,
      is_outlier: isOutlier,
      outlier_reason: outlierReason,
    });
  }

  // ── Identify best lap ────────────────────────────────────────────────────────
  const nonOutlierLaps = lapDataList.filter(l => !l.is_outlier);
  const bestLapData = nonOutlierLaps.reduce<LapData | null>((best, l) =>
    best === null || l.lap_time_s < best.lap_time_s ? l : best, null);
  const bestLapNum = bestLapData?.lap_num ?? lapNums[0];
  const bestLapRows = lapMap.get(bestLapNum) ?? [];

  // ── Compute cumulative distance for best lap ──────────────────────────────────
  function computeCumDist(lapRows: Row[]): number[] {
    const dist: number[] = [0];
    for (let i = 1; i < lapRows.length; i++) {
      const dt = lapRows[i].ts - lapRows[i - 1].ts;
      const safedt = dt > 0 ? dt : medianDt;
      dist.push(dist[i - 1] + (lapRows[i - 1].spd / 3.6) * safedt);
    }
    return dist;
  }

  const bestLapDist = computeCumDist(bestLapRows);
  const totalBestDist = bestLapDist[bestLapDist.length - 1] || 1;

  // ── Corner detection ─────────────────────────────────────────────────────────
  const smoothWindow = Math.max(1, Math.round(sampleRateHz));
  const smoothLatG = rollingMean(bestLapRows.map(r => r.lat_g), smoothWindow);

  const LAT_G_THRESHOLD = 0.25;
  const MIN_CORNER_SAMPLES = Math.max(1, Math.round(0.5 * sampleRateHz));
  const MERGE_GAP_SAMPLES = Math.max(1, Math.round(1.5 * sampleRateHz));

  // Find continuous segments above threshold
  interface Segment { start: number; end: number }
  const rawSegments: Segment[] = [];
  let inSeg = false;
  let segStart = 0;

  for (let i = 0; i < smoothLatG.length; i++) {
    const above = Math.abs(smoothLatG[i]) > LAT_G_THRESHOLD;
    if (above && !inSeg) { inSeg = true; segStart = i; }
    else if (!above && inSeg) {
      if (i - segStart >= MIN_CORNER_SAMPLES) rawSegments.push({ start: segStart, end: i - 1 });
      inSeg = false;
    }
  }
  if (inSeg && bestLapRows.length - segStart >= MIN_CORNER_SAMPLES) {
    rawSegments.push({ start: segStart, end: bestLapRows.length - 1 });
  }

  // Merge segments that are close together
  const mergedSegments: Segment[] = [];
  for (const seg of rawSegments) {
    if (mergedSegments.length === 0) { mergedSegments.push({ ...seg }); continue; }
    const last = mergedSegments[mergedSegments.length - 1];
    if (seg.start - last.end <= MERGE_GAP_SAMPLES) {
      last.end = seg.end;
    } else {
      mergedSegments.push({ ...seg });
    }
  }

  // Convert to distance fractions
  interface CornerDef {
    id: string;
    name: string;
    startFrac: number;
    endFrac: number;
    startIdx: number;
    endIdx: number;
  }

  const cornerDefs: CornerDef[] = mergedSegments.map((seg, idx) => ({
    id: `t${idx + 1}`,
    name: `T${idx + 1}`,
    startFrac: bestLapDist[seg.start] / totalBestDist,
    endFrac: bestLapDist[seg.end] / totalBestDist,
    startIdx: seg.start,
    endIdx: seg.end,
  }));

  // ── BestLapCorners ────────────────────────────────────────────────────────────
  const bestLapCorners: BestLapCorner[] = cornerDefs.map(cd => {
    const cRows = bestLapRows.slice(cd.startIdx, cd.endIdx + 1);
    if (cRows.length === 0) return null;

    const cDists = bestLapDist.slice(cd.startIdx, cd.endIdx + 1);

    const pct20 = Math.max(1, Math.round(cRows.length * 0.2));
    const entryRows = cRows.slice(0, pct20);
    const exitRows = cRows.slice(cRows.length - pct20);

    const entrySpeeds = entryRows.map(r => r.spd).filter(isFinite);
    const exitSpeeds = exitRows.map(r => r.spd).filter(isFinite);
    const allSpeeds = cRows.map(r => r.spd).filter(v => isFinite(v));
    const minSpd = allSpeeds.length > 0 ? Math.min(...allSpeeds) : 0;
    const minSpdIdx = cRows.findIndex(r => r.spd === minSpd);

    const latGs = cRows.map(r => Math.abs(r.lat_g)).filter(isFinite);
    const peakLatG = latGs.length > 0 ? Math.max(...latGs) : 0;

    // Brake point: look back up to 150m before corner start
    const cornerStartDist = cDists[0] ?? 0;
    let brakePtM = 0;
    for (let i = cd.startIdx - 1; i >= 0; i--) {
      const dBack = cornerStartDist - bestLapDist[i];
      if (dBack > 150) break;
      if (bestLapRows[i].brk > 0.5) {
        brakePtM = bestLapDist[i];
        break;
      }
    }

    // Trail brake duration: brk > 0.5 AND |lat_g| > 0.3 simultaneously
    let trailBrakeDur = 0;
    for (let i = 0; i < cRows.length; i++) {
      const r = cRows[i];
      const dt = i > 0 ? cRows[i].ts - cRows[i - 1].ts : medianDt;
      const safedt = dt > 0 ? dt : medianDt;
      if (r.brk > 0.5 && Math.abs(r.lat_g) > 0.3) trailBrakeDur += safedt;
    }

    // Coast time during corner
    let cornerCoastTime = 0;
    for (let i = 0; i < cRows.length; i++) {
      const r = cRows[i];
      const dt = i > 0 ? cRows[i].ts - cRows[i - 1].ts : medianDt;
      const safedt = dt > 0 ? dt : medianDt;
      if (r.thr < 5 && r.brk < 0.5) cornerCoastTime += safedt;
    }

    // Throttle on point: first sample after min speed where throttle > 20%
    let throttleOnM = 0;
    const minSpdDist = cDists[minSpdIdx] ?? 0;
    for (let i = minSpdIdx + 1; i < cRows.length; i++) {
      if (cRows[i].thr > 20) {
        throttleOnM = cDists[i] - minSpdDist;
        break;
      }
    }

    const totalGs = cRows.map(r => Math.sqrt((r.lat_g || 0) ** 2 + (r.long_g || 0) ** 2));
    const totalGMean = totalGs.length > 0 ? mean(totalGs) : 0;
    const gearAtApex = cRows[minSpdIdx]?.gear ?? 0;

    return {
      corner_id: cd.id,
      corner_name: cd.name,
      entry_speed_kph: entrySpeeds.length > 0 ? mean(entrySpeeds) : 0,
      min_speed_kph: minSpd,
      exit_speed_kph: exitSpeeds.length > 0 ? mean(exitSpeeds) : 0,
      peak_lat_g: peakLatG,
      brake_point_m: brakePtM,
      trail_brake_duration_s: trailBrakeDur,
      coast_time_s: cornerCoastTime,
      throttle_on_m: throttleOnM,
      total_g_mean: totalGMean,
      gear_at_apex: gearAtApex,
    } satisfies BestLapCorner;
  }).filter((c): c is BestLapCorner => c !== null);

  // ── Consistency ───────────────────────────────────────────────────────────────
  const nonOutlierTimes = nonOutlierLaps.map(l => l.lap_time_s);
  const bestLapS = nonOutlierTimes.length > 0 ? Math.min(...nonOutlierTimes) : 0;
  const worstLapS = nonOutlierTimes.length > 0 ? Math.max(...nonOutlierTimes) : 0;
  const meanLapS = mean(nonOutlierTimes);
  const medianLapS = median(nonOutlierTimes);
  const spreadS = worstLapS - bestLapS;
  const stdDevS = stdDev(nonOutlierTimes);
  const consistencyScore = meanLapS > 0
    ? Math.max(0, Math.min(100, 100 - (stdDevS / meanLapS * 100)))
    : 0;

  // Corner consistency across non-outlier laps
  const cornerConsistency: Record<string, CornerConsistency> = {};

  for (const cd of cornerDefs) {
    const perLapMinSpeeds: number[] = [];
    const perLapBrakePoints: number[] = [];
    const perLapCoastTimes: number[] = [];
    const perLapTotalGs: number[] = [];

    for (const lapD of nonOutlierLaps) {
      const lapRows = lapMap.get(lapD.lap_num) ?? [];
      if (lapRows.length === 0) continue;

      const lapDist = computeCumDist(lapRows);
      const lapTotalDist = lapDist[lapDist.length - 1] || 1;

      const cStartDist = cd.startFrac * lapTotalDist;
      const cEndDist = cd.endFrac * lapTotalDist;

      const cStart = lapDist.findIndex(d => d >= cStartDist);
      let cEnd = -1;
      for (let j = lapDist.length - 1; j >= 0; j--) {
        if (lapDist[j] <= cEndDist) { cEnd = j; break; }
      }
      if (cStart < 0 || cEnd < 0 || cEnd <= cStart) continue;
      cEnd = Math.min(cEnd, lapRows.length - 1);

      const cRows = lapRows.slice(cStart, cEnd + 1);
      const cDists = lapDist.slice(cStart, cEnd + 1);

      if (cRows.length === 0) continue;

      const speeds = cRows.map(r => r.spd).filter(isFinite);
      const minSpd = speeds.length > 0 ? Math.min(...speeds) : 0;
      perLapMinSpeeds.push(minSpd);

      // Brake point
      const cornerStartDistL = cDists[0] ?? 0;
      let brakePtM = 0;
      for (let i = cStart - 1; i >= 0; i--) {
        const dBack = cornerStartDistL - lapDist[i];
        if (dBack > 150) break;
        if (lapRows[i].brk > 0.5) { brakePtM = lapDist[i]; break; }
      }
      perLapBrakePoints.push(brakePtM);

      // Coast time
      let ct = 0;
      for (let i = 0; i < cRows.length; i++) {
        const r = cRows[i];
        const dt = i > 0 ? cRows[i].ts - cRows[i - 1].ts : medianDt;
        const safedt = dt > 0 ? dt : medianDt;
        if (r.thr < 5 && r.brk < 0.5) ct += safedt;
      }
      perLapCoastTimes.push(ct);

      const totalGs = cRows.map(r => Math.sqrt((r.lat_g || 0) ** 2 + (r.long_g || 0) ** 2));
      perLapTotalGs.push(totalGs.length > 0 ? mean(totalGs) : 0);
    }

    const bestCorner = bestLapCorners.find(c => c.corner_id === cd.id);

    cornerConsistency[cd.id] = {
      name: cd.name,
      min_speed_best: bestCorner?.min_speed_kph ?? (perLapMinSpeeds.length > 0 ? Math.max(...perLapMinSpeeds) : 0),
      min_speed_avg: mean(perLapMinSpeeds),
      min_speed_std: stdDev(perLapMinSpeeds),
      min_speed_delta: (bestCorner?.min_speed_kph ?? 0) - mean(perLapMinSpeeds),
      brake_point_std_m: stdDev(perLapBrakePoints),
      coast_time_avg: mean(perLapCoastTimes),
      total_g_avg: mean(perLapTotalGs),
    };
  }

  const consistency: Consistency = {
    lap_count: nonOutlierLaps.length,
    best_lap_s: bestLapS,
    worst_lap_s: worstLapS,
    mean_lap_s: meanLapS,
    median_lap_s: medianLapS,
    spread_s: spreadS,
    std_dev_s: stdDevS,
    consistency_score: consistencyScore,
    corners: cornerConsistency,
  };

  // ── Thermals ──────────────────────────────────────────────────────────────────
  const thermalChannels: Array<{ key: keyof Row; unit: string }> = [
    { key: 'oil_temp', unit: '°C' },
    { key: 'trans_temp', unit: '°C' },
    { key: 'coolant_temp', unit: '°C' },
    { key: 'iat', unit: '°C' },
    { key: 'boost', unit: 'bar' },
  ];

  const thermals: ThermalChannel[] = [];

  for (const { key, unit } of thermalChannels) {
    if (colIdx[key] === undefined) continue;

    const vals = rows.map(r => r[key] as number).filter(isFinite);
    if (vals.length === 0) continue;

    const startVal = vals[0];
    const peakVal = Math.max(...vals);
    const endVal = vals[vals.length - 1];

    const peakIdx = (r: Row) => (r[key] as number) === peakVal;
    const peakRow = rows.find(peakIdx);
    const timeToPeakMin = peakRow ? peakRow.ts / 60 : 0;

    // Time above watch threshold
    const th = THERMAL_THRESHOLDS[key];
    let timeAboveWatch = 0;
    if (th) {
      for (let i = 0; i < rows.length; i++) {
        const v = rows[i][key] as number;
        if (!isFinite(v)) continue;
        const comparable = key === 'boost' ? v : celsiusToF(v);
        const dt = i > 0 ? rows[i].ts - rows[i - 1].ts : medianDt;
        const safedt = dt > 0 ? dt : medianDt;
        if (comparable >= th.watch) timeAboveWatch += safedt;
      }
    }

    thermals.push({
      channel: key,
      unit,
      start_val: startVal,
      peak_val: peakVal,
      end_val: endVal,
      time_to_peak_min: timeToPeakMin,
      time_above_watch: timeAboveWatch,
      alert_level: thermalAlertLevel(key, peakVal),
    });
  }

  // ── Friction Circle ───────────────────────────────────────────────────────────
  const nonOutlierLapNums = new Set(nonOutlierLaps.map(l => l.lap_num));
  const frictionRows = rows.filter(r => nonOutlierLapNums.has(Math.round(r.lap)));

  const frictionTotalGs = frictionRows.map(r => Math.sqrt((r.lat_g || 0) ** 2 + (r.long_g || 0) ** 2));

  const frictionCircle: FrictionCircle = {
    total_g_mean: mean(frictionTotalGs),
    total_g_p95: percentile(frictionTotalGs, 95),
    total_g_max: frictionTotalGs.length > 0 ? Math.max(...frictionTotalGs) : 0,
    peak_lat_g: frictionRows.length > 0 ? Math.max(...frictionRows.map(r => Math.abs(r.lat_g || 0))) : 0,
    peak_long_g_brake: frictionRows.length > 0 ? Math.max(...frictionRows.map(r => Math.abs(Math.min(r.long_g || 0, 0)))) : 0,
    peak_long_g_accel: frictionRows.length > 0 ? Math.max(...frictionRows.map(r => Math.max(r.long_g || 0, 0))) : 0,
    time_above_08g_pct: frictionTotalGs.length > 0 ? (frictionTotalGs.filter(g => g > 0.8).length / frictionTotalGs.length) * 100 : 0,
    time_above_10g_pct: frictionTotalGs.length > 0 ? (frictionTotalGs.filter(g => g > 1.0).length / frictionTotalGs.length) * 100 : 0,
    scatter_points: frictionRows
      .filter((_, i) => i % 8 === 0)
      .slice(0, 2000)
      .map(r => ({
        lat_g: r.lat_g || 0,
        long_g: r.long_g || 0,
        total_g: Math.sqrt((r.lat_g || 0) ** 2 + (r.long_g || 0) ** 2),
      })),
  };

  // ── XDrive ────────────────────────────────────────────────────────────────────
  let xdrive: XDrive | undefined;
  const hasWheelSpeeds = ['ws_fl', 'ws_fr', 'ws_rl', 'ws_rr'].every(k => colIdx[k] !== undefined);

  if (hasWheelSpeeds) {
    const xRows = frictionRows.filter(r => r.spd > 30 &&
      isFinite(r.ws_fl) && isFinite(r.ws_fr) && isFinite(r.ws_rl) && isFinite(r.ws_rr));

    if (xRows.length > 0) {
      const frDeltas = xRows.map(r => {
        const front = (r.ws_fl + r.ws_fr) / 2;
        const rear = (r.ws_rl + r.ws_rr) / 2;
        return (Math.abs(front - rear) / r.spd) * 100;
      });

      xdrive = {
        front_rear_delta_mean_pct: mean(frDeltas),
        front_rear_delta_max_pct: Math.max(...frDeltas),
        front_lr_delta_max_kph: Math.max(...xRows.map(r => Math.abs(r.ws_fl - r.ws_fr))),
        rear_lr_delta_max_kph: Math.max(...xRows.map(r => Math.abs(r.ws_rl - r.ws_rr))),
      };
    }
  }

  // ── GPS Trace (best lap, every 4th row) ───────────────────────────────────────
  const gpsTrace: GpsPoint[] = bestLapRows
    .filter((_, i) => i % 4 === 0)
    .filter(r => isFinite(r.lat) && isFinite(r.lon))
    .map(r => ({
      lat: r.lat,
      lon: r.lon,
      speed_kph: r.spd,
      throttle_pct: r.thr,
      brake_bar: r.brk,
    }));

  // ── Best Lap Trace (all rows from best lap) ───────────────────────────────────
  const bestLapTrace: TracePoint[] = bestLapRows.map((r, i) => ({
    distance_m: bestLapDist[i],
    speed_kph: r.spd,
    throttle_pct: r.thr,
    brake_bar: r.brk,
  }));

  // ── Session Header ─────────────────────────────────────────────────────────────
  const outlierLapNums = lapDataList
    .filter(l => l.is_outlier)
    .map(l => ({ lap: l.lap_num, reason: l.outlier_reason }));

  const firstTs = rows[0].ts;
  const lastTs = rows[rows.length - 1].ts;

  const header: SessionHeader = {
    track: trackName,
    date: isoDate,
    session_type: 'track',
    export_format: 'racechrono-csv-v9',
    channels_found: channelsFound,
    channels_missing: [],
    total_laps: lapNums.length,
    analyzed_laps: nonOutlierLaps.length,
    excluded_laps: outlierLapNums,
    total_rows: rows.length,
    duration_minutes: (lastTs - firstTs) / 60,
    sample_rate_hz: sampleRateHz,
  };

  return {
    header,
    laps: lapDataList,
    consistency,
    best_lap_corners: bestLapCorners,
    thermals,
    friction_circle: frictionCircle,
    xdrive,
    gps_trace: gpsTrace.length > 0 ? gpsTrace : undefined,
    best_lap_trace: bestLapTrace.length > 0 ? bestLapTrace : undefined,
  };
}
