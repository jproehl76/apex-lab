# Branch 2: feature/rebrand-cleanup

Execute ALL of the following in a single branch. Do NOT ask questions — execute everything sequentially. Verify the build compiles after each major section.

```bash
git checkout main && git pull
git checkout -b feature/rebrand-cleanup
```

---

## SECTION A — MODERN ARCHITECTURE UPGRADES

### A1. Add Zod for runtime schema validation
```bash
pnpm add zod
```

Create `src/lib/schemas.ts` — the single source of truth for all data shapes in the app:

```typescript
import { z } from 'zod';

// ── User Profile ──
export const UserProfileSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  picture: z.string().url().optional(),
  carName: z.string().optional(),
  carVin: z.string().length(17).optional(),
  carYear: z.number().int().min(1980).max(2030).optional(),
  carMake: z.string().optional(),
  carModel: z.string().optional(),
  carTrim: z.string().optional(),
  carWeight: z.number().positive().optional(),       // lbs
  carHp: z.number().positive().optional(),
  carDrivetrain: z.enum(['FWD', 'RWD', 'AWD', '4WD']).optional(),
  carEngineDisplacement: z.string().optional(),      // e.g. "3.0L"
  carEngineCylinders: z.number().int().optional(),
  // AI Coaching settings
  aiCoachingEnabled: z.boolean().default(false),
  anthropicApiKey: z.string().optional(),
  preferredModel: z.string().default('claude-sonnet-4-20250514'),
  // Health provider
  healthProvider: z.enum(['whoop', 'strava', 'oura']).nullable().default(null),
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// ── Session Summary (matches preprocess.py output) ──
export const SessionHeaderSchema = z.object({
  track: z.string(),
  date: z.string(),
  analyzed_laps: z.number().int(),
  excluded_laps: z.array(z.object({
    lap_num: z.number(),
    reason: z.string(),
  })).optional(),
});

export const ConsistencySchema = z.object({
  best_lap_s: z.number(),
  avg_lap_s: z.number(),
  std_dev_s: z.number(),
  spread_s: z.number(),
  consistency_score: z.number().optional(),
});

// ── Track History Entry ──
export const TrackHistoryEntrySchema = z.object({
  sessionId: z.string(),
  track: z.string(),
  date: z.string(),
  bestLap: z.string(),
  lapCount: z.number().int(),
});

// ── App Memory ──
export const AppMemorySchema = z.object({
  lastActiveTab: z.string().default('overview'),
  lastViewedLapIndex: z.number().default(0),
  debriefNotes: z.record(z.string(), z.string()).default({}),
  preferences: z.object({
    tempUnit: z.enum(['f', 'c']).default('f'),
    chartHeight: z.enum(['compact', 'normal', 'expanded']).default('normal'),
  }).default({}),
  trackHistory: z.array(TrackHistoryEntrySchema).default([]),
  whoopBaselines: z.object({
    restingHR: z.number().nullable().default(null),
    hrv: z.number().nullable().default(null),
    lastUpdated: z.string().nullable().default(null),
  }).default({}),
});
export type AppMemory = z.infer<typeof AppMemorySchema>;

// ── NHTSA VIN Decode Response (subset we use) ──
export const NHTSAResultSchema = z.object({
  Variable: z.string(),
  Value: z.string().nullable(),
});
export const NHTSADecodeSchema = z.object({
  Results: z.array(NHTSAResultSchema),
});

// ── AI Model Config ──
export const AIModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  tier: z.enum(['fast', 'balanced', 'advanced']),
  description: z.string(),
});

export const AVAILABLE_MODELS: z.infer<typeof AIModelSchema>[] = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'fast', description: 'Fastest responses, lowest cost. Good for quick checks.' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', tier: 'balanced', description: 'Best balance of speed and depth. Recommended for most coaching.' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', tier: 'advanced', description: 'Deepest analysis. Best for complex multi-session comparisons.' },
];

export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
```

### A2. Add Dexie.js for typed IndexedDB
```bash
pnpm add dexie dexie-react-hooks
```

Create `src/lib/database.ts` — replaces the raw IndexedDB wrappers in db.ts and memory.ts:

