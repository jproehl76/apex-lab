import { useState, useEffect } from 'react';
import { LogOut, Heart, MapIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import { TrackMapChart } from '@/components/charts/TrackMapChart';
import { FrictionScatterChart } from '@/components/charts/FrictionScatterChart';
import { DebriefNotes } from '@/components/DebriefNotes';
import { CoachingInsights } from '@/components/CoachingInsights';
import { DrivePickerButton } from '@/components/DrivePickerButton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WhoopPanel } from '@/components/WhoopPanel';
import { ReadinessTab } from '@/components/ReadinessTab';
import { InstallPrompt } from '@/components/InstallPrompt';
import { handleWhoopCallback } from '@/lib/services/whoopAuth';
import { usePersistedSessions } from '@/lib/usePersistedSessions';
import { sessionLabel, formatLapTime } from '@/lib/utils';
import { useMemory } from '@/hooks/useMemory';
import React from 'react';
import trackPhoto from '@/assets/m3-track.jpg';
import bmwMLogo from '@/assets/bmw-m-logo.jpg';

const AUTH_KEY = 'm3-auth-user';

interface AuthUser { email: string; name: string; picture: string }

// Desktop tabs (right panel — track map is permanently left)
const DESKTOP_TABS = [
  { id: 'overview',    label: 'Overview'    },
  { id: 'laps',        label: 'Lap Times'   },
  { id: 'corners',     label: 'Corners'     },
  { id: 'development', label: 'Development' },
  { id: 'thermals',    label: 'Thermals'    },
  { id: 'readiness',   label: 'Readiness'   },
  { id: 'notes',       label: 'Notes'       },
];

// Mobile bottom nav
const MOBILE_TABS = [
  { id: 'map',      label: 'Map',     Icon: MapIcon },
  { id: 'overview', label: 'Home',    Icon: () => <span style={{ fontSize: 18 }}>⊞</span> },
  { id: 'corners',  label: 'Corners', Icon: () => <span style={{ fontSize: 18 }}>◎</span> },
  { id: 'thermals', label: 'Temps',   Icon: () => <span style={{ fontSize: 18 }}>⊕</span> },
  { id: 'readiness',label: 'Body',    Icon: Heart },
];

export default function App() {
  const store = usePersistedSessions();
  const { memory, loaded, update } = useMemory();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCornerId, setSelectedCornerId] = useState<string | null>(null);
  const [whoopConnected, setWhoopConnected] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { const r = localStorage.getItem(AUTH_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
  });

  useEffect(() => { if (loaded) setActiveTab(memory.lastActiveTab || 'overview'); }, [loaded]); // eslint-disable-line
  useEffect(() => { if (loaded) update({ lastActiveTab: activeTab }); }, [activeTab, loaded]); // eslint-disable-line

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
      handleWhoopCallback(code, state).then(ok => {
        if (ok) { setWhoopConnected(true); toast.success('WHOOP connected'); }
        else toast.error('WHOOP connection failed');
      }).catch(() => toast.error('WHOOP connection failed'));
    }
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_KEY);
  }, [user]);

  if (!user) return <LoginScreen onAuth={setUser} />;

  const bestSession = store.activeSessions.length > 0
    ? store.activeSessions.reduce((b, s) => s.data.consistency.best_lap_s < b.data.consistency.best_lap_s ? s : b)
    : null;
  const bestLapDisplay = bestSession ? formatLapTime(bestSession.data.consistency.best_lap_s) : null;
  const sessionDates = store.activeSessions.map(s => s.data.header.date);

  function renderTabContent(tab: string) {
    if (store.activeSessions.length === 0) return <EmptyDashboard />;
    switch (tab) {
      case 'overview': return (
        <div className="space-y-4">
          <Section title="Session Summary">
            <ErrorBoundary><SessionStats sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Coaching Insights">
              <ErrorBoundary><CoachingInsights sessions={store.activeSessions} /></ErrorBoundary>
            </Section>
            <Section title="WHOOP Recovery">
              <ErrorBoundary><WhoopPanel sessionDates={sessionDates} connectedOverride={whoopConnected} /></ErrorBoundary>
            </Section>
          </div>
          <Section title="Lap Time Progression">
            <ErrorBoundary><LapTimesChart sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
        </div>
      );
      case 'map': return (
        <div className="h-full p-3">
          <TrackMapChart sessions={store.activeSessions} variant="chart"
            selectedCornerId={selectedCornerId} onCornerSelect={setSelectedCornerId} />
        </div>
      );
      case 'laps': return (
        <Section title="Lap Time Progression">
          <ErrorBoundary><LapTimesChart sessions={store.activeSessions} /></ErrorBoundary>
        </Section>
      );
      case 'corners': return (
        <div className="space-y-4">
          <Section title="Corner Speed Comparison">
            <ErrorBoundary><CornerSpeedChart sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          <Section title="Corner Detail">
            <ErrorBoundary><CornerDetailTable sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
        </div>
      );
      case 'development': return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Friction Circle">
            <ErrorBoundary><FrictionScatterChart sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          <Section title="Driver Development Radar">
            <ErrorBoundary><FrictionCircleChart sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
        </div>
      );
      case 'thermals': return (
        <Section title="Thermal Trends">
          <ErrorBoundary><ThermalChart sessions={store.activeSessions} /></ErrorBoundary>
        </Section>
      );
      case 'readiness': return (
        <Section title="Driver Readiness">
          <ErrorBoundary><ReadinessTab sessionDates={sessionDates} connectedOverride={whoopConnected} /></ErrorBoundary>
        </Section>
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Toaster position="bottom-right" richColors />

      {/* ── HEADER ── */}
      <header className="relative shrink-0 overflow-hidden" style={{ height: 'clamp(72px, 14vh, 180px)' }}>
        <img src={trackPhoto} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center 40%', opacity: 0.55 }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(10,10,18,0.97) 0%, rgba(10,10,18,0.88) 30%, rgba(10,10,18,0.45) 60%, rgba(10,10,18,0.65) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(10,10,18,0.85) 100%)' }} />

        <div className="relative z-10 flex items-center h-full px-5 gap-4">
          <img src={bmwMLogo} alt="BMW M" className="shrink-0 object-contain"
            style={{ height: 'clamp(36px, 7vh, 72px)', width: 'clamp(36px, 7vh, 72px)', mixBlendMode: 'screen', filter: 'brightness(1.2) saturate(1.1)' }} />

          <div className="flex flex-col justify-center min-w-0">
            <h1 style={{ fontFamily: 'BMWTypeNext', fontSize: 'clamp(18px, 3.2vh, 36px)', fontWeight: 700, letterSpacing: '0.07em', color: '#F0F0FA', lineHeight: 1, textTransform: 'uppercase' }}>
              G80 M3 Competition
            </h1>
            <p className="hidden sm:block" style={{ fontFamily: 'BMWTypeNext', fontSize: 'clamp(9px, 1.4vh, 12px)', letterSpacing: '0.22em', color: '#404058', textTransform: 'uppercase', marginTop: 3 }}>
              Track Telemetry · Session Analysis
            </p>
          </div>

          {bestLapDisplay && (
            <div className="hidden md:flex flex-col items-center absolute left-1/2 -translate-x-1/2">
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 'clamp(18px, 3.5vh, 32px)', fontWeight: 600, color: '#A855F7', lineHeight: 1, textShadow: '0 0 24px rgba(168,85,247,0.5)' }}>
                {bestLapDisplay}
              </span>
              <span style={{ fontFamily: 'BMWTypeNext', fontSize: 'clamp(8px, 1.1vh, 10px)', letterSpacing: '0.22em', color: '#504860', textTransform: 'uppercase', marginTop: 2 }}>
                Best Lap
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 ml-auto shrink-0">
            {user.picture && (
              <img src={user.picture} alt={user.name} className="rounded-full ring-1 ring-border"
                style={{ width: 'clamp(24px, 3.5vh, 30px)', height: 'clamp(24px, 3.5vh, 30px)' }} />
            )}
            <button onClick={() => setUser(null)} className="text-muted-foreground hover:text-destructive transition-colors" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, #1C69D4 20%, #A855F7 60%, transparent)' }} />
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel — desktop lg+ */}
        <aside className="hidden lg:flex flex-col w-[340px] shrink-0 border-r border-border bg-card">
          <div className="shrink-0 p-3 space-y-2 border-b border-border">
            <DropZone onSessionLoaded={store.addSession} />
            <DrivePickerButton onSessionLoaded={store.addSession} />
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
              <div className="py-1 space-y-1 text-xs tracking-wider text-muted-foreground uppercase">
                <p className="text-foreground/40">Getting started</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Export CSV from RaceChrono</li>
                  <li>Drop here or load from Drive</li>
                  <li>Load multiple sessions to compare</li>
                </ol>
              </div>
            )}
            {store.sessions.length > 0 && (
              <button onClick={store.clearSavedSessions}
                className="text-[10px] tracking-widest text-muted-foreground/30 hover:text-destructive transition-colors uppercase">
                Clear saved sessions
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 p-3">
            <TrackMapChart sessions={store.activeSessions} variant="panel"
              selectedCornerId={selectedCornerId} onCornerSelect={setSelectedCornerId} />
          </div>
        </aside>

        {/* Right panel */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 bg-background">
          {store.activeSessions.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
              {/* Desktop tab strip */}
              <div className="hidden lg:block shrink-0 border-b border-border bg-card px-3 py-1.5">
                <TabsList className="bg-transparent h-auto p-0 gap-0.5">
                  {DESKTOP_TABS.map(tab => (
                    <TabsTrigger key={tab.id} value={tab.id}
                      className="px-3 py-1.5 rounded text-xs tracking-widest uppercase data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent border-0 shadow-none">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto scroll-touch p-4 pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-4">
                {DESKTOP_TABS.map(tab => (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0">
                    {renderTabContent(tab.id)}
                  </TabsContent>
                ))}
                <TabsContent value="map" className="mt-0 h-full">
                  {renderTabContent('map')}
                </TabsContent>
              </div>
            </Tabs>
          ) : (
            <main className="flex-1 overflow-y-auto scroll-touch p-4">
              <EmptyDashboard />
            </main>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden flex items-center justify-around border-t border-border"
        style={{ height: 'calc(56px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)', background: 'rgba(10,10,18,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
        {MOBILE_TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
              style={{ color: active ? '#1C69D4' : '#404058', borderTop: active ? '2px solid #1C69D4' : '2px solid transparent' }}>
              <tab.Icon size={20} />
              <span style={{ fontFamily: 'BMWTypeNext', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <InstallPrompt />
    </div>
  );
}

// ── Section — thin wrapper using shadcn Card ──────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4 bg-card border-border rounded-lg overflow-hidden">
      <CardHeader className="px-4 py-2.5 border-b border-border bg-card/80">
        <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase flex items-center gap-2">
          <div className="w-px h-3.5 rounded-full" style={{ background: 'linear-gradient(to bottom, #1C69D4, #A855F7)' }} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center min-h-[400px]">
      <img src={bmwMLogo} alt="" aria-hidden className="w-20 h-20 object-contain"
        style={{ mixBlendMode: 'screen', filter: 'brightness(1.1)', opacity: 0.1 }} />
      <div className="space-y-1">
        <p className="text-base font-semibold tracking-widest text-muted-foreground/40 uppercase">No session loaded</p>
        <p className="text-xs tracking-wider text-muted-foreground/20 uppercase">Drop a RaceChrono CSV or load from Drive</p>
      </div>
    </div>
  );
}
