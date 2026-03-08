# Branch 4: feature/ai-coaching

## Prerequisites
Branch 3 (`feature/tremor-integration`) must be merged to main first.

```bash
git checkout main && git pull
git checkout -b feature/ai-coaching
```

## Architecture

```
User uploads RaceChrono CSV → preprocess.py runs → compact JSON (~5-15KB)
       ↓
User clicks "Get Coaching"
       ↓
Frontend sends JSON to Anthropic API:
  - Direct (user's own API key, stored in IndexedDB)
  - OR via Vercel proxy (server-side key, for hosted deployments)
       ↓
Model is user-selected (Haiku / Sonnet / Opus) — NOT hardcoded
       ↓
Streaming response renders in CoachingChat panel
```

## File 1: `src/lib/services/coachingPrompt.ts`

The coaching system prompt template. This is the brain of the app.

```typescript
import type { UserProfile } from '../schemas';
import type { AppMemory } from '../schemas';
import { THERMAL, CONSISTENCY } from '../constants';

export function buildSystemPrompt(
  userProfile: UserProfile | null,
  trackHistory: AppMemory['trackHistory'],
  trackName?: string,
): string {
  const carContext = userProfile?.carName
    ? `
## Driver's Car
${userProfile.carName}
${userProfile.carWeight ? `Weight: ${userProfile.carWeight} lbs` : ''}
${userProfile.carHp ? `Power: ${userProfile.carHp} hp` : ''}
${userProfile.carDrivetrain ? `Drivetrain: ${userProfile.carDrivetrain}` : ''}
${userProfile.carEngineDisplacement ? `Engine: ${userProfile.carEngineDisplacement} ${userProfile.carEngineCylinders ? `${userProfile.carEngineCylinders}-cyl` : ''}` : ''}
`.trim()
    : '';

  const historyContext = trackName && trackHistory.length > 0
    ? `
## Driver's History at ${trackName}
${trackHistory
  .filter(h => h.track.toLowerCase().includes(trackName.toLowerCase()))
  .map(h => `${h.date}: Best ${h.bestLap} (${h.lapCount} laps)`)
  .join('\n') || 'No prior sessions at this track.'}
`.trim()
    : '';

  return `You are an expert HPDE driving coach analyzing telemetry data from a track session. You are embedded in the JP Apex Lab PWA.

${carContext}

${historyContext}

## Analysis Framework — Work Through in Order

### Tier 1 — Consistency (ALWAYS FIRST)
Present session header:
TRACK: [name] | DATE: [date] | SESSION: [context]
BEST LAP: [M:SS.s] | AVG: [M:SS.s] | SPREAD: [X.Xs]
LAPS: [N analyzed] ([M excluded]: [reasons])
TOP FINDING: [single most important insight — one sentence]

Evaluate:
- Lap spread <${CONSISTENCY.lapSpread.good}s = good; ${CONSISTENCY.lapSpread.good}-${CONSISTENCY.lapSpread.watchable}s = work needed; >${CONSISTENCY.lapSpread.watchable}s = consistency crisis
- Corner min speed std dev <${CONSISTENCY.cornerMinSpeed.good} mph = good; ${CONSISTENCY.cornerMinSpeed.good}-${CONSISTENCY.cornerMinSpeed.watchable} = watchable; >${CONSISTENCY.cornerMinSpeed.watchable} = primary fix
- Braking point std dev <${CONSISTENCY.brakingPoint.good} ft = good; ${CONSISTENCY.brakingPoint.good}-${CONSISTENCY.brakingPoint.inconsistent} = inconsistent; >${CONSISTENCY.brakingPoint.inconsistent} = reference point issue

### Tier 2 — Speed (only after consistency passes)
Compare best lap vs average, corner by corner:
- Corner min speed delta >2 mph = reportable opportunity
- Coast time >0.3s = time left on table
- Throttle-on point >50 ft past apex = late to power

### Tier 3 — Car Optimization
Check thermals:
- Oil temp: <${THERMAL.oil.good}°F good | ${THERMAL.oil.good}-${THERMAL.oil.watch}°F watch | >${THERMAL.oil.critical}°F critical
- Trans temp: <${THERMAL.trans.good}°F good | ${THERMAL.trans.good}-${THERMAL.trans.watch}°F watch | >${THERMAL.trans.critical}°F critical
- Coolant: <${THERMAL.coolant.good}°F good | ${THERMAL.coolant.good}-${THERMAL.coolant.watch}°F watch | >${THERMAL.coolant.critical}°F critical

### Tier 4 — Driver-Biometric Correlation
Only if Whoop/health data is available.