```typescript
import Dexie, { type EntityTable } from 'dexie';
import type { UserProfile, AppMemory } from './schemas';

// Single database with typed tables
export const db = new Dexie('apex-lab') as Dexie & {
  sessions: EntityTable<{ id: string; data: unknown; addedAt: string }, 'id'>;
  memory: EntityTable<{ key: string; value: unknown }, 'key'>;
  profiles: EntityTable<UserProfile & { email: string }, 'email'>;
};

db.version(1).stores({
  sessions: 'id',
  memory: 'key',
  profiles: 'email',
});

// Migration from old databases
async function migrateOldData() {
  // Check for old 'm3_dashboard' memory DB
  const oldDbExists = await Dexie.exists('m3_dashboard');
  if (oldDbExists) {
    try {
      const oldDb = new Dexie('m3_dashboard');
      oldDb.version(1).stores({ memory: '' });
      await oldDb.open();
      const oldMemory = await oldDb.table('memory').get('m3_memory_v1');
      if (oldMemory) {
        await db.memory.put({ key: 'app_memory', value: oldMemory });
      }
      oldDb.close();
      await Dexie.delete('m3_dashboard');
      console.log('[migration] Migrated data from m3_dashboard → apex-lab');
    } catch (e) {
      console.warn('[migration] Could not migrate old data:', e);
    }
  }

  // Check for old 'apex-lab-v1' sessions DB
  const oldSessionsExist = await Dexie.exists('apex-lab-v1');
  if (oldSessionsExist) {
    try {
      const oldDb = new Dexie('apex-lab-v1');
      oldDb.version(1).stores({ sessions: '' });
      await oldDb.open();
      const allSessions = await oldDb.table('sessions').toArray();
      for (const s of allSessions) {
        await db.sessions.put(s);
      }
      oldDb.close();
      await Dexie.delete('apex-lab-v1');
      console.log('[migration] Migrated sessions from apex-lab-v1 → apex-lab');
    } catch (e) {
      console.warn('[migration] Could not migrate old sessions:', e);
    }
  }
}

// Run migration on first import
migrateOldData().catch(console.error);

export { migrateOldData };
```

Update all existing code that uses `src/lib/db.ts` and `src/lib/memory.ts` to import from `src/lib/database.ts` instead. Keep the old files temporarily with deprecation comments pointing to the new module.

### A3. Create `src/lib/vinLookup.ts`
```typescript
import { NHTSADecodeSchema } from './schemas';

const NHTSA_API = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevin';

interface VINResult {
  make?: string;
  model?: string;
  year?: number;
  trim?: string;
  driveType?: string;
  engineHp?: number;
  engineDisplacement?: string;
  engineCylinders?: number;
  gvwr?: string;
  bodyClass?: string;
}

export async function decodeVIN(vin: string): Promise<VINResult> {
  const res = await fetch(`${NHTSA_API}/${vin}?format=json`);
  if (!res.ok) throw new Error(`NHTSA API error: ${res.status}`);

  const json = await res.json();
  const parsed = NHTSADecodeSchema.parse(json);

  const get = (name: string) =>
    parsed.Results.find(r => r.Variable === name)?.Value || undefined;

  return {
    make: get('Make') ?? undefined,
    model: get('Model') ?? undefined,
    year: get('Model Year') ? parseInt(get('Model Year')!, 10) : undefined,
    trim: get('Trim') ?? undefined,
    driveType: get('Drive Type') ?? undefined,
    engineHp: get('Engine Brake (hp) From') ? parseFloat(get('Engine Brake (hp) From')!) : undefined,
    engineDisplacement: get('Displacement (L)') ? `${get('Displacement (L)')}L` : undefined,
    engineCylinders: get('Engine Number of Cylinders') ? parseInt(get('Engine Number of Cylinders')!, 10) : undefined,
    gvwr: get('Gross Vehicle Weight Rating From') ?? undefined,
    bodyClass: get('Body Class') ?? undefined,
  };
}
```

---

## SECTION B — REPO RENAME PREPARATION

Update ALL path references from `/m3-dashboard/` to `/apex-lab/` in these files:

