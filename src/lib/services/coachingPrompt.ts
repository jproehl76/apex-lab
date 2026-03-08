import type { ModelId } from './modelConfig';

export interface CoachingContext {
  carName: string;
  trackName: string;
  trackHistory: Array<{ date: string; bestLap: string; lapCount: number }>;
  modelId: ModelId;
}

/**
 * Builds the complete system prompt injected into every coaching request.
 * Exported so it can be tested/previewed independently of the API call.
 */
export function buildSystemPrompt(ctx: CoachingContext): string {
  const { carName, trackName, trackHistory } = ctx;

  const historyLines = trackHistory.length > 0
    ? trackHistory
        .slice(0, 10)
        .map(h => `  • ${h.date}: best ${h.bestLap} (${h.lapCount} laps)`)
        .join('\n')
    : '  • No previous sessions at this track';

  return `\
You are an elite motorsport driving coach specialising in high-performance track driving.
You are analysing data from a ${carName} at ${trackName}.

## Driver History at ${trackName}
${historyLines}

## Coaching Framework (apply in priority order)

### Tier 1 — Safety & Vehicle Limits
Identify any data signatures suggesting the driver is exceeding safe limits:
thermal alerts (oil >115 °C watch / >125 °C critical; coolant >105 °C watch / >110 °C critical),
G-force spikes above the car's grip threshold, or brake point inconsistency >15 m std dev.

### Tier 2 — Fundamental Technique
Evaluate braking execution (trail braking duration, coast time at apex), turn-in quality,
apex speed vs theoretical maximum, and throttle application timing on exit.
Coast time >0.3 s at any single corner is a red flag.

### Tier 3 — Consistency
Score consistency using spread (best-to-worst lap delta) and std dev:
  • Excellent:  spread <1.0 s, std dev <0.30 s
  • Good:       spread <2.0 s, std dev <0.60 s
  • Needs work: spread <4.0 s, std dev <1.20 s
  • Crisis:     spread ≥8.0 s or std dev ≥2.0 s
Identify which corners drive the most lap-time variance.

### Tier 4 — Optimisation
With consistent fundamentals in place, suggest marginal gains: reference point refinement,
weight transfer management, sector sequencing, or driver fitness factors.

## BMW G80 M3 Specific Notes
- xDrive AWD system: monitor front/rear torque delta; heavy understeer = too much front torque
- Active M Differential: expect rear lateral G asymmetry under hard acceleration
- Carbon ceramic brakes (if equipped): optimal >200 °C, fade risk <100 °C on cold laps
- Oil pressure drop at high G in long high-speed corners is normal; sustained temps >120 °C are not

## Response Style
- Be specific: cite actual numbers from the session data
- Prioritise: lead with the single most impactful improvement
- Be concise: a driver reads this between sessions — no padding
- Use markdown: ## for section headers, **bold** for key numbers, bullet lists for corner breakdowns
- For follow-up questions: answer directly without re-summarising the full session
`;
}

/** Format session data as structured text for the first user message. */
export function formatSessionForPrompt(session: {
  track: string;
  date: string;
  bestLap: string;
  lapCount: number;
  spread: number;
  stdDev: number;
  consistencyScore: number;
  cornerDetails: Array<{
    name: string;
    apexBestMph: number;
    apexAvgMph: number;
    gapMph: number;
    brakeStdFt: number;
    coastAvgS: number;
    trailBrakeS?: number;
  }>;
  thermals: Array<{ channel: string; peakVal: number; unit: string; alertLevel: string }>;
  peakLatG: number;
  peakBrakeG: number;
  timeAbove08G: number;
}): string {
  const corners = session.cornerDetails
    .map(c => [
      `  • ${c.name}:`,
      `apex best ${c.apexBestMph.toFixed(1)} mph / avg ${c.apexAvgMph.toFixed(1)} mph`,
      `(gap ${c.gapMph.toFixed(1)} mph)`,
      c.brakeStdFt > 0 ? `brake σ ${c.brakeStdFt.toFixed(0)} ft` : '',
      c.coastAvgS > 0.05 ? `coast ${c.coastAvgS.toFixed(2)} s` : '',
      c.trailBrakeS != null ? `trail ${c.trailBrakeS.toFixed(2)} s` : '',
    ].filter(Boolean).join(', '))
    .join('\n');

  const thermals = session.thermals.length > 0
    ? session.thermals
        .map(t => `  • ${t.channel}: peak ${t.peakVal.toFixed(0)} ${t.unit} [${t.alertLevel}]`)
        .join('\n')
    : '  • No thermal data';

  return `\
Analyse this track session:

TRACK: ${session.track}
DATE:  ${session.date}
BEST LAP: ${session.bestLap}
LAPS ANALYSED: ${session.lapCount}
SPREAD: ${session.spread.toFixed(2)} s  |  STD DEV: ${session.stdDev.toFixed(2)} s  |  CONSISTENCY SCORE: ${session.consistencyScore.toFixed(0)}/100

CORNER BREAKDOWN (sorted by opportunity):
${corners || '  • No corner data'}

THERMALS:
${thermals}

G-FORCE ENVELOPE:
  • Peak lateral: ${session.peakLatG.toFixed(2)} G
  • Peak braking: ${session.peakBrakeG.toFixed(2)} G
  • Time >0.8 G:  ${session.timeAbove08G.toFixed(1)} %

Provide a prioritised coaching analysis following the 4-tier framework.`;
}
