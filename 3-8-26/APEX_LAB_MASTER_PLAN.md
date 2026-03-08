# JP Apex Lab — Master Execution Plan

**Purpose:** Transform JP Apex Lab from a single-owner telemetry dashboard into a multi-user HPDE coaching platform — while completing all pending rebrand, cleanup, and quality work in the fewest possible Claude Code iterations.

## How to Use This

**Each branch has its own instruction file.** Drop it into your repo, point Claude Code at it, and say "Read this file and execute everything in it."

| File | Branch | What it does |
|------|--------|-------------|
| `BRANCH_1_PROGRESS_TAB.md` | `feature/progress-tab` | Push existing PR files |
| `BRANCH_2_REBRAND_CLEANUP.md` | `feature/rebrand-cleanup` | Rebrand + multi-user + Zod + Dexie + VIN lookup + quality fixes |
| `BRANCH_3_TREMOR.md` | `feature/tremor-integration` | Tremor component library swap |
| `BRANCH_4_AI_COACHING.md` | `feature/ai-coaching` | Claude API coaching with model selector |

**Merge sequentially.** Each branch depends on the previous one being merged first.

---

## Modernization Decisions (and why)

**Zod** (runtime schema validation) — Your app currently has no runtime type checking. Data from IndexedDB, NHTSA API, and CSV parsing is trusted blindly. Zod defines every data shape once in `src/lib/schemas.ts`, then TypeScript infers the types AND runtime validates the data. One file, zero type duplication, catches corrupt data before it crashes a chart. Free, 12KB gzipped.

**Dexie.js** (IndexedDB wrapper) — You currently have two hand-rolled IndexedDB modules (`db.ts` and `memory.ts`) with different patterns. Dexie gives you typed tables, automatic schema versioning, migration support, and the `useLiveQuery` hook for reactive data binding. It's the most-used IndexedDB wrapper (100K+ sites) and handles all the browser-specific bugs your raw implementation doesn't. Free, 22KB gzipped. The Dexie Cloud upgrade path (paid) would later enable multi-device sync if you ever want that — but it's not needed now.

**Constants centralization** (`constants.ts`) — Thermal thresholds, consistency targets, tire pressure specs, and track coordinates are currently scattered across component files and the SKILL.md coaching framework. Branch 2 extracts them into one file so the coaching prompt, the chart components, and the rule-based insights all read from the same source of truth.

**Model flexibility** — The AI coaching integration uses a `AVAILABLE_MODELS` array in `schemas.ts`. Adding a new Claude model is one line. The user picks their model in Settings. The API call reads `userProfile.preferredModel` at runtime. No hardcoded model IDs anywhere in the calling code.

**NHTSA vPIC** (VIN decode) — Free, no API key, no rate limit concerns for individual use. User enters their VIN once and the app auto-populates make, model, year, HP, drivetrain, engine specs. This data then feeds into the AI coaching system prompt so the coach knows the car's characteristics.

---

## Execution Strategy: 4 Branches, Strict Order

Each branch is one Claude Code session. Merge sequentially. No branch depends on unmerged work from a parallel branch.

---

## Branch 1: `feature/progress-tab` (READY — files already built)

**Effort:** Push only. Files exist at `/mnt/user-data/outputs/m3-dashboard-pr/`.

**What it does:**
- Adds the Progress tab (session-over-session lap time + consistency trends)
- Moves DebriefNotes from localStorage to IndexedDB

**Claude Code prompt:**
```
cd ~/m3-dashboard && git checkout -b feature/progress-tab
# Copy the PR files into the repo
cp -r /path/to/m3-dashboard-pr/src/* src/
git add -A && git commit -m "feat: add Progress tab with IndexedDB persistence"
git push origin feature/progress-tab
# Then open PR via GitHub CLI or web
```

---

## Branch 2: `feature/rebrand-cleanup` (THE BIG ONE)

**Effort:** ~200 file touches. This is the largest single session.

**Prompt for Claude Code — copy verbatim:**

