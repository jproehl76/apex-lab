#!/usr/bin/env node
/**
 * Merges Oura and WHOOP data from /tmp/ into public/data/health-cache.json.
 * Run by the GitHub Actions health-cache workflow.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '..', 'public', 'data', 'health-cache.json');

function tryRead(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// ── Oura ──────────────────────────────────────────────────────────────────────
const ouraReadiness = tryRead('/tmp/oura-readiness.json');
const ouraSleep     = tryRead('/tmp/oura-sleep.json');
const ouraActivity  = tryRead('/tmp/oura-activity.json');

let ouraData = null;
if (ouraReadiness?.data) {
  // Build a map keyed by date, merging readiness + sleep + activity
  const byDate = {};

  for (const r of ouraReadiness.data ?? []) {
    byDate[r.day] = {
      date: r.day,
      readiness_score: r.score ?? null,
      hrv_average: r.contributors?.hrv_balance ?? null,
      resting_hr: r.contributors?.resting_heart_rate ?? null,
      temperature_deviation: r.temperature_deviation ?? null,
    };
  }

  for (const s of (ouraSleep?.data ?? [])) {
    if (!byDate[s.day]) byDate[s.day] = { date: s.day };
    byDate[s.day].sleep_score = s.score ?? null;
    byDate[s.day].sleep_efficiency = s.contributors?.efficiency ?? null;
    // Oura reports deep/rem sleep in seconds
    byDate[s.day].deep_sleep_hours = s.contributors?.deep_sleep
      ? s.contributors.deep_sleep / 3600
      : null;
    byDate[s.day].rem_sleep_hours = s.contributors?.rem_sleep
      ? s.contributors.rem_sleep / 3600
      : null;
  }

  for (const a of (ouraActivity?.data ?? [])) {
    if (!byDate[a.day]) byDate[a.day] = { date: a.day };
    byDate[a.day].activity_score = a.score ?? null;
  }

  ouraData = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
}

// ── WHOOP ─────────────────────────────────────────────────────────────────────
const whoopRaw = tryRead('/tmp/whoop-data.json');
const whoopData = whoopRaw && !whoopRaw.error ? whoopRaw : null;

// ── Write output ──────────────────────────────────────────────────────────────
const cache = {
  updatedAt: new Date().toISOString(),
  oura:  ouraData,
  whoop: whoopData,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(cache, null, 2));
console.log(`Health cache written: ${(ouraData?.length ?? 0)} Oura days, WHOOP: ${whoopData ? 'yes' : 'no'}`);
