# JP Apex Lab: Codebase Audit & Improvement Plan

**Date:** April 2, 2026
**Scope:** Full codebase audit, Phase 1 fixes applied, Phase 2 cleanup complete

---

## Summary of changes made

### Phase 1: Security & Reliability Audit (completed)

**Critical security fixes:**
- Removed `VITE_WHOOP_CLIENT_SECRET` from GitHub Actions build env (was leaking to client bundle)
- Fixed CORS bypass in Cloudflare Worker (returned `ALLOWED_ORIGIN` regardless of request origin)
- Fixed CORS in Vercel coaching proxy (allowlist instead of `*`)
- Wrapped all `req.json()` calls in worker with try/catch
- Sanitized error responses (removed internal details from API errors)
- Fixed Rules of Hooks violations in StravaPanel and WhoopPanel (early return before hooks)
- Added DOMPurify sanitization to AI coaching chat markdown renderer
- Replaced `Math.max(...spread)` with loop-based safe min/max (prevents stack overflow with 65k+ samples)

**Reliability fixes:**
- Cryptographic OAuth state via `crypto.getRandomValues()` (replaced `Math.random()`)
- Fixed `onDone` double-call in streaming API consumer
- Fixed IndexedDB `openDB` race condition (concurrent calls now share pending promise)
- Fixed env var detection (`"undefined"` string check in config.ts)
- Fixed URL-safe base64 encoding in share session
- Added `componentDidCatch` logging to ErrorBoundary
- Added Zod schema validation at JSON parse boundaries (DropZone, DrivePickerButton, healthCache)
- Token refresh mutex via KV lock in worker
- SHA-256 hash for push subscription KV keys
- Fixed VAPID key base64url padding

**Infrastructure:**
- Added Vitest test suite (63 tests across 4 files)
- Added pre-deploy lint step to GitHub Actions
- Deleted dead App.css

### Phase 2: Simplification & Cleanup (completed)

**Health provider removal:**
- Deleted all health API integration files: whoopApi.ts, whoopAuth.ts, stravaApi.ts, stravaAuth.ts, ouraApi.ts
- Deleted all health UI components: WhoopPanel.tsx, StravaPanel.tsx, OuraPanel.tsx, ReadinessTab.tsx
- Deleted healthCache.ts, usePushNotifications.ts hook
- Deleted health-cache.yml workflow, merge-health-cache.mjs script, gen-vapid-keys.mjs
- Deleted health-cache.json from public/data and dist/data
- Cleaned up all imports and references in App.tsx, config.ts, memory.ts, sw.ts

**Cloudflare Worker removal:**
- Deleted entire workers/ directory (only push notification routes remained after health removal)
- Removed whoopWorkerUrl and stravaWorkerUrl from config
- Removed WHOOP_CLIENT_ID from deploy.yml build env

**Brand/car-agnostic cleanup:**
- Removed BMW G80 M3 specific coaching notes from coachingPrompt.ts
- Replaced BMWTypeNext font from bmwusa.com CDN with Barlow Condensed alias via @font-face
- Removed BMW CDN font caching from service worker
- Set default carName to empty string (set via user profile on first launch)
- Updated placeholder text (ProfileSetup, AISettings) to use generic examples
- Removed "BMW blue" comments from chartTheme.ts and index.css

**Infrastructure cleanup:**
- Deleted old planning documents (3-8-26/ directory, APEX_LAB_MASTER_PLAN.md, BRANCH_*.md)
- Rewrote SETUP.md (removed all health/push/worker setup tiers)
- Rewrote README.md (removed BMW/WHOOP references, updated stack list)
- Simplified setup.mjs script (removed health provider and push notification steps)
- Cleaned up .env.example (removed health provider env vars)
- Removed m3-dashboard path from service worker share target handler

---

## Current architecture

```
GitHub Pages (static PWA)
  + Google OAuth (sign-in + Drive)
  + Anthropic API (direct browser or Vercel Edge Function proxy)
  + OpenStreetMap Overpass API (track geometry)
  + Open-Meteo (weather)

No Cloudflare Worker. No backend database.
All user data stored in browser IndexedDB.
```