| File | What to change |
|------|---------------|
| `vite.config.ts` | `base` and `scope` values |
| `index.html` | manifest link, icon paths, splash screen links |
| `public/manifest.json` | `start_url`, `scope`, icon paths, `share_target.action` |
| `src/main.tsx` | service worker registration paths |
| `src/sw.ts` | ALL `/m3-dashboard/` references (there are 6+) |
| `src/lib/shareSession.ts` | base URL construction |
| `src/components/SharedSessionView.tsx` | footer domain text |
| `.github/workflows/health-cache.yml` | comment reference |
| `README.md` | clone URL, all path references |
| `SETUP.md` | clone URL, all path references |
| `package.json` | `"name": "m3-dashboard"` → `"name": "apex-lab"` |

Also change:
- `src/App.tsx`: `AUTH_KEY` from `'m3-auth-user'` → `'apex-lab-auth-user'`

---

## SECTION C — ASSET CLEANUP

Delete these files (confirmed duplicates via md5 hash):
```bash
rm src/assets/bmw-m-logo.jpg      # duplicate of car-logo.jpg (36KB)
rm src/assets/car-logo.jpg         # unused in code (36KB)
rm src/assets/m3-track.jpg         # duplicate of track-background.jpg (204KB)
rm src/assets/trackPhoto.ts        # 272KB base64 bundle bloat
rm src/assets/track-background.jpg # car photo used on login (204KB) — replacing with CSS
rm public/m3-track.jpg             # if exists
```

Total savings: ~750KB from the bundle.

---

## SECTION D — LOGIN SCREEN + MULTI-USER

### D1. Remove car photo from login
In `src/components/LoginScreen.tsx`:
- Remove the `import trackPhoto from '@/assets/track-background.jpg'` line
- Replace the `<img>` background with a CSS gradient:
```tsx
<div
  className="fixed inset-0"
  style={{
    background: 'radial-gradient(ellipse at 50% 30%, #1A1A22 0%, #0F0F14 40%, #08080C 100%)',
    zIndex: 0,
  }}
/>
```

### D2. Remove owner lock — allow any Google user
In `src/components/LoginScreen.tsx`, line 19:
- **DELETE** the line: `if (decoded.email !== config.ownerEmail) return;`
- Any authenticated Google user can now sign in

### D3. Update config.ts
```typescript
/**
 * APP IDENTITY — DO NOT MODIFY
 * "JP Apex Lab" is the product name and is not user-configurable.
 * The logo (jp-apex-lab-logo.png) is a fixed brand asset.
 * Users configure their OWN car and profile — not the app name or logo.
 */
export const APP_NAME = 'JP Apex Lab' as const;
export const APP_LOGO_PATH = '/apex-lab/jp-apex-lab-logo.png' as const;

export const config = {
  appName: APP_NAME,
  stripeColors: ['#1C69D4', '#6B2D9E', '#EF3340'] as string[],
  defaultPrimaryColor: '#1C69D4',
  defaultAccentColor: '#A855F7',
  googleDriveFolderId: '1BrltfQ6HfS5O5Rkb0xU767zSpuCtLsGM',
  whoopWorkerUrl: 'https://frosty-bar-6808.jonathan-proehl.workers.dev',
  stravaWorkerUrl: '',
  coachingWorkerUrl: '',  // Vercel serverless URL for AI coaching proxy
};
```

Remove `ownerName`, `ownerEmail`, `carName`, `carLogoUrl`, `healthProvider` from config. These are now per-user (stored in UserProfile in IndexedDB).

### D4. Create user profile system
Create `src/lib/userProfile.ts`:
- Import `db` from `./database` and `UserProfileSchema` from `./schemas`
- `getUserProfile(email: string): Promise<UserProfile | null>` — reads from Dexie `profiles` table
- `updateUserProfile(email: string, updates: Partial<UserProfile>): Promise<void>` — merges and validates with Zod before writing
- `createDefaultProfile(email, name, picture): UserProfile` — creates with timestamps, empty car fields, aiCoachingEnabled: false

### D5. Create ProfileSetup component
Create `src/components/ProfileSetup.tsx`:
- A modal/drawer that appears on first login (when `carName` is undefined/empty)
- Accessible later via a profile/gear icon in the header
- **Car section:**
  - Car Name (free text, e.g. "2025 BMW M3 Competition xDrive")
  - VIN (optional 17-char input) — on blur, calls `decodeVIN()` from vinLookup.ts
  - If VIN populated, auto-fills: Year, Make, Model, Trim, HP, Drivetrain, Engine
  - Manual fields (editable even after VIN fill): Year, Make, Model, Weight (lbs), HP, Drivetrain dropdown (FWD/RWD/AWD/4WD)
