import { useState, useEffect, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import { LogOut, Heart, MapIcon, Bell } from 'lucide-react';
import { LoginScreen } from '@/components/LoginScreen';
import { Toaster, toast } from 'sonner';
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
import { ReadinessTab } from '@/components/ReadinessTab';
import { WeatherWidget } from '@/components/WeatherWidget';
import { InstallPrompt } from '@/components/InstallPrompt';
import { CommandPalette } from '@/components/CommandPalette';
import { PrintButton } from '@/components/PrintButton';
import { ProgressTab } from '@/components/ProgressTab';
import { PrintView } from '@/components/PrintView';
import { SharedSessionView } from '@/components/SharedSessionView';
import { PanelGroup, Panel, PanelResizeHandle } from '@/components/ui/resizable';
import apexLabLogo from '@/assets/jp-apex-lab-logo.png';
import { handleWhoopCallback } from '@/lib/services/whoopAuth';
import { handleStravaCallback } from '@/lib/services/stravaAuth';
import { decodeSession } from '@/lib/shareSession';
import { config } from '@/config';
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
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Settings } from 'lucide-react';
import React from 'react';

const AUTH_KEY = 'apex-lab-auth-user';

interface AuthUser { email: string; name: string; picture: string }

// 5 tabs
// Session  = stats + coaching + lap times
// Map      = GPS heat map with speed/throttle/brake channels
// Corners  = corner speeds + detail + friction scatter
// Health   = thermals + driver readiness
// Notes    = debrief
const DESKTOP_TABS = [
  { id: 'session',  label: 'Session'  },
  { id: 'map',      label: 'Map'      },
  { id: 'corners',  label: 'Corners'  },
  { id: 'health',   label: 'Health'   },
  { id: 'notes',    label: 'Notes'    },
  { id: 'progress', label: 'Progress' },
];

const MOBILE_TABS = [
  { id: 'map',      label: 'Map',     Icon: MapIcon },
  { id: 'session',  label: 'Session', Icon: () => <span style={{ fontSize: 18 }}>⊞</span> },
  { id: 'corners',  label: 'Corners', Icon: () => <span style={{ fontSize: 18 }}>◎</span> },
  { id: 'health',   label: 'Health',  Icon: Heart },
  { id: 'notes',    label: 'Notes',   Icon: () => <span style={{ fontSize: 18 }}>✎</span> },
  { id: 'progress', label: 'Progress', Icon: () => <span style={{ fontSize: 18 }}>↗</span> },
];

