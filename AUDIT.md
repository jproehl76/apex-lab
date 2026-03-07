# JP Apex Lab — Full Codebase Audit

**Date:** March 7, 2026
**Auditor:** Phase 0 systematic review
**Scope:** Every file under `src/`, all config, all public assets

---

## Executive Summary

Well-architected single-user PWA with strong TypeScript discipline and consistent design tokens. Two critical issues plus a set of medium/low concerns. Overall code quality is high — no dead code, proper React patterns, comprehensive error handling.

**Critical:** localStorage used for all session data (iOS PWA data-loss risk)
**Critical:** Best lap time displayed in 6+ places simultaneously (owner-reported)
**Medium:** App.tsx is 23.5 KB and needs decomposition
**Medium:** No service worker caching strategy (PWA shell is not offline-capable)

---

## Component Dependency Tree

```
App.tsx (23.5 KB — largest file, needs splitting)
├── LoginScreen
│   └── GoogleLogin (@react-oauth/google)
├── Header (inline in App)
│   ├── apexLabLogo (img)
│   ├── BestLapDisplay (inline — DUPLICATE #1)
│   └── TrackLogo (from findTrackLayout)
├── Left Sidebar [lg only]
│   ├── DropZone
│   ├── DrivePickerButton
│   ├── SessionList
│   ├── LapInfoPanel            ← DUPLICATE #2 + #3 (best lap + lap list)
│   └── LapList (inline fn)    ← DUPLICATE #4
├── Mobile Loading Strip [<lg]
│   ├── DropZone (compact)
│   └── DrivePickerButton
├── Tab Content (renderTabContent)
│   ├── 'session'
│   │   ├── WeatherWidget
│   │   ├── SessionStats        ← DUPLICATE #5 (best lap card)
│   │   ├── CoachingInsights
│   │   └── LapTimesChart       ← DUPLICATE #6 (best lap reference line)
│   ├── 'corners'
│   │   ├── CornerSpeedChart
│   │   ├── CornerDetailTable
│   │   ├── FrictionCircleChart
│   │   └── FrictionScatterChart
│   ├── 'health'
│   │   ├── ThermalChart
│   │   └── ReadinessTab → WhoopPanel | StravaPanel | OuraPanel
│   ├── 'notes'
│   │   └── DebriefNotes (per session)
│   └── 'map'
│       └── TrackHeatMap (Leaflet)
├── Mobile Bottom Nav (inline)
└── InstallPrompt
```

---

## Component Inventory

| Component | File | Size | Purpose | State | Issues |
|-----------|------|------|---------|-------|--------|
| App | App.tsx | 23.5 KB | Root layout + tab router | React state: activeTab, healthConnected, user | Too large; inline LapList, Section, EmptyDashboard |
| LoginScreen | LoginScreen.tsx | 1.8 KB | Google OAuth UI | None | Car name still shows below logo |
| DropZone | DropZone.tsx | 3.6 KB | CSV/JSON upload | isDragging | compact prop added recently |
| DrivePickerButton | DrivePickerButton.tsx | 2.1 KB | Google Drive picker | accessToken, loading | None |
| SessionList | SessionList.tsx | 3.3 KB | Session list + rename/toggle | None (callbacks) | None |
| SessionStats | SessionStats.tsx | 3.4 KB | Summary cards | None | **BEST LAP #5** |
| LapInfoPanel | LapInfoPanel.tsx | 7.5 KB | F1-style lap breakdown | None | **BEST LAP #2+3**; mixes FS tokens + hardcoded px |
| DebriefNotes | DebriefNotes.tsx | 1.5 KB | Notes textarea | localStorage key `notes:{id}` | localStorage (should be IndexedDB — already in memory.ts) |
| CoachingInsights | CoachingInsights.tsx | 3.8 KB | Text coaching tips | None | None |
| ReadinessTab | ReadinessTab.tsx | 2.0 KB | Health provider router | None | None |
| WhoopPanel | WhoopPanel.tsx | 15 KB | WHOOP metrics | connected, loading, data, error | 20+ inline style objects |
| StravaPanel | StravaPanel.tsx | ~8 KB | Strava activities | connected, loading, activities | None |
| OuraPanel | OuraPanel.tsx | ~7 KB | Oura readiness | loading, data, error | None |
| WeatherWidget | WeatherWidget.tsx | ~5 KB | Track weather | loading, data | None |
| InstallPrompt | InstallPrompt.tsx | 1.1 KB | PWA install banner | dismissed (localStorage) | localStorage |
| ErrorBoundary | ErrorBoundary.tsx | 1.0 KB | Error fallback | hasError | Not wrapping all charts |
| LapTimesChart | charts/LapTimesChart.tsx | 4.2 KB | Lap time line chart | None | **BEST LAP #6** (reference line) |
| CornerSpeedChart | charts/CornerSpeedChart.tsx | 5.8 KB | Apex speed bar chart | selectedCorner | None |
| CornerDetailTable | charts/CornerDetailTable.tsx | 8.9 KB | All corner metrics | sortKey, sortDir | `minWidth: 560` hardcoded |
| FrictionCircleChart | charts/FrictionCircleChart.tsx | ~4 KB | Lateral vs long G scatter | None | Possible duplicate of FrictionScatterChart |
| FrictionScatterChart | charts/FrictionScatterChart.tsx | ~4 KB | G force distribution | None | Possible duplicate |
| ThermalChart | charts/ThermalChart.tsx | 3.8 KB | Oil/trans/coolant bars | None | None |
| TrackHeatMap | charts/TrackHeatMap.tsx | 15+ KB | Leaflet GPS overlay | channel, zoom, tiles | Most complex component; no offline tile cache |
| TrackMapChart | charts/TrackMapChart.tsx | ~5 KB | OSM geometry map | None | None |