```
You are working on the JP Apex Lab PWA (React/TypeScript/Vite/Tailwind/shadcn).
Execute ALL of the following in a single branch called feature/rebrand-cleanup.
Do NOT ask questions — execute everything sequentially.

## 1. REPO NAME MIGRATION
The GitHub repo will be renamed from m3-dashboard to apex-lab.
Update ALL path references from /m3-dashboard/ to /apex-lab/ in:
- vite.config.ts (base + scope)
- index.html (manifest, icons, splash screen links)
- public/manifest.json (start_url, scope, icon paths, share_target action)
- src/main.tsx (service worker registration paths)
- src/sw.ts (all /m3-dashboard/ references → /apex-lab/)
- src/lib/shareSession.ts (base URL construction)
- src/components/SharedSessionView.tsx (footer text)
- .github/workflows/health-cache.yml (comment reference)
- README.md and SETUP.md (clone URLs and paths)
- package.json: change "name" to "apex-lab"

## 2. IndexedDB MIGRATION (memory.ts)
In src/lib/memory.ts:
- Change DB_NAME from 'm3_dashboard' to 'apex_lab_v1'
- Change MEMORY_KEY from 'm3_memory_v1' to 'apex_lab_memory_v1'
- Add a migration function that checks if old DB 'm3_dashboard' exists,
  reads data from it, writes to new DB, then deletes the old DB.
  Run this migration in openDB() before resolving.

## 3. AUTH KEY
In src/App.tsx:
- Change AUTH_KEY from 'm3-auth-user' to 'apex-lab-auth-user'

## 4. ASSET CLEANUP
Delete these files (confirmed duplicates/dead weight):
- src/assets/bmw-m-logo.jpg (duplicate of car-logo.jpg)
- src/assets/car-logo.jpg (unused in code)
- src/assets/m3-track.jpg (duplicate of track-background.jpg)
- src/assets/trackPhoto.ts (272KB base64 — massive bundle bloat)
- public/m3-track.jpg (if exists)

## 5. LOGIN SCREEN — REMOVE CAR PHOTO
In src/components/LoginScreen.tsx:
- Remove the import of track-background.jpg
- Replace the full-bleed <img> background with a CSS gradient background:
  Use a dark radial gradient that matches the app's void/base palette:
  background: radial-gradient(ellipse at 50% 30%, #1A1A22 0%, #08080C 70%)
  This eliminates the car-specific photo entirely.
- Remove src/assets/track-background.jpg after confirming no other imports.

## 6. MULTI-USER SUPPORT — REPLACE OWNER LOCK
Currently LoginScreen.tsx line 19 hardcodes:
  if (decoded.email !== config.ownerEmail) return;

This must become a multi-user system. Changes:

a) In src/config.ts:
   - Remove ownerName and ownerEmail fields entirely
   - Add: appName: 'JP Apex Lab' (immutable — this is the product name)
   - Keep all other config fields

b) In src/components/LoginScreen.tsx:
   - Remove the email check entirely — any Google-authenticated user can sign in
   - After successful auth, store the user object in IndexedDB (not just the JWT)

c) Create src/lib/userProfile.ts:
   - Interface UserProfile { email, name, picture, carName?, carVin?, carYear?,
     carMake?, carModel?, carWeight?, carHp?, carDrivetrain?, createdAt, updatedAt }
   - Store/retrieve from IndexedDB 'apex-lab-v1' store under key 'user_profile_{email}'
   - On first login, create a profile with just email/name/picture
   - Provide getUserProfile(email) and updateUserProfile(email, partial) functions

d) Create src/components/ProfileSetup.tsx:
   - A modal/drawer that appears on first login (when carName is empty)
   - Fields: Car Name (free text, e.g. "2025 BMW M3 Competition xDrive"),
     VIN (optional — if provided, auto-populate via NHTSA API),
     Year, Make, Model, Weight (lbs), Horsepower, Drivetrain (FWD/RWD/AWD/4WD)
   - VIN lookup: fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`)
     and map Make, Model, ModelYear, DriveType, EngineHP, GVWR to the form fields
   - Save button stores to IndexedDB via userProfile.ts
   - Accessible later from a profile icon in the header