export default function App() {
  const store = usePersistedSessions();
  const { memory, loaded, update } = useMemory();
  const [activeTab, setActiveTab] = useState('session');
  const [selectedCornerId, setSelectedCornerId] = useState<string | null>(null);
  const [healthConnected, setHealthConnected] = useState(false);
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
    try { return JSON.parse(localStorage.getItem('apex-sidebar-layout') ?? 'null') ?? {}; }
    catch { return {}; }
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { const r = localStorage.getItem(AUTH_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
  });
  const [profile, setProfile]               = useState<UserProfile | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [settingsOpen, setSettingsOpen]     = useState(false);

  // Load user profile from IDB when user logs in
  useEffect(() => {
    if (!user) { setProfile(null); setShowProfileSetup(false); return; }
    readProfile(user.email).then(p => {
      setProfile(p);
      if (!p || !p.carName) setShowProfileSetup(true);
    });
  }, [user?.email]); // eslint-disable-line

  // Feature hooks
  useShareTarget(store);
  useDriveAutoImport(driveAccessToken, store, store.hydrated);
  const push = usePushNotifications();

  useEffect(() => { if (loaded) setActiveTab(memory.lastActiveTab || 'session'); }, [loaded]); // eslint-disable-line
  useEffect(() => { if (loaded) update({ lastActiveTab: activeTab }); }, [activeTab, loaded]); // eslint-disable-line

  // Swipe left/right to navigate tabs on mobile
  const MOBILE_TAB_IDS = MOBILE_TABS.map(t => t.id);
  const navigateTab = useCallback((dir: 1 | -1) => {
    setActiveTab(prev => {
      const idx = MOBILE_TAB_IDS.indexOf(prev);
      const next = idx + dir;
      return next >= 0 && next < MOBILE_TAB_IDS.length ? MOBILE_TAB_IDS[next] : prev;
    });
  }, []); // eslint-disable-line
  const bindSwipe = useDrag(({ swipe: [swipeX] }) => {
    if (activeTab === 'map') return; // leave map gestures to Leaflet
    if (swipeX === -1) navigateTab(1);
    if (swipeX === 1) navigateTab(-1);
  }, {
    filterTaps: true,
    axis: 'x',
    swipe: { distance: [50, 50], velocity: [0.3, 0.3] },
  });

  // Desktop keyboard shortcuts: 1–5 jump tabs, ? shows help
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

  useEffect(() => {
    if (!loaded) return;
    const entries = store.activeSessions.map(s => ({
      sessionId: s.id, track: s.data.header.track, date: s.data.header.date,
      bestLap: formatLapTime(s.data.consistency.best_lap_s), lapCount: s.data.header.analyzed_laps,
    }));
    if (entries.length > 0) {
      update({ trackHistory: [...memory.trackHistory.filter(h => !entries.find(e => e.sessionId === h.sessionId)), ...entries].slice(-20) });
    }
  }, [store.activeSessions.map(s => s.id).join(','), loaded]); // eslint-disable-line

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get('code'), state = p.get('state');
    if (code && state) {
      window.history.replaceState({}, '', window.location.pathname);
      if (config.healthProvider === 'strava') {
        handleStravaCallback(code, state).then(ok => {
          if (ok) { setHealthConnected(true); toast.success('Strava connected'); }
          else toast.error('Strava connection failed');
        }).catch(() => toast.error('Strava connection failed'));
      } else {
        handleWhoopCallback(code, state).then(ok => {
          if (ok) { setHealthConnected(true); toast.success('WHOOP connected'); }
          else toast.error('WHOOP connection failed');
        }).catch(() => toast.error('WHOOP connection failed'));
      }
    }
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_KEY);
  }, [user]);

  if (!user) return <LoginScreen onAuth={setUser} />;

  // Brief overlay while sessions rehydrate from IndexedDB
  if (!store.hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
            Loading
          </span>
        </div>
      </div>
    );
  }

  const sessionDates = store.activeSessions.map(s => s.data.header.date);

  // Track branding for header
  const activeTrackLayout = findTrackLayout(store.activeSessions[0]?.data.header.track);
  const trackPrimary = activeTrackLayout?.colors.primary ?? config.defaultPrimaryColor;
  const trackAccent  = activeTrackLayout?.colors.accent  ?? config.defaultAccentColor;
  const trackLogo    = activeTrackLayout?.logo;

  function renderTabContent(tab: string) {
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
      case 'session': return (
        <div className="space-y-4">
          {/* Track conditions — weather for session date */}
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
            <ErrorBoundary><SessionStats sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          <Section title="Coaching">
            <ErrorBoundary><CoachingInsights sessions={store.activeSessions} profile={profile} trackHistory={memory.trackHistory} /></ErrorBoundary>
          </Section>
          <Section title="Lap Times">
            <ErrorBoundary><LapTimesChart sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
        </div>
      );
      case 'corners': return (
        <div className="space-y-3">
          {/* Row 1: Corner Apex Speeds — full width */}
          <Section title="Corner Apex Speeds">
            <ErrorBoundary><CornerSpeedChart sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          {/* Row 2: Corner Detail — full width */}
          <Section title="Corner Detail">
            <ErrorBoundary><CornerDetailTable sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          {/* Row 3: G-Force Envelope + Friction Circle side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Section title="G-Force Envelope">
              <ErrorBoundary><FrictionCircleChart sessions={store.activeSessions} /></ErrorBoundary>
            </Section>
            <Section title="Friction Circle">
              <ErrorBoundary><FrictionScatterChart sessions={store.activeSessions} /></ErrorBoundary>
            </Section>
          </div>
        </div>
      );
      case 'health': return (
        <div className="space-y-4">
          <Section title="Engine Thermals">
            <ErrorBoundary><ThermalChart sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          {/* ReadinessTab handles connect state + renders WhoopPanel when connected */}
          {config.healthProvider !== null && (
            <Section title="Driver Readiness">
              <ErrorBoundary><ReadinessTab sessionDates={sessionDates} connectedOverride={healthConnected} /></ErrorBoundary>
            </Section>
          )}
        </div>
      );
      case 'notes': return (
        <Section title="Debrief Notes">
          {store.activeSessions.map(s => (
            <div key={s.id} className="space-y-1 mb-4">
              {store.activeSessions.length > 1 && (
                <p className="text-xs tracking-wider text-muted-foreground uppercase mb-2">{sessionLabel(s)}</p>
              )}
              <DebriefNotes sessionId={s.id} />
            </div>
          ))}
        </Section>
      );
      default: return null;
    }
  }

  // Shared session read-only overlay (URL hash #share=...)
  if (sharedSummary) {
    return (
      <>
        <SharedSessionView summary={sharedSummary} onClose={() => {
          setSharedSummary(null);
          window.history.replaceState({}, '', window.location.pathname);
        }} />
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Toaster position="bottom-right" richColors />
      <PrintView sessions={store.activeSessions} />
      {showProfileSetup && user && (
        <ProfileSetup
          email={user.email}
          onSave={p => { setProfile(p); setShowProfileSetup(false); }}
        />
      )}
      {settingsOpen && user && (
        <AISettings
          email={user.email}
          onClose={() => setSettingsOpen(false)}
          onSave={p => { setProfile(p); setSettingsOpen(false); }}
        />
      )}

      {/* ── HEADER ── */}
      <header className="relative shrink-0 overflow-hidden" style={{
        height: 'calc(clamp(72px, 13.2vh, 144px) + env(safe-area-inset-top))',
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}>
        {/* CSS motorsport background — adapts to track colors */}
        <div className="absolute inset-0" style={{
          background: `
            linear-gradient(105deg,
              #0E0E1A 0%,
              #121220 22%,
              ${trackPrimary}38 52%,
              ${trackAccent}20 75%,
              #0E0E1A 100%
            )
          `,
        }} />
        {/* Subtle diagonal stripe texture */}
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            -55deg,
            transparent,
            transparent 12px,
            rgba(255,255,255,0.012) 12px,
            rgba(255,255,255,0.012) 13px
          )`,
        }} />

        <div className="relative z-10 flex items-center h-full px-4 gap-3">
          {/* App logo */}
          <img
            src={apexLabLogo}
            alt="JP Apex Lab"
            style={{
              height: 'clamp(52px, 10vh, 110px)',
              width: 'auto',
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />

{/* Right: track logo (when session loaded) + avatar + sign out */}
          <div className="flex items-center gap-3 ml-auto shrink-0">
            {trackLogo && (
              <img src={trackLogo} alt={activeTrackLayout?.name}
                className="hidden sm:block object-contain"
                style={{
                  height: 'clamp(43px, 8.4vh, 86px)',
                  maxWidth: 240,
                  opacity: 0.92,
                  filter: 'brightness(1.25) drop-shadow(0 0 12px rgba(255,255,255,0.15))',
                }} />
            )}
            {/* Settings — opens AISettings drawer */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              title="Settings"
            >
              <Settings size={13} />
            </button>
            {/* ⌘K hint — desktop only */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors text-[10px] tracking-wider"
              title="Command palette (⌘K)"
              style={{ fontFamily: 'JetBrains Mono' }}>
              <span>⌘K</span>
            </button>
            {/* Print/PDF — desktop only, shown when sessions loaded */}
            {store.activeSessions.length > 0 && (
              <PrintButton className="hidden lg:flex" />
            )}
            {/* Push notification toggle — desktop only, when supported */}
            {push.isSupported && (
              <button
                onClick={() => push.isSubscribed ? push.unsubscribe() : push.subscribe().then(() => toast.success('Notifications enabled'))}
                disabled={push.isLoading}
                className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors text-[10px] tracking-wider"
                title={push.isSubscribed ? 'Disable push notifications' : 'Enable push notifications'}
                style={{ fontFamily: 'JetBrains Mono', opacity: push.isSubscribed ? 1 : 0.5 }}>
                <Bell size={11} />
              </button>
            )}
            {/* Car name — shown when profile is set */}
            {profile?.carName && (
              <span
                className="hidden md:block text-muted-foreground"
                style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {profile.carName}
              </span>
            )}
            {user.picture && (
              <img src={user.picture} alt={user.name} className="rounded-full ring-1 ring-border"
                style={{ width: 'clamp(24px, 3.6vh, 31px)', height: 'clamp(24px, 3.6vh, 31px)' }} />
            )}
            <button onClick={() => setUser(null)} className="text-muted-foreground hover:text-destructive transition-colors" title="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </div>

        {/* Bottom accent line — uses track primary color */}
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${trackPrimary} 20%, ${trackAccent}80 60%, transparent)` }} />
      </header>

      {/* ── BODY ── */}

      {/* MOBILE layout (< lg): no sidebar, swipe navigation */}
      <div className="flex flex-col flex-1 min-h-0 lg:hidden" {...bindSwipe()} style={{ touchAction: 'pan-y' }}>
        {store.activeSessions.length > 0 ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Compact session loading strip */}
            <div className="shrink-0 p-2 border-b border-border bg-card/60">
              <div className="flex gap-2">
                <div className="flex-1 min-w-0"><DropZone compact onSessionLoaded={store.addSession} /></div>
                <DrivePickerButton onSessionLoaded={store.addSession} onTokenChange={setDriveAccessToken} />
              </div>
            </div>
            {activeTab === 'map' ? (
              <div className="flex-1 min-h-0 p-2 pb-[calc(72px+env(safe-area-inset-bottom))]">
                <TrackHeatMap sessions={store.activeSessions}
                  selectedCornerId={selectedCornerId} onCornerSelect={setSelectedCornerId} />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto scroll-touch p-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
                {renderTabContent(activeTab)}
              </div>
            )}
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto scroll-touch p-4">
            <div className="mb-4 space-y-2">
              <DropZone onSessionLoaded={store.addSession} />
              <DrivePickerButton onSessionLoaded={store.addSession} />
            </div>
            <EmptyDashboard />
          </main>
        )}
      </div>

      {/* DESKTOP layout (>= lg): resizable sidebar + main */}
      <div className="hidden lg:flex flex-1 min-h-0">
        <PanelGroup
          orientation="horizontal"
          defaultLayout={Object.keys(sidebarLayout).length > 0 ? sidebarLayout : undefined}
          onLayoutChanged={(layout) => {
            setSidebarLayout(layout);
            try { localStorage.setItem('apex-sidebar-layout', JSON.stringify(layout)); } catch { /* quota */ }
          }}
        >
          {/* Left sidebar panel */}
          <Panel id="sidebar" defaultSize={24} minSize={16} maxSize={40} className="flex flex-col border-r border-border bg-card">
            <div className="shrink-0 p-2.5 space-y-2 border-b border-border">
              <div className="flex gap-2">
                <div className="flex-1"><DropZone onSessionLoaded={store.addSession} /></div>
                <DrivePickerButton onSessionLoaded={store.addSession} onTokenChange={setDriveAccessToken} />
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
                <div className="py-0.5 text-[10px] tracking-wider text-muted-foreground uppercase">
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Export CSV from RaceChrono</li>
                    <li>Drop here or load from Drive</li>
                  </ol>
                </div>
              )}
              {store.sessions.length > 0 && (
                <button onClick={store.clearSavedSessions}
                  className="text-[9px] tracking-widest text-muted-foreground/25 hover:text-destructive transition-colors uppercase">
                  Clear saved sessions
                </button>
              )}
            </div>
            <LapInfoPanel sessions={store.activeSessions} />
            <div className="flex-1 min-h-0 overflow-y-auto scroll-touch">
              <LapList sessions={store.activeSessions} />
            </div>
          </Panel>

          {/* Drag handle */}
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/50 active:bg-primary/70 transition-colors cursor-col-resize" />

          {/* Right content panel */}
          <Panel id="main" className="flex flex-col min-w-0">
            {store.activeSessions.length > 0 ? (
              <div className="flex flex-col h-full">
                {/* Desktop tab strip */}
                <div className="shrink-0 border-b border-border bg-card/60 px-3 flex items-center gap-1">
                  {DESKTOP_TABS.map((tab, i) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      title={`${tab.label} (${i + 1})`}
                      className="group relative px-4 py-2.5 text-xs tracking-[0.15em] uppercase transition-colors"
                      style={{
                        color: activeTab === tab.id ? '#F0F0FA' : 'hsl(var(--muted-foreground))',
                        fontFamily: 'BMWTypeNext',
                      }}>
                      {tab.label}
                      <span className="absolute top-1 right-1 text-[7px] opacity-0 group-hover:opacity-30 transition-opacity"
                        style={{ fontFamily: 'JetBrains Mono' }}>{i + 1}</span>
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t"
                          style={{ background: 'linear-gradient(to right, #1C69D4, #A855F7)' }} />
                      )}
                    </button>
                  ))}
                </div>
                {activeTab === 'map' ? (
                  <div className="flex-1 min-h-0 p-2">
                    <TrackHeatMap sessions={store.activeSessions}
                      selectedCornerId={selectedCornerId} onCornerSelect={setSelectedCornerId} />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto scroll-touch p-4">
                    {renderTabContent(activeTab)}
                  </div>
                )}
              </div>
            ) : (
              <main className="flex-1 overflow-y-auto scroll-touch p-4">
                <EmptyDashboard />
              </main>
            )}
          </Panel>
        </PanelGroup>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t border-border"
        style={{
          background: 'rgba(10,10,18,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        {/* Swipe position dots */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {MOBILE_TABS.map(tab => (
            <div key={tab.id}
              className="rounded-full transition-all duration-200"
              style={{
                width: activeTab === tab.id ? 16 : 4,
                height: 3,
                background: activeTab === tab.id ? '#1C69D4' : 'rgba(255,255,255,0.15)',
              }} />
          ))}
        </div>
        {/* Tab buttons */}
        <div className="flex items-center justify-around" style={{ height: 48 }}>
          {MOBILE_TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-100 active:scale-[0.90] active:opacity-70 select-none"
                style={{ color: active ? '#1C69D4' : 'hsl(var(--muted-foreground))' }}>
                <tab.Icon size={18} />
                <span style={{ fontFamily: 'BMWTypeNext', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <InstallPrompt />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={setActiveTab}
        onClearAll={store.clearAll}
        onSignOut={() => setUser(null)}
        hasData={store.sessions.length > 0}
      />
    </div>
  );
}

// ── LapList ───────────────────────────────────────────────────────────────────
// Compact scrollable lap table for the left panel
function LapList({ sessions }: { sessions: import('@/types/session').LoadedSession[] }) {
  if (sessions.length === 0) return null;
  return (
    <div className="p-2 space-y-3">
      {sessions.map(session => {
        const clean = session.data.laps.filter(l => !l.is_outlier);
        const best = session.data.consistency.best_lap_s;
        const sorted = [...clean].sort((a, b) => a.lap_time_s - b.lap_time_s);
        if (clean.length === 0) return null;
        return (
          <div key={session.id}>
            {sessions.length > 1 && (
              <div style={{ fontFamily: 'BMWTypeNext', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: session.color, marginBottom: 4 }}>
                {sessionLabel(session)}
              </div>
            )}
            <div className="space-y-0.5">
              {sorted.map(lap => {
                const isBest = lap.lap_time_s === best;
                const delta  = lap.lap_time_s - best;
                const deltaColor = isBest ? '#A855F7' : delta < 0.5 ? '#22C55E' : delta < 1.5 ? '#F59E0B' : '#EF4444';
                return (
                  <div key={lap.lap_num} className="flex items-center justify-between px-2 py-0.5 rounded"
                    style={{ background: isBest ? 'rgba(168,85,247,0.08)' : undefined }}>
                    <span style={{ fontFamily: 'BMWTypeNext', fontSize: '10px', color: isBest ? '#A855F7' : '#9A9AB0', width: 28 }}>
                      L{lap.lap_num}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: isBest ? 700 : 400, color: isBest ? '#A855F7' : '#E8E8F0' }}>
                      {formatLapTime(lap.lap_time_s)}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: deltaColor, width: 44, textAlign: 'right' }}>
                      {isBest ? '●' : `+${delta.toFixed(2)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
// Lean label + hairline divider — no card wrapper, no wasted vertical space
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-[3px] h-3 rounded-full shrink-0"
          style={{ background: 'linear-gradient(to bottom, #1C69D4, #A855F7)' }} />
        <span style={{
          fontFamily: 'BMWTypeNext',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'hsl(var(--muted-foreground))',
        }}>
          {title}
        </span>
        <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
      </div>
      {children}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center min-h-[300px]">
      {/* M stripes as empty state decoration */}
      <div className="flex items-center gap-[4px]" style={{ height: 48, opacity: 0.12 }}>
        {config.stripeColors.map((c, i) => (
          <div key={i} style={{ width: 8, height: '100%', background: c, borderRadius: 1 }} />
        ))}
      </div>
      <div className="space-y-1">
        <p style={{ fontFamily: 'BMWTypeNext', fontSize: 13, letterSpacing: '0.18em', color: 'hsl(var(--muted-foreground))', opacity: 0.5, textTransform: 'uppercase' }}>
          No session loaded
        </p>
        <p style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.12em', color: 'hsl(var(--muted-foreground))', opacity: 0.3, textTransform: 'uppercase' }}>
          Drop a RaceChrono CSV or load from Drive
        </p>
      </div>
    </div>
  );
}