---

## Route / Navigation Map

No React Router — navigation is tab-based state in App.tsx.

| Tab ID | Label | Mobile | Desktop | Content |
|--------|-------|--------|---------|---------|
| `session` | Session | ✓ | ✓ | Weather + Summary + Coaching + Lap times |
| `map` | Map | ✓ | ✓ | Full-height TrackHeatMap |
| `corners` | Corners | ✓ | ✓ | Corner speeds + detail + friction |
| `health` | Health | ✓ | ✓ | Thermals + readiness provider |
| `notes` | Notes | ✓ | ✓ | Debrief text per session |

**Last active tab** persists in IndexedDB (via useMemory).

---

## State Management

| State | Where | Mechanism | iOS Safe? |
|-------|-------|-----------|-----------|
| Active tab | App.tsx + memory.ts | IndexedDB | ✓ |
| User auth | App.tsx | localStorage `m3-auth-user` | ⚠️ |
| Sessions metadata | usePersistedSessions | localStorage `m3-sessions-v1` | ❌ |
| Session data | usePersistedSessions | localStorage `session:{id}` | ❌ |
| Active session IDs | usePersistedSessions | localStorage | ❌ |
| WHOOP tokens | whoopAuth.ts | localStorage `whoop-tokens` | ⚠️ |
| Strava tokens | stravaAuth.ts | localStorage `strava-tokens` | ⚠️ |
| Debrief notes | DebriefNotes.tsx | localStorage `notes:{id}` | ❌ (duplicated in memory.ts!) |
| Health connected | App.tsx | React state (lost on refresh) | ⚠️ |
| Track history | memory.ts | IndexedDB | ✓ |
| Preferences | memory.ts | IndexedDB | ✓ |
| Install dismissed | InstallPrompt.tsx | localStorage | ❌ |

### Prop Drilling Chains (max depth found: 3)

No chains deeper than 3 levels detected. Callbacks are passed directly.

---

## Data Sources

| Source | Type | Integration | Status | Error Handling |
|--------|------|-------------|--------|----------------|
| RaceChrono CSV | File upload | DropZone → parseRacechronoCsv | ✓ Working | toast.error on failure |
| RaceChrono CSV | Google Drive | DrivePickerButton → Drive API | ✓ Working | toast.error on failure |
| WHOOP API | OAuth2 (Cloudflare proxy) | whoopAuth + whoopApi | ✓ Working | Error state shown |
| Strava API | OAuth2 (Cloudflare proxy) | stravaAuth + stravaApi | ✓ Working | Error state shown |
| Oura API | PAT (env var) | ouraApi | ✓ Working | Setup message shown |
| Open-Meteo | REST (no key) | WeatherWidget | ✓ Working | Silent fail |
| OpenStreetMap | Overpass API | osmTrackFetch | ✓ Working | None detected |
| Track layouts | Static TS | trackLayouts.ts | ✓ Working | Fallback to null |
| Track photos | Static base64 | trackPhoto.ts | ✓ Working | None needed |