### Key files

| File | Purpose |
|------|---------|
| src/App.tsx | Main app shell, tab routing, all layout |
| src/config.ts | App branding, Drive folder ID, coaching proxy URL |
| src/lib/parseRacechronoCsv.ts | CSV parser (RaceChrono v3 format) |
| src/lib/services/coachingApi.ts | Anthropic API streaming client |
| src/lib/services/coachingPrompt.ts | System prompt and session data formatter |
| src/lib/db.ts | IndexedDB wrapper |
| src/lib/memory.ts | Cross-session memory (IDB) |
| src/lib/sessionStore.ts | Session state management |
| src/sw.ts | Service worker (Workbox) |
| api/coaching.ts | Vercel Edge Function proxy for Anthropic API |

---

## Remaining improvements

### High priority

1. **Heart rate from CSV**: RaceChrono captures BLE heart rate data (from WHOOP strap) as a `heart_rate` channel in CSV exports. The parser does not currently extract this channel. Adding HR parsing + visualization would replace the deleted cloud API integrations with a simpler, local-only approach.

2. **App.tsx decomposition**: At ~700 lines, App.tsx handles layout, routing, state, and inline components. Extract: Header, MobileNav, DesktopLayout, LapList, Section, EmptyDashboard into separate files.

3. **Font migration**: BMWTypeNext is aliased to Barlow Condensed via @font-face. A full migration would rename the font references throughout the codebase to use a CSS variable (e.g. `var(--font-ui)`) instead of hardcoded `fontFamily: 'BMWTypeNext'` in 100+ locations.

### Medium priority

4. **CSV parser deep audit against v3 spec**: Validate column name detection handles all RaceChrono channel identifiers, sparse data interpolation, mixed sample rates (25 Hz GPS + 2 Hz OBD), and proper null/NaN handling for channels that go offline.

5. **Multi-track extensibility**: Add track layout definitions for Road America, Brainerd International Raceway. The existing track layout system (src/assets/trackLayouts/) supports this but only has Road Atlanta data.

6. **Inline style consolidation**: Many components use inline `style={{ fontFamily: 'BMWTypeNext', ... }}` objects. Move these to Tailwind utility classes or a shared style constants file.

7. **Test coverage expansion**: Current tests cover utils, CSV parsing, share encoding, and corner detection. Add tests for: session store CRUD, memory persistence, coaching prompt generation, config validation.

### Low priority

8. **Lazy-load chart components**: LapTimesChart, CornerSpeedChart, FrictionCircleChart, TrackHeatMap are all bundled. Use `React.lazy()` + Suspense to code-split the charting libraries.

9. **Accessibility audit**: Tab navigation, ARIA labels on interactive elements, keyboard-only usage of the command palette and session list.

10. **PWA offline support**: The service worker precaches built assets but does not cache session data for offline viewing. IndexedDB data is available offline, but the app needs a "last loaded session" display mode.

---

## localStorage keys in use

| Key | File | Notes |
|-----|------|-------|
| `apex-lab-auth-user` | App.tsx | Google auth user object |
| `apex-sidebar-layout` | App.tsx | Desktop panel sizes |
| `drive:imported-ids` | useDriveAutoImport.ts | Set of auto-imported Drive file IDs |
| `drive:auto-checked` | useDriveAutoImport.ts | Timestamp of last auto-check |
| `notes:{sessionId}` | DebriefNotes.tsx | Per-session debrief notes |
| `install_prompt_dismissed` | InstallPrompt.tsx | PWA install prompt dismissed flag |

## IndexedDB databases

| Database | Store | Key pattern | File |
|----------|-------|-------------|------|
| `apex-lab-v1` | `sessions` | `session:{id}`, `__meta`, `share:pending` | db.ts, sw.ts |
| `apex_lab_v1` | `memory` | `apex_lab_memory_v1` | memory.ts |
| `apex-lab-profiles` | `profiles` | email address | userProfile.ts |