e) In App.tsx:
   - After login, check if user profile has carName set
   - If not, show ProfileSetup modal before showing the dashboard
   - Display user's car name in the header where it was previously hardcoded

## 7. BRANDING PROTECTION
In src/config.ts, add a comment block:
```typescript
/**
 * APP IDENTITY — DO NOT MODIFY
 * "JP Apex Lab" is the product name and is not user-configurable.
 * The logo (jp-apex-lab-logo.png) is a fixed brand asset.
 * Users configure their OWN car and profile — not the app name or logo.
 */
export const APP_NAME = 'JP Apex Lab' as const;
export const APP_LOGO = '/apex-lab/jp-apex-lab-logo.png' as const;
```

## 8. QUALITY FIXES
a) Remove the duplicate "best lap" display — App.tsx renders best lap in BOTH
   the header AND the SessionStats card. Remove it from the header (the card
   is the proper location).

b) Fix CornerDetailTable mobile scroll — the table has minWidth: 560 which
   forces horizontal scroll on mobile. Replace with responsive column hiding
   or a stacked card layout below 640px.

c) Add loading skeletons for all chart components. Create a ChartSkeleton
   component (if not already present) with a pulsing dark rectangle matching
   the chart container dimensions. Wrap each chart in a Suspense-like pattern
   that shows the skeleton while data is loading.

Commit with conventional commits:
- feat: multi-user auth with profile setup and VIN lookup
- refactor: rebrand path references m3-dashboard → apex-lab  
- refactor: IndexedDB migration from m3_dashboard to apex_lab_v1
- fix: remove duplicate best-lap display
- fix: CornerDetailTable mobile overflow
- chore: delete unused car-specific assets (750KB saved)
```

---

## Branch 3: `feature/tremor-integration`

**Depends on:** Branch 2 merged.

**Effort:** Swap hand-coded KPI cards, sparklines, and tables for Tremor components. The full spec already exists at `/mnt/user-data/outputs/TREMOR_INTEGRATION_SPEC.md`.

**Claude Code prompt:**
```
cd ~/m3-dashboard && git checkout main && git pull && git checkout -b feature/tremor-integration

Install Tremor:
pnpm add @tremor/react

Follow the complete integration spec in TREMOR_INTEGRATION_SPEC.md.
Execute every component replacement listed in the spec.
Key files to modify:
- tailwind.config.js (add Tremor content path + CSS variables)
- src/index.css (add --tremor-* CSS variables for dark theme)
- src/components/SessionStats.tsx (KpiCard → Tremor Card + Metric + BadgeDelta)
- src/components/LapInfoPanel.tsx (sparkline SVG → SparkAreaChart)
- src/components/ProgressTab.tsx (hand-coded trend cards → Tremor AreaChart + BarList)
- src/components/ReadinessTab.tsx (readiness gauges → Tremor ProgressCircle + CategoryBar)

Test that the build succeeds: pnpm build
Commit: feat: replace hand-coded KPIs with Tremor components
```

---

## Branch 4: `feature/ai-coaching` (THE VISION)

**Depends on:** Branch 3 merged.

**This is the Claude API integration that turns Apex Lab into a coaching platform.**

### Architecture

```
User uploads RaceChrono CSV
       ↓
Browser runs preprocess.py equivalent (WASM or JS port)
       ↓
Compact JSON summary (~5-15KB)
       ↓
User clicks "Get Coaching" button
       ↓
Frontend sends summary JSON to Anthropic API via:
  POST https://api.anthropic.com/v1/messages
  (No API key in browser — proxied through Vercel serverless)
       ↓
User-selected model analyzes using the 4-tier coaching framework
  (system prompt embeds the full SKILL.md coaching methodology)
       ↓