---

## Best Lap Time — All 6 Duplication Instances

This is owner-reported. Each instance shows `consistency.best_lap_s` in a different way:

| # | Location | Display | Visible On | Verdict |
|---|----------|---------|-----------|---------|
| 1 | App.tsx header (centered) | Large purple number + "Best Lap" label | Desktop only (hidden md:flex) | **REMOVE** — redundant with #2 |
| 2 | SessionStats.tsx | Large card with lap count | Session tab | **KEEP** — primary authoritative display |
| 3 | LapInfoPanel.tsx | F1-style per-session | Desktop left sidebar | **KEEP** — different context (per-session comparison) |
| 4 | LapList (App.tsx inline) | Purple ● marker on best row | Desktop left sidebar | **KEEP** — lap-level identification, not a standalone metric |
| 5 | LapTimesChart.tsx | Dashed reference line | Session tab chart | **KEEP** — visual reference within chart, not a labeled metric |
| 6 | LapInfoPanel consistency bar | Dot marking best position | Desktop left sidebar | **KEEP** — part of sparkline, not standalone |

**Conclusion:** Only instance #1 (header center display) is a true redundant standalone metric. The others serve distinct purposes. Remove the header center display.

---

## localStorage Usage — Full Inventory

```
Key                        Size est.   Component              Fix
─────────────────────────────────────────────────────────────────
m3-auth-user               ~300 B      App.tsx:64             → IndexedDB memory.ts
m3-sessions-v1             ~5 KB       usePersistedSessions   → IndexedDB
session:{id}               ~1-10 MB    usePersistedSessions   → IndexedDB
notes:{sessionId}          ~2 KB       DebriefNotes           → memory.ts (already there)
install_prompt_dismissed   ~5 B        InstallPrompt          → memory.ts
strava-tokens              ~500 B      stravaAuth.ts          → memory.ts (acceptable for OAuth)
strava-oauth-state         ~10 B       stravaAuth.ts          ✓ sessionStorage (correct)
whoop-tokens               ~500 B      whoopAuth.ts           → memory.ts
whoop-oauth-state          ~10 B       whoopAuth.ts           ✓ sessionStorage (correct)
```

**Total estimated localStorage usage:** Up to 30 MB (10 sessions × 3 MB avg)
**iOS PWA limit:** ~5-10 MB before eviction risk
**Result:** Data loss is possible on iOS with more than 2-3 large sessions loaded.

---

## CSS / Styling Audit

### Inline Style Hotspots

| File | Inline style count | Primary issue |
|------|--------------------|---------------|
| App.tsx | ~25 | Header bg gradient, clamp() sizes, track colors |
| WhoopPanel.tsx | ~40 | Dynamic color computations on every render |
| LapInfoPanel.tsx | ~20 | Mixes `FS.small` tokens with hardcoded px |
| CornerDetailTable.tsx | ~10 | `minWidth: 560` hardcoded |
| StravaPanel.tsx | ~15 | All inline, no Tailwind |

### Hardcoded Values to Extract

- `fontSize: '10px'` → `FS.nano` (use existing token)
- `fontSize: '20px'`, `'26px'` → `FS.large`, `FS.hero`
- `minWidth: 560` → responsive class
- `height: clamp(72px, ...)` → CSS custom property

### Design Token Usage (Positive)

`chartTheme.ts` provides `T`, `S`, `FF`, `FS`, `CHANNEL_COLORS`, `SESSION_COLORS`, `AXIS_STYLE`, `TOOLTIP_STYLE`. Chart components use these consistently. Non-chart components mostly ignore them.

---

## Service Worker Status

`public/sw.js` (883 bytes) — placeholder only:
```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.matchAll().then(...));
// No fetch handler → no caching
```

App shell is **not cached**. Second visit fetches everything from network. This must be replaced with vite-plugin-pwa.

---

## Bundle Analysis