- **AI Coaching section:**
  - Toggle: "Enable AI Coaching"
  - API Key input (type="password", stored in IndexedDB via userProfile)
  - Model selector dropdown populated from `AVAILABLE_MODELS` in schemas.ts
  - Cost hint: "Haiku: fastest · Sonnet: balanced · Opus: deepest analysis"
  - Test button: sends a one-line prompt to verify the key works
- **Health Provider:**
  - Dropdown: None / Whoop / Strava / Oura
  - Replaces the hardcoded `config.healthProvider`
- Save button validates with Zod schema before writing to IndexedDB
- Form validation errors shown inline using Zod error messages

### D6. Wire ProfileSetup into App.tsx
- After login, call `getUserProfile(user.email)`
- If profile doesn't exist, create a default one
- If `carName` is empty/undefined, show ProfileSetup modal
- Add a profile/gear icon button in the header (near the sign-out button) to reopen ProfileSetup
- Pass `userProfile` down to components that need it (ReadinessTab for healthProvider, CoachingInsights for car specs, header for display name)

---

## SECTION E — QUALITY FIXES

### E0. Fix telemetry calculations to match motorsport industry standards

**E0a. Add Haversine distance calculation**
In `src/lib/parseRacechronoCsv.ts`, add a Haversine function and update `computeCumDist()`:

```typescript
// Haversine distance in meters between two GPS points
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

Update `computeCumDist()` to prefer GPS when both lat and lon are valid,
falling back to speed × time integration when GPS is missing:

```typescript
function computeCumDist(lapRows: Row[]): number[] {
  const dist: number[] = [0];
  for (let i = 1; i < lapRows.length; i++) {
    const prev = lapRows[i - 1];
    const curr = lapRows[i];
    let segDist: number;

    // Prefer GPS Haversine when coordinates are valid
    if (isFinite(prev.lat) && isFinite(prev.lon) &&
        isFinite(curr.lat) && isFinite(curr.lon) &&
        prev.lat !== 0 && prev.lon !== 0) {
      segDist = haversineM(prev.lat, prev.lon, curr.lat, curr.lon);
    } else {
      // Fallback: speed integration
      const dt = curr.ts - prev.ts;
      const safedt = dt > 0 ? dt : medianDt;
      segDist = (prev.spd / 3.6) * safedt;
    }

    dist.push(dist[i - 1] + segDist);
  }
  return dist;
}
```

**Why:** Professional tools (AiM Race Studio, MoTeC i2) use GPS for distance as primary.
Speed integration drifts 50-100 ft over a 2.5-mile lap due to smoothing in the GPS speed
channel. Haversine from raw lat/lon is more accurate for brake point distance calculations.

**E0b. Fix brake point detection to use deceleration, not brake pressure**
In the brake point detection loop (around line 444), change the trigger from
`bestLapRows[i].brk > 0.5` to longitudinal G:

```typescript
// Brake point: scan backward from corner entry for deceleration onset
// Industry standard (AiM, MoTeC): use longitudinal G, not brake pressure
// Brake pressure units vary by logger; long_g is universal
const DECEL_THRESHOLD = -0.15; // G — onset of meaningful braking
let brakePtM = 0;
for (let i = cd.startIdx - 1; i >= 0; i--) {
  const dBack = cornerStartDist - bestLapDist[i];
  if (dBack > 150) break;
  if (bestLapRows[i].long_g < DECEL_THRESHOLD) {
    brakePtM = bestLapDist[i];
    break;
  }
}
```

Keep brake pressure as a secondary confirmation — if `long_g` is unavailable
(NaN/zero for all samples), fall back to `brk > 0.5`.

**Why:** Brake pressure threshold of 0.5 assumes a specific unit and calibration.
The OBDLink MX+ may report brake pressure in bar, percentage, or raw sensor value
depending on RaceChrono's PID mapping. Longitudinal G is calibration-independent
and is the standard trigger in professional motorsport data analysis.

### E1. Remove duplicate best-lap display
App.tsx renders best lap in BOTH the header section AND the SessionStats card. Remove it from whichever location is less prominent (likely the header). The SessionStats card is the canonical location.

### E2. Fix CornerDetailTable mobile scroll
`src/components/charts/CornerDetailTable.tsx` has `minWidth: 560` forcing horizontal scroll on mobile. Replace with:
- Below 640px: hide the least critical columns (trail_brake_duration, steering_reversals)
- Or switch to a stacked card layout for each corner on mobile
- Use Tailwind's `hidden sm:table-cell` pattern for responsive column visibility

### E3. Loading skeletons
`src/components/ChartSkeleton.tsx` already exists. Ensure every chart component in `src/components/charts/` is wrapped in a loading pattern — show ChartSkeleton while data is being processed. Use React.lazy + Suspense for the chart components to enable code splitting.

### E4. Extract inline components from App.tsx
App.tsx is 663 lines with inline `LapList`, `Section`, and `EmptyDashboard` components. Extract each to its own file:
- `src/components/LapList.tsx`
- `src/components/Section.tsx`
- `src/components/EmptyDashboard.tsx`

This makes App.tsx a pure layout/routing shell.

---

## SECTION F — FUTURE-PROOFING

### F1. Create `src/lib/constants.ts`
Centralize all magic numbers and thresholds:
```typescript
// Thermal thresholds (°F) — from SKILL.md
export const THERMAL = {
  oil:     { good: 266, watch: 275, critical: 284 },
  trans:   { good: 185, watch: 200, critical: 212 },
  coolant: { good: 216, watch: 230, critical: 239 },
  boostDrop: { good: 0.15, watch: 0.3 },  // bar from peak
} as const;