Streaming response renders in a CoachingChat panel
```

### Model Flexibility — User Chooses
The app does NOT hardcode a model. Instead:

```typescript
// src/lib/services/modelConfig.ts
export const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', tier: 'balanced' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'fast' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', tier: 'advanced' },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];
export const DEFAULT_MODEL: ModelId = 'claude-sonnet-4-20250514';
```

The Settings UI includes a model dropdown. The selected model is stored in the user's profile (IndexedDB). When new models release, you add one line to AVAILABLE_MODELS — no other code changes needed. The API call reads `userProfile.preferredModel` at runtime.

### System Prompt (embedded in the API call)
The system prompt includes:
- The complete 4-tier analysis framework from SKILL.md
- The user's car profile (weight, HP, drivetrain) from IndexedDB
- The user's historical best laps at this track (from IndexedDB progress data)
- Instruction to lead with single biggest time gain, cap at 3 action items
- Instruction to never recommend modifications unless thermal data supports it

### Opt-In Flow
- Settings panel: "Enable AI Coaching (requires Anthropic API key)"
- User provides their own API key (stored in IndexedDB, never transmitted except to Anthropic)
- Model selector dropdown (defaults to Sonnet 4, can switch to Haiku for speed or Opus for depth)
- Alternative: proxy through your Vercel serverless backend (like the Whoop OAuth proxy)
  so the API key stays server-side for users who deploy their own instance

### What the AI Coach Can Do
1. **Session debrief** — analyze uploaded telemetry, identify the single biggest opportunity
2. **Corner-specific coaching** — "Your T5 entry is 4 mph slow vs your best. You're braking 35ft early."
3. **Cross-session comparison** — "Your Road America consistency improved from 6.2s spread to 3.8s"
4. **Thermal monitoring** — "Trans temps hit 205°F in session 3. Consider longer cool-down laps."
5. **Pre-event prep** — pull weather, suggest tire pressures, review maintenance status
6. **Conversational follow-up** — user can ask "what about Turn 3?" and get contextual answers

### Claude Code prompt:
```
cd ~/m3-dashboard && git checkout main && git pull && git checkout -b feature/ai-coaching

## 1. Create model configuration
Create src/lib/services/modelConfig.ts:
- Export AVAILABLE_MODELS array with id, label, tier for each Claude model
- Include claude-sonnet-4-20250514, claude-haiku-4-5-20251001, claude-opus-4-6
- Export DEFAULT_MODEL = 'claude-sonnet-4-20250514'
- Export ModelId type from the array
- This is the ONLY file that needs updating when Anthropic releases new models

## 2. Create the coaching API service
Create src/lib/services/coachingApi.ts:
- Function: getCoachingAnalysis(sessionSummary, userProfile, trackHistory, options)
- options includes: apiKey?, modelId (from modelConfig), signal (AbortSignal)
- If apiKey provided, call Anthropic API directly from browser
- If not, call Vercel proxy endpoint (config.coachingWorkerUrl)
- Model comes from user's settings, NOT hardcoded
- Stream the response using fetch with ReadableStream
- System prompt: embed the 4-tier coaching framework, user's car specs,
  and their historical best laps at this track
- Export a buildSystemPrompt(userProfile, trackHistory, trackName) function
  so the prompt is testable independently

## 3. Create the coaching system prompt template
Create src/lib/services/coachingPrompt.ts:
- Contains the full 4-tier coaching framework as a template string
- Injects user's car specs (weight, HP, drivetrain) dynamically
- Injects historical best laps for the current track
- Includes thermal thresholds from SKILL.md
- Includes consistency evaluation thresholds
- Returns a complete system prompt string

## 4. Create the coaching UI
Create src/components/CoachingChat.tsx:
- Renders inside the existing CoachingInsights component area
- Shows the AI analysis as it streams in (markdown rendered via simple
  regex-based renderer — no heavy markdown lib needed)
- Has a text input for follow-up questions
- Maintains conversation history in state (sent with each follow-up)
- "Get Coaching" button triggers analysis of current session
- Loading state shows a skeleton with "Analyzing your session..."
- Model badge in corner shows which model is active
- Abort button to cancel mid-stream

## 5. Create settings for API key + model selection
Add to ProfileSetup.tsx (or a new Settings drawer):
- "AI Coaching" section with toggle (opt-in)
- API key input (stored in IndexedDB, masked after entry)
- Model selector dropdown populated from AVAILABLE_MODELS
- Test button that sends a simple prompt to verify the key works
- Cost hint text: "Haiku: fastest/cheapest · Sonnet: balanced · Opus: deepest analysis"

