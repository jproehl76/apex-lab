# Branch 1: feature/progress-tab

## What this does
Adds the 6th "Progress" tab (personal bests, lap time progression, consistency trends) and fixes two bugs (DebriefNotes iOS data loss, SessionStats mobile overflow).

## Pre-built files
The following files were built and verified in a prior session. They are ready to drop in.

## Instructions

```bash
git checkout main && git pull
git checkout -b feature/progress-tab
```

### File 1: NEW — src/components/ProgressTab.tsx
Create this file. It's 587 lines. The component renders three sections:
- Personal Bests Board (best lap per track, auto-populated)
- Lap Time Progression Chart (Recharts, Y-axis reversed, track-branded colors)
- Consistency Trend Chart (std_dev_s over time, ±1.5s target reference line)

It reads from `memory.trackHistory` (IndexedDB-persisted) + `store.sessions` (loaded sessions). Works even with zero active sessions.

### File 2: MODIFIED — src/App.tsx
Three surgical changes:
1. Add import: `import { ProgressTab } from '@/components/ProgressTab';`
2. Add to DESKTOP_TABS array: `{ id: 'progress', label: 'Progress' }`
3. Add to MOBILE_TABS array: `{ id: 'progress', label: 'Progress', Icon: () => <span style={{ fontSize: 18 }}>↗</span> }`
4. In `renderTabContent`, add the progress case BEFORE the empty-state guard so it works from empty state:
```tsx
if (tab === 'progress') {
  return (
    <Section title="Session Progression">
      <ErrorBoundary>
        <ProgressTab sessions={store.sessions} trackHistory={memory.trackHistory} />
      </ErrorBoundary>
    </Section>
  );
}
if (store.activeSessions.length === 0) return <EmptyDashboard />;
```

### File 3: REWRITTEN — src/components/DebriefNotes.tsx
**Bug fix**: Was using `localStorage` directly — iOS evicts localStorage on PWAs.
- Now reads/writes via `useMemory()` hook → `AppMemory.debriefNotes` (IndexedDB-backed)
- One-time migration: detects existing localStorage notes and moves them to IndexedDB
- Shows loading skeleton while IndexedDB hydrates
- Increased textarea rows from 4 to 6

### File 4: MODIFIED — src/components/SessionStats.tsx
**Bug fix**: KPI cards overlapping on mobile (iPhone screen width).
- Value font: fixed `26px` → `clamp(18px, 5.5vw, 26px)`
- Best Lap hero: `32px` → `28px`
- Added `overflow-hidden` + `truncate`
- Reduced card padding: `p-3 sm:p-4`

## Verify and push

```bash
pnpm install
npx tsc --noEmit
npx vite build
git add -A
git commit -m "feat: add Progress tab, fix DebriefNotes iOS persistence, fix SessionStats mobile overflow"
git push -u origin feature/progress-tab
```

Then merge the PR on GitHub before proceeding to Branch 2.