| Chunk | Est. Size | Notes |
|-------|-----------|-------|
| vendor (React) | ~250 KB | Code-split ✓ |
| charts (Recharts) | ~180 KB | Code-split ✓ |
| d3 | ~160 KB | Code-split ✓ |
| app (main) | ~150 KB | Includes all components eagerly |
| CSS (Tailwind) | ~68 KB | Purged ✓ |
| **Total** | **~808 KB** | Near chunk size warning (800 KB) |

**No lazy loading** of chart components. All load on first visit.

---

## UX Issues (Prioritized)

### Critical
1. **Data loss on iOS** — localStorage sessions can be evicted. Users lose sessions without warning.
2. **No offline support** — app fails completely with no network after first load.

### High
3. **Best lap header duplicate** — same number shown in header AND SessionStats card simultaneously on desktop.
4. **Car name still in login screen** — LoginScreen still renders `config.carName` below logo — brand-specific content in a tool meant for all drivers.

### Medium
5. **WhoopPanel 40+ inline styles** — computed on every render, no memoization.
6. **CornerDetailTable horizontal scroll** — `minWidth: 560` on mobile causes unexpected scroll.
7. **No loading skeleton** — charts show nothing while data processes. No skeleton or spinner.
8. **FrictionCircle vs FrictionScatter** — two friction charts in the Corners tab; unclear differentiation.
9. **Empty 'map' tab on desktop** — when no session loaded, map tab shows EmptyDashboard but mobile loading strip is above it; visually confusing.

### Low
10. **App.tsx 23.5 KB** — inline LapList, Section, EmptyDashboard should be extracted.
11. **LapInfoPanel font size inconsistency** — `FS.small` mixed with hardcoded `'20px'`.
12. **DebriefNotes uses localStorage** despite memory.ts already having `debriefNotes` in IndexedDB.
13. **InstallPrompt uses localStorage** — minor, easy fix.
14. **WhoopPanel shows "Connect WHOOP"** even when `config.healthProvider !== 'whoop'` — handled by ReadinessTab but WhoopPanel itself has its own connect button.
15. **Track photo base64 file** — `src/assets/trackPhoto.ts` is ~272 KB of base64 strings, inflating the JS bundle.

---

## What Already Works Well

- TypeScript strict mode throughout ✓
- WCAG AA contrast compliance on dark background ✓
- Safe area inset handling in header ✓
- PWA manifest correct (icons, display, theme) ✓
- OAuth state tokens in sessionStorage (correct) ✓
- chartTheme.ts as single source of truth for chart styling ✓
- ErrorBoundary wrapping critical views ✓
- CSV parser is robust with outlier detection ✓
- Responsive layout with clamp() throughout ✓
- No prop drilling chains >3 levels ✓

---

## Recommended Fix Sequence

| Priority | Task | Phase | Effort |
|----------|------|-------|--------|
| 1 | Migrate session + auth storage to IndexedDB | Phase 8 | Medium |
| 2 | Remove header best lap duplicate | Phase 6 | Trivial |
| 3 | Remove car name from login screen | Phase 6 | Trivial |
| 4 | Replace service worker with vite-plugin-pwa | Phase 8 | Low |
| 5 | PWA shell + safe area polish | Phase 1 | Low (mostly done) |
| 6 | Implement drag/drop grid (react-grid-layout) | Phase 2 | High |
| 7 | Bottom tab bar + sidebar navigation | Phase 4 | Medium |
| 8 | Touch gesture system | Phase 3 | Medium |
| 9 | Typography system (system fonts) | Phase 5 | Low |
| 10 | Desktop power features (⌘+K, shortcuts) | Phase 7 | Medium |
| 11 | Lazy-load charts | Phase 8 | Low |
| 12 | Extract App.tsx sub-components | Phase 9 | Low |
| 13 | Fix DebriefNotes localStorage → memory.ts | Phase 8 | Trivial |

---

## Trivial Fixes to Apply Immediately (Pre-Phase 1)

These are safe, low-risk improvements that can be committed immediately:

1. **Remove header best lap display** (App.tsx:245-268) — owner-reported duplicate
2. **Remove car name from LoginScreen** — generic tool, not car-specific
3. **Fix DebriefNotes** — use memory.ts instead of its own localStorage key
4. **Fix InstallPrompt** — use memory.ts instead of localStorage

---

*Audit complete. No code was modified during this phase. All findings are observational.*