## 6. Update UserProfile type
In src/lib/userProfile.ts, add to the interface:
- anthropicApiKey?: string (encrypted at rest if possible, otherwise just stored)
- preferredModel?: ModelId (defaults to DEFAULT_MODEL)
- aiCoachingEnabled: boolean (defaults to false)

## 7. Add to Vercel backend
Create api/coaching.ts in the m3-dashboard-api/ project:
- Accepts POST with { sessionSummary, conversationHistory, model, systemPrompt }
- model is passed from the client — the proxy doesn't pick the model
- Forwards to Anthropic API using the server-side API key
- Streams response back to client via ReadableStream
- Rate limited (10 requests/hour per user) to prevent abuse
- Validates model ID against an allowlist before forwarding

Commit: feat: AI coaching with model selector and streaming chat
```

---

## Free Data Sources to Integrate

### Already usable (no API key required):

| Source | URL | What it provides | Integration point |
|--------|-----|-------------------|-------------------|
| **NHTSA vPIC** | `vpic.nhtsa.dot.gov/api/` | VIN decode → make, model, year, weight, HP, drivetrain, engine | Profile setup — auto-populate car specs from VIN |
| **Open-Meteo** | `api.open-meteo.com` | Hourly weather forecasts, no key needed | Pre-event weather widget (already spec'd in season plan) |
| **roadcurvature.com** | KMZ downloads | Road curvature ratings by segment | Spirited drive route planning (already in Google Drive pipeline) |
| **OpenStreetMap/Overpass** | `overpass-api.de` | Track circuit geometry, elevation data | Generate track maps for circuits not in trackLayouts.ts |

### Requires free account:

| Source | What it provides | Value |
|--------|-------------------|-------|
| **Whoop API** | HRV, resting HR, sleep, recovery score | Driver readiness correlation (already in progress) |
| **Strava API** | Heart rate during activity windows | Alternative to Whoop for biometric correlation |

### Community data (no central HPDE lap database exists):

There is **no public HPDE lap time database**. This is actually an opportunity. The app could become one — users opt in to share anonymized lap times (track, car class, best lap, session date). This creates a comparison pool over time. More on this below.

---

## Claude Project Integration — Benefits for Users

**What this means:** Users could create a Claude Project (like yours) with their car's technical manual, setup notes, and track notes as project knowledge. Then use the AI coaching feature with that context.

**Practical benefits:**
- Claude coaching responses would reference the user's specific vehicle manual (e.g., "Your S58 engine's oil temp limit per BMW is 284°F — you hit 275°F, which is in the watch zone but not critical")
- Corner notes from previous sessions become coaching context ("Last time at T5 you noted understeer on exit — your min speed data confirms you're carrying too much entry speed")
- Modification decisions get informed by the user's actual budget and decision history

**How to enable this in the app:**
The AI coaching feature already sends context (car specs, track history) with each API call. A "Connect to Claude Project" feature would allow the user to provide a Project ID, and the coaching calls would include a note in the system prompt: "The user has additional context in their Claude Project. Reference it when relevant."

However — this is a V2 feature. The in-app coaching works without it. The project integration just makes it smarter.

---

## Community / Multi-User Vision

### Phase 1 (Branch 2): Individual multi-user
- Any Google user can sign in
- Each user has their own profile, car specs, sessions, and notes
- Data is isolated per-user in IndexedDB (keyed by email)
- No sharing between users

### Phase 2 (future): Opt-in lap time sharing
- Users can flag sessions as "shareable"
- Anonymized data (track, car class, best lap, date, conditions) goes to a shared database
- Other users at the same track see percentile rankings: "Your 1:42.3 at Road America puts you in the 65th percentile for AWD sedans >3500 lbs"
- This requires a backend (Cloudflare D1 or Supabase free tier)
- No PII shared — just car class + lap time + track + conditions

### Phase 3 (future): Instructor features
- HPDE instructors could use this with students
- Student shares a session link → instructor reviews telemetry + adds coaching notes
- This builds on the existing share session infrastructure (SharedSessionView.tsx)

---

## Summary — What to Run in Claude Code

| Order | Branch | Session scope | Approx files | New files |
|-------|--------|---------------|--------------|-----------|
| 1 | `feature/progress-tab` | Push existing PR files, verify build, open PR | 4 modified/new | ProgressTab.tsx |
| 2 | `feature/rebrand-cleanup` | Rebrand + multi-user + asset cleanup + quality fixes | ~25 touched | userProfile.ts, ProfileSetup.tsx |
| 3 | `feature/tremor-integration` | Component library swap per existing spec | ~8 modified | — |
| 4 | `feature/ai-coaching` | Claude API proxy + model selector + coaching UI + settings | ~8 new/modified | modelConfig.ts, coachingApi.ts, coachingPrompt.ts, CoachingChat.tsx |

---

## Existing Files From Prior Sessions — INCLUDE ALL OF THESE

### PR-Ready Files (already built, at `/mnt/user-data/outputs/m3-dashboard-pr/`)
These go into Branch 1 (`feature/progress-tab`):

| File | Status | What it does |
|------|--------|-------------|
| `src/components/ProgressTab.tsx` | NEW (587 lines) | 6th tab: personal bests, lap time progression, consistency trends |
| `src/App.tsx` | MODIFIED | Imports ProgressTab, adds to tab arrays, renders outside empty-state guard |
| `src/components/DebriefNotes.tsx` | REWRITTEN | localStorage → IndexedDB migration, fixes iOS data loss |
| `src/components/SessionStats.tsx` | MODIFIED | Mobile overflow fix: responsive font sizing, truncation |
| `PR_DESCRIPTION.md` | Reference | Full PR description with build verification steps |

### Tremor Integration Spec (at `/mnt/user-data/outputs/TREMOR_INTEGRATION_SPEC.md`)
This is the complete blueprint for Branch 3. Contains exact component replacements for:
- SessionStats KPI cards → Tremor Card + Metric + BadgeDelta
- LapInfoPanel sparkline → SparkAreaChart
- ProgressTab trend cards → Tremor AreaChart + BarList
- ReadinessTab gauges → ProgressCircle + CategoryBar
- CSS variable mapping for dark theme
- Install command (`pnpm add @tremor/react`)
- Tailwind config update

### Rebrand Audit Results (from current session)
Complete inventory of every file requiring changes:

**Path references (`/m3-dashboard/` → `/apex-lab/`):**
`index.html`, `vite.config.ts`, `public/manifest.json`, `src/main.tsx`, `src/sw.ts`, `src/lib/shareSession.ts`, `src/components/SharedSessionView.tsx`, `package.json`, `README.md`, `SETUP.md`, `.github/workflows/health-cache.yml`

**IndexedDB rename:**
`src/lib/memory.ts` — DB_NAME `'m3_dashboard'` → `'apex_lab_v1'`, MEMORY_KEY `'m3_memory_v1'` → `'apex_lab_memory_v1'`

**Auth key:** `src/App.tsx` — `'m3-auth-user'` → `'apex-lab-auth-user'`

**Assets to delete (750KB total):**
`src/assets/bmw-m-logo.jpg` (36KB, duplicate), `src/assets/car-logo.jpg` (36KB, duplicate), `src/assets/m3-track.jpg` (204KB, duplicate), `src/assets/trackPhoto.ts` (272KB base64 bundle bloat), `src/assets/track-background.jpg` (204KB, car photo on login), `public/m3-track.jpg` (if exists)

**Owner lock removal:** `src/components/LoginScreen.tsx:19` — hardcoded email check, `src/config.ts` — ownerName/ownerEmail fields

---

## After Branch 2 Merges — Rename the GitHub Repo

1. Go to GitHub → Settings → Repository name
2. Change `m3-dashboard` → `apex-lab`
3. GitHub auto-redirects the old URL — existing bookmarks and links won't break
4. The path references updated in Branch 2 will already match `/apex-lab/`
5. Update your local clone: `git remote set-url origin https://github.com/jproehl76/apex-lab.git`

**Total Claude Code sessions: 4** (one per branch, sequential merge).
