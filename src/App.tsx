import { useState, useEffect, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { LoginScreen } from '@/components/LoginScreen';
import { Toaster } from 'sonner';
import { DropZone } from '@/components/DropZone';
import { SessionList } from '@/components/SessionList';
import { SessionStats } from '@/components/SessionStats';
import { LapTimesChart } from '@/components/charts/LapTimesChart';
import { CornerSpeedChart } from '@/components/charts/CornerSpeedChart';
import { ThermalChart } from '@/components/charts/ThermalChart';
import { FrictionCircleChart } from '@/components/charts/FrictionCircleChart';
import { CornerDetailTable } from '@/components/charts/CornerDetailTable';
import { TrackHeatMap } from '@/components/charts/TrackHeatMap';
import { FrictionScatterChart } from '@/components/charts/FrictionScatterChart';
import { DebriefNotes } from '@/components/DebriefNotes';
import { CoachingInsights } from '@/components/CoachingInsights';
import { DrivePickerButton } from '@/components/DrivePickerButton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WeatherWidget } from '@/components/WeatherWidget';
import { InstallPrompt } from '@/components/InstallPrompt';
import { CommandPalette } from '@/components/CommandPalette';
import { ProgressTab } from '@/components/ProgressTab';
import { PrintView } from '@/components/PrintView';
import { SharedSessionView } from '@/components/SharedSessionView';
import { PanelGroup, Panel, PanelResizeHandle } from '@/components/ui/resizable';

import { Header } from '@/components/Header';
import { Section } from '@/components/Section';
import { LapList } from '@/components/LapList';
import { EmptyDashboard } from '@/components/EmptyDashboard';
import { MobileNav, MOBILE_TABS } from '@/components/MobileNav';
import { DesktopTabs, DESKTOP_TABS } from '@/components/DesktopTabs';

import { decodeSession } from '@/lib/shareSession';
import { readProfile, type UserProfile } from '@/lib/userProfile';
import { ProfileSetup } from '@/components/ProfileSetup';
import { AISettings } from '@/components/AISettings';
import { usePersistedSessions } from '@/lib/usePersistedSessions';
import { sessionLabel, formatLapTime } from '@/lib/utils';
import { useMemory } from '@/hooks/useMemory';
import { LapInfoPanel } from '@/components/LapInfoPanel';
import { findTrackLayout } from '@/assets/trackLayouts';
import { useShareTarget } from '@/hooks/useShareTarget';
import { useDriveAutoImport } from '@/hooks/useDriveAutoImport';
import { useDriveNotesSync } from '@/hooks/useDriveNotesSync';
import { ExpertCoach } from '@/components/ExpertCoach';

import { ThemeProvider, useTheme } from '@/lib/ThemeContext';

const AUTH_KEY = 'apex-lab-auth-user';

interface AuthUser {
  email: string;
  name: string;
  picture: string;
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

function AppInner() {
  const { resolvedTheme } = useTheme();
  const store = usePersistedSessions();
  const { memory, loaded, update } = useMemory();
  const [activeTab, setActiveTab] = useState('session');
  const [selectedCornerId, setSelectedCornerId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sharedSummary, setSharedSummary] = useState(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      return decodeSession(hash.slice(7));
    }
    return null;
  });
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [sidebarLayout, setSidebarLayout] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('apex-sidebar-layout') ?? 'null') ?? {};
    } catch {
      return {};
    }
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const r = localStorage.getItem(AUTH_KEY);
      return r ? JSON.parse(r) : null;
    } catch {
      return null;
    }
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const signOut = useCallback(() => {
    setUser(null);
    setProfile(null);
    setShowProfileSetup(false);
  }, []);

  // Load user profile from IDB when user logs in
  const userEmail = user?.email;
  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;
    readProfile(userEmail).then(p => {
      if (cancelled) return;
      setProfile(p);
      if (!p || !p.carName) setShowProfileSetup(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  // Feature hooks
  useShareTarget(store);
  useDriveAutoImport(driveAccessToken, store, store.hydrated);
  const { syncToCloud } = useDriveNotesSync(driveAccessToken, memory, loaded, update);

  // Restore last active tab
  useEffect(() => {
    if (!loaded) return;
    let saved = memory.lastActiveTab || 'session';
    if (saved === 'health') saved = 'coach';
    if (saved === 'map' || saved === 'corners') saved = 'track';
    if (saved === 'load') saved = 'session';
    if (saved === 'notes') saved = 'session';
    queueMicrotask(() => setActiveTab(saved));
  }, [loaded]); // eslint-disable-line

  useEffect(() => {
    if (loaded) update({ lastActiveTab: activeTab });
  }, [activeTab, loaded]); // eslint-disable-line

  // Swipe left/right to navigate tabs on mobile
  const MOBILE_TAB_IDS = MOBILE_TABS.map(t => t.id);
  const navigateTab = useCallback(
    (dir: 1 | -1) => {
      setActiveTab(prev => {
        const idx = MOBILE_TAB_IDS.indexOf(prev);
        const next = idx + dir;
        return next >= 0 && next < MOBILE_TAB_IDS.length ? MOBILE_TAB_IDS[next] : prev;
      });
    },
    [] // eslint-disable-line
  );

  const bindSwipe = useDrag(
    ({ swipe: [swipeX] }) => {
      if (activeTab === 'track') return; // leave map gestures to Leaflet
      if (swipeX === -1) navigateTab(1);
      if (swipeX === 1) navigateTab(-1);
    },
    {
      filterTaps: true,
      axis: 'x',
      swipe: { distance: [50, 50], velocity: [0.3, 0.3] },
    }
  );

  // Desktop keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= DESKTOP_TABS.length) {
        setActiveTab(DESKTOP_TABS[n - 1].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Track history updates
  useEffect(() => {
    if (!loaded) return;
    const entries = store.activeSessions.map(s => ({
      sessionId: s.id,
      track: s.data.header.track,
      date: s.data.header.date,
      bestLap: formatLapTime(s.data.consistency.best_lap_s),
      lapCount: s.data.header.analyzed_laps,
    }));
    if (entries.length > 0) {
      update({
        trackHistory: [
          ...memory.trackHistory.filter(h => !entries.find(e => e.sessionId === h.sessionId)),
          ...entries,
        ].slice(-20),
      });
    }
  }, [store.activeSessions.map(s => s.id).join(','), loaded]); // eslint-disable-line

  // Persist auth
  useEffect(() => {
    if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_KEY);
  }, [user]);

  if (!user) return <LoginScreen onAuth={setUser} />;

  // Loading state
  if (!store.hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span
            style={{
              fontFamily: 'BMWTypeNext',
              fontSize: 12,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            Loading
          </span>
        </div>
      </div>
    );
  }

  const activeTrackLayout = findTrackLayout(store.activeSessions[0]?.data.header.track);

  // Shared session read-only overlay
  if (sharedSummary) {
    return (
      <>
        <SharedSessionView
          summary={sharedSummary}
          onClose={() => {
            setSharedSummary(null);
            window.history.replaceState({}, '', window.location.pathname);
          }}
        />
        <Toaster position="bottom-right" richColors theme={resolvedTheme} />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Toaster position="bottom-right" richColors theme={resolvedTheme} />
      <PrintView sessions={store.activeSessions} />

      {showProfileSetup && user && (
        <ProfileSetup
          email={user.email}
          onSave={p => {
            setProfile(p);
            setShowProfileSetup(false);
          }}
        />
      )}

      {settingsOpen && user && (
        <AISettings
          email={user.email}
          onClose={() => setSettingsOpen(false)}
          onSave={p => {
            setProfile(p);
            setSettingsOpen(false);
          }}
        />
      )}

      <Header
        user={user}
        profile={profile}
        activeTrackLayout={activeTrackLayout}
        hasActiveSessions={store.activeSessions.length > 0}
        onSettingsOpen={() => setSettingsOpen(true)}
        onPaletteOpen={() => setPaletteOpen(true)}
        onSignOut={signOut}
      />

      {/* MOBILE layout */}
      <div className="flex flex-col flex-1 min-h-0 lg:hidden" {...bindSwipe()} style={{ touchAction: 'pan-y' }}>
        <div className="flex-1 overflow-y-auto scroll-touch p-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <DropZone compact onSessionLoaded={store.addSession} />
            </div>
            <DrivePickerButton compact onSessionLoaded={store.addSession} onTokenChange={setDriveAccessToken} />
          </div>
          {store.activeSessions.length === 0 && activeTab !== 'progress' ? (
            <EmptyDashboard />
          ) : (
            <TabContent
              tab={activeTab}
              store={store}
              profile={profile}
              userEmail={userEmail}
              driveAccessToken={driveAccessToken}
              memory={memory}
              selectedCornerId={selectedCornerId}
              setSelectedCornerId={setSelectedCornerId}
              syncToCloud={syncToCloud}
              activeTrackLayout={activeTrackLayout}
            />
          )}
        </div>
      </div>

      {/* DESKTOP layout */}
      <div className="hidden lg:flex flex-1 min-h-0">
        <PanelGroup
          orientation="horizontal"
          defaultLayout={Object.keys(sidebarLayout).length > 0 ? sidebarLayout : undefined}
          onLayoutChanged={layout => {
            setSidebarLayout(layout);
            try {
              localStorage.setItem('apex-sidebar-layout', JSON.stringify(layout));
            } catch {
              /* quota */
            }
          }}
        >
          <Panel id="sidebar" defaultSize="24" minSize="16" maxSize="40" className="flex flex-col border-r border-border bg-card">
            <div className="shrink-0 p-2.5 space-y-2 border-b border-border">
              <div className="flex gap-2">
                <div className="flex-1">
                  <DropZone compact onSessionLoaded={store.addSession} />
                </div>
                <DrivePickerButton compact onSessionLoaded={store.addSession} onTokenChange={setDriveAccessToken} />
              </div>
              {store.sessions.length > 0 && (
                <SessionList
                  sessions={store.sessions}
                  activeIds={store.activeSessionIds}
                  onToggle={store.toggleActive}
                  onRemove={store.removeSession}
                  onRename={store.renameSession}
                  onClearAll={store.clearAll}
                />
              )}
              {store.sessions.length === 0 && (
                <div className="py-0.5 text-[12px] tracking-wider text-muted-foreground uppercase">
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Export CSV from RaceChrono</li>
                    <li>Drop here or load from Drive</li>
                  </ol>
                </div>
              )}
              {store.sessions.length > 0 && (
                <button
                  onClick={store.clearSavedSessions}
                  className="text-[10px] tracking-widest text-muted-foreground/25 hover:text-destructive transition-colors uppercase"
                >
                  Clear saved sessions
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scroll-touch">
              <LapInfoPanel sessions={store.activeSessions} />
              <LapList sessions={store.activeSessions} />
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/50 active:bg-primary/70 transition-colors cursor-col-resize" />

          <Panel id="main" className="flex flex-col min-w-0">
            {store.activeSessions.length > 0 ? (
              <div className="flex flex-col h-full">
                <DesktopTabs activeTab={activeTab} onTabChange={setActiveTab} />
                <div className="flex-1 overflow-y-auto scroll-touch p-4">
                  <TabContent
                    tab={activeTab}
                    store={store}
                    profile={profile}
                    userEmail={userEmail}
                    driveAccessToken={driveAccessToken}
                    memory={memory}
                    selectedCornerId={selectedCornerId}
                    setSelectedCornerId={setSelectedCornerId}
                    syncToCloud={syncToCloud}
                    activeTrackLayout={activeTrackLayout}
                  />
                </div>
              </div>
            ) : (
              <main className="flex-1 overflow-y-auto scroll-touch p-4">
                <EmptyDashboard />
              </main>
            )}
          </Panel>
        </PanelGroup>
      </div>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
      <InstallPrompt />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={setActiveTab}
        onClearAll={store.clearAll}
        onSignOut={signOut}
        hasData={store.sessions.length > 0}
      />
    </div>
  );
}

// ── Tab Content ────────────────────────────────────────────────────────────────
interface TabContentProps {
  tab: string;
  store: ReturnType<typeof usePersistedSessions>;
  profile: UserProfile | null;
  userEmail: string | undefined;
  driveAccessToken: string | null;
  memory: ReturnType<typeof useMemory>['memory'];
  selectedCornerId: string | null;
  setSelectedCornerId: (id: string | null) => void;
  syncToCloud: () => void;
  activeTrackLayout: ReturnType<typeof findTrackLayout>;
}

function TabContent({
  tab,
  store,
  profile,
  userEmail,
  driveAccessToken,
  memory,
  selectedCornerId,
  setSelectedCornerId,
  syncToCloud,
  activeTrackLayout,
}: TabContentProps) {
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

  switch (tab) {
    case 'session':
      return (
        <div className="space-y-4">
          {activeTrackLayout && store.activeSessions[0] && (
            <Section title="Track Conditions">
              <WeatherWidget
                date={store.activeSessions[0].data.header.date}
                lat={activeTrackLayout.waypoints[0][0]}
                lon={activeTrackLayout.waypoints[0][1]}
              />
            </Section>
          )}
          <Section title="Session Summary">
            <ErrorBoundary>
              <SessionStats sessions={store.activeSessions} />
            </ErrorBoundary>
          </Section>
          <Section title="Coaching">
            <ErrorBoundary>
              <CoachingInsights sessions={store.activeSessions} profile={profile} trackHistory={memory.trackHistory} />
            </ErrorBoundary>
          </Section>
          <Section title="Engine Thermals">
            <ErrorBoundary>
              <ThermalChart sessions={store.activeSessions} />
            </ErrorBoundary>
          </Section>
          <Section title="Lap Times">
            <ErrorBoundary>
              <LapTimesChart sessions={store.activeSessions} />
            </ErrorBoundary>
          </Section>
          <Section title="Debrief Notes">
            {store.activeSessions.map(s => (
              <div key={s.id} className="space-y-1 mb-4">
                {store.activeSessions.length > 1 && (
                  <p className="text-xs tracking-wider text-muted-foreground uppercase mb-2">{sessionLabel(s)}</p>
                )}
                <DebriefNotes sessionId={s.id} onCloudSync={syncToCloud} />
              </div>
            ))}
          </Section>
        </div>
      );

    case 'track':
      return (
        <div className="space-y-3">
          <div className="h-[55vh] min-h-[300px] max-h-[600px]">
            <TrackHeatMap
              sessions={store.activeSessions}
              selectedCornerId={selectedCornerId}
              onCornerSelect={setSelectedCornerId}
            />
          </div>
          <Section title="Corner Apex Speeds">
            <ErrorBoundary>
              <CornerSpeedChart sessions={store.activeSessions} />
            </ErrorBoundary>
          </Section>
          <Section title="Corner Detail">
            <ErrorBoundary>
              <CornerDetailTable sessions={store.activeSessions} />
            </ErrorBoundary>
          </Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Section title="G-Force Envelope">
              <ErrorBoundary>
                <FrictionCircleChart sessions={store.activeSessions} />
              </ErrorBoundary>
            </Section>
            <Section title="Friction Circle">
              <ErrorBoundary>
                <FrictionScatterChart sessions={store.activeSessions} />
              </ErrorBoundary>
            </Section>
          </div>
        </div>
      );

    case 'coach':
      return (
        <Section title="Expert Coach">
          <ErrorBoundary>
            <ExpertCoach
              sessions={store.sessions}
              profile={profile}
              userEmail={userEmail ?? ''}
              driveAccessToken={driveAccessToken}
              debriefNotes={memory.debriefNotes}
            />
          </ErrorBoundary>
        </Section>
      );

    default:
      return null;
  }
}