## Coaching Output Rules
1. Lead with the SINGLE biggest time gain. One thing, not a list.
2. Quantify everything. Not "braking too early" — "T1 brake point averages 150 ft, best lap was 125 ft; target 120 ft consistently."
3. Cap action items at 3. More = none get fixed.
4. Never recommend car modifications unless thermal or mechanical data explicitly supports it.
5. Use US measurements (feet, mph, °F, PSI, lbs).
6. Deliver Tier 1 immediately, then Tier 2. Ask before going deeper.`;
}
```

## File 2: `src/lib/services/coachingApi.ts`

```typescript
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../schemas';
import { buildSystemPrompt } from './coachingPrompt';
import type { UserProfile, AppMemory } from '../schemas';

interface CoachingOptions {
  apiKey?: string;
  modelId?: string;
  proxyUrl?: string;
  signal?: AbortSignal;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Validate model ID against our allowlist
function resolveModel(modelId?: string): string {
  if (!modelId) return DEFAULT_MODEL;
  const valid = AVAILABLE_MODELS.find(m => m.id === modelId);
  return valid ? valid.id : DEFAULT_MODEL;
}

export async function* streamCoachingResponse(
  messages: Message[],
  userProfile: UserProfile | null,
  trackHistory: AppMemory['trackHistory'],
  trackName: string | undefined,
  options: CoachingOptions,
): AsyncGenerator<string> {
  const systemPrompt = buildSystemPrompt(userProfile, trackHistory, trackName);
  const model = resolveModel(options.modelId);

  const body = {
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
    stream: true,
  };

  // Determine endpoint
  const url = options.apiKey
    ? 'https://api.anthropic.com/v1/messages'
    : options.proxyUrl || '';

  if (!url) throw new Error('No API key or proxy URL configured');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.apiKey ? {
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    } : {}),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          yield parsed.delta.text;
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  }
}
```

## File 3: `src/components/CoachingChat.tsx`

A streaming chat UI that replaces or augments the existing `CoachingInsights` component.

Key requirements:
- "Get Coaching" button analyzes current session's JSON summary
- Streams the response token by token into a styled output area
- Simple markdown rendering (bold, headers, bullet points) via regex — no heavy markdown lib
- Text input for follow-up questions ("What about Turn 3?")
- Conversation history maintained in React state, sent with each follow-up
- Model badge showing which model is active (from user profile)
- Abort button (red X) to cancel mid-stream via AbortController
- If user hasn't configured AI coaching in their profile, show a setup prompt linking to ProfileSetup
- Loading skeleton: "Analyzing your session..." with a pulsing indicator

Design:
- Match the existing app's dark theme (void/base/card surface colors)
- Use the chart theme tokens for consistent typography
- Streaming text should appear with a subtle fade-in per chunk
- Follow-up input should be a single-line text field with send button, not a full textarea

## File 4: Update `src/components/CoachingInsights.tsx`

The existing CoachingInsights component shows rule-based coaching (consistency rating, corner opportunities, etc). Modify it to:
1. Keep the existing rule-based insights as the default view
2. Add a "Get AI Coaching" button below the rule-based section
3. When clicked, render `CoachingChat` below the rule-based insights
4. Pass the current session summary, user profile, and track history as props

## File 5: Vercel serverless proxy

Create `api/coaching.ts` in the `m3-dashboard-api/` Vercel project (or a new `api/` directory at repo root if using Vercel's zero-config):

```typescript
// api/coaching.ts — Vercel Edge Function
export const config = { runtime: 'edge' };

const ALLOWED_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-20250514',
  'claude-opus-4-6',
];

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response('Server API key not configured', { status: 500 });
  }

  const body = await req.json();

  // Validate model against allowlist
  if (!ALLOWED_MODELS.includes(body.model)) {
    return new Response(`Invalid model: ${body.model}`, { status: 400 });
  }

  // TODO: Add rate limiting (10 req/hour per user via IP or auth token)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  // Stream the response back
  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

---

## Verify

```bash
pnpm install
npx tsc --noEmit
npx vite build
```

## Commit

```bash
git add -A
git commit -m "feat: AI coaching with streaming chat, model selector, Vercel proxy"
git push -u origin feature/ai-coaching
```

---

## POST-MERGE: Rename the GitHub repo

After this branch merges to main:

1. GitHub → repo Settings → rename `m3-dashboard` → `apex-lab`
2. GitHub auto-redirects the old URL
3. Update local remote: `git remote set-url origin https://github.com/jproehl76/apex-lab.git`
4. All path references already point to `/apex-lab/` (updated in Branch 2)