// Consistency thresholds (seconds)
export const CONSISTENCY = {
  lapSpread: { good: 4, watchable: 8 },
  cornerMinSpeed: { good: 1, watchable: 2 },  // std dev mph
  brakingPoint: { good: 20, inconsistent: 40 }, // std dev ft
} as const;

// Tire pressure targets (PSI)
export const TIRE_PRESSURE = {
  hotTarget: { min: 36, max: 38 },
  coldOffset: 4,  // subtract from hot for cold target
  rainReduction: 2,
} as const;

// Track coordinates (for weather API)
export const TRACK_COORDS = {
  'Road Atlanta':  { lat: 34.1483, lon: -83.8097 },
  'Road America':  { lat: 43.7997, lon: -87.9913 },
  'Brainerd':      { lat: 46.3563, lon: -94.1983 },
  'VIR':           { lat: 36.5746, lon: -79.2077 },
} as const;
```

Update all hardcoded values in existing components to reference these constants.

### F2. Create `.env.example` update
Add to `.env.example`:
```
# Optional: Anthropic API key for AI coaching (can also be set per-user in app)
VITE_ANTHROPIC_API_KEY=

# Optional: Vercel serverless URL for AI coaching proxy
VITE_COACHING_WORKER_URL=

# Google OAuth (required)
VITE_GOOGLE_CLIENT_ID=
```

---

## COMMITS (conventional commit format)

```bash
git add -A
# Stage and commit in logical groups:
git add src/lib/schemas.ts src/lib/database.ts src/lib/constants.ts src/lib/vinLookup.ts
git commit -m "feat: add Zod schemas, Dexie database, VIN lookup, constants"

git add src/lib/userProfile.ts src/components/ProfileSetup.tsx src/components/LoginScreen.tsx src/config.ts src/App.tsx
git commit -m "feat: multi-user auth with profile setup, VIN auto-populate, model selector"

git add -u  # all modified files (path renames, asset deletions)
git commit -m "refactor: rebrand paths m3-dashboard → apex-lab, delete 750KB unused assets"

git add src/components/charts/CornerDetailTable.tsx src/components/Section.tsx src/components/LapList.tsx src/components/EmptyDashboard.tsx
git commit -m "fix: CornerDetailTable mobile overflow, extract inline components from App.tsx"

git push -u origin feature/rebrand-cleanup
```

## BUILD VERIFICATION
```bash
pnpm install
npx tsc --noEmit     # must be clean
npx vite build       # must succeed
```
