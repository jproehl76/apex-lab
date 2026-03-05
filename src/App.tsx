import { useState, useEffect } from 'react';
import { LogOut, Heart, MapIcon } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
import { TrackHeatMap } from '@/components/charts/TrackHeatMap';
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
import { LapInfoPanel } from '@/components/LapInfoPanel';
import { findTrackLayout } from '@/assets/trackLayouts';
import React from 'react';

const AUTH_KEY = 'm3-auth-user';

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
];

const MOBILE_TABS = [
  { id: 'map',      label: 'Map',     Icon: MapIcon },
  { id: 'session',  label: 'Session', Icon: () => <span style={{ fontSize: 18 }}>⊞</span> },
  { id: 'corners',  label: 'Corners', Icon: () => <span style={{ fontSize: 18 }}>◎</span> },
  { id: 'health',   label: 'Health',  Icon: Heart },
  { id: 'notes',    label: 'Notes',   Icon: () => <span style={{ fontSize: 18 }}>✎</span> },
];

export default function App() {
  const store = usePersistedSessions();
  const { memory, loaded, update } = useMemory();
  const [activeTab, setActiveTab] = useState('session');
  const [selectedCornerId, setSelectedCornerId] = useState<string | null>(null);
  const [whoopConnected, setWhoopConnected] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { const r = localStorage.getItem(AUTH_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
  });

  useEffect(() => { if (loaded) setActiveTab(memory.lastActiveTab || 'session'); }, [loaded]); // eslint-disable-line
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

  // Track branding for header
  const activeTrackLayout = findTrackLayout(store.activeSessions[0]?.data.header.track);
  const trackPrimary = activeTrackLayout?.colors.primary ?? '#1C69D4';
  const trackAccent  = activeTrackLayout?.colors.accent  ?? '#A855F7';
  const trackLogo    = activeTrackLayout?.logo;

  function renderTabContent(tab: string) {
    if (store.activeSessions.length === 0) return <EmptyDashboard />;
    switch (tab) {
      case 'session': return (
        <div className="space-y-5">
          <Section title="Session Summary">
            <ErrorBoundary><SessionStats sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          <Section title="Coaching">
            <ErrorBoundary><CoachingInsights sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          <Section title="Lap Times">
            <ErrorBoundary><LapTimesChart sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
        </div>
      );
      case 'map': return (
        <div className="h-full p-3">
          <TrackHeatMap sessions={store.activeSessions}
            selectedCornerId={selectedCornerId} onCornerSelect={setSelectedCornerId} />
        </div>
      );
      case 'corners': return (
        <div className="space-y-3">
          <Section title="Corner Speeds">
            <ErrorBoundary><CornerSpeedChart sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          <Section title="Corner Detail">
            <ErrorBoundary><CornerDetailTable sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Section title="Friction Circle">
              <ErrorBoundary><FrictionScatterChart sessions={store.activeSessions} /></ErrorBoundary>
            </Section>
            <Section title="G-Force Envelope">
              <ErrorBoundary><FrictionCircleChart sessions={store.activeSessions} /></ErrorBoundary>
            </Section>
          </div>
        </div>
      );
      case 'health': return (
        <div className="space-y-5">
          <Section title="Engine Thermals">
            <ErrorBoundary><ThermalChart sessions={store.activeSessions} /></ErrorBoundary>
          </Section>
          <Section title="Driver Readiness">
            <ErrorBoundary><ReadinessTab sessionDates={sessionDates} connectedOverride={whoopConnected} /></ErrorBoundary>
          </Section>
          <Section title="WHOOP Recovery">
            <ErrorBoundary><WhoopPanel sessionDates={sessionDates} connectedOverride={whoopConnected} /></ErrorBoundary>
          </Section>
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Toaster position="bottom-right" richColors />

      {/* ── HEADER ── */}
      <header className="relative shrink-0 overflow-hidden" style={{ height: 'clamp(60px, 11vh, 120px)' }}>
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
          {/* BMW M stripes */}
          <div className="shrink-0 flex items-center gap-[3px]" style={{ height: 'clamp(24px, 4.5vh, 42px)' }}>
            {[
              { color: '#1C69D4', shadow: '#1C69D460' },
              { color: '#6B2D9E', shadow: '#6B2D9E60' },
              { color: '#EF3340', shadow: '#EF334060' },
            ].map((stripe, i) => (
              <div key={i} style={{
                width: 'clamp(4px, 0.7vh, 7px)',
                height: '100%',
                background: stripe.color,
                borderRadius: '1px',
                boxShadow: `0 0 8px ${stripe.shadow}`,
              }} />
            ))}
          </div>

          {/* Title */}
          <div className="flex flex-col justify-center min-w-0">
            <h1 style={{
              fontFamily: 'BMWTypeNext',
              fontSize: 'clamp(14px, 2.5vh, 26px)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#F0F0FA',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}>
              Jonathan Proehl
            </h1>
            <p className="hidden sm:block" style={{
              fontFamily: 'BMWTypeNext',
              fontSize: 'clamp(7px, 1.1vh, 10px)',
              letterSpacing: '0.22em',
              color: 'hsl(var(--muted-foreground))',
              textTransform: 'uppercase',
              marginTop: 2,
            }}>
              Track Telemetry · Session Analysis
            </p>
          </div>

          {/* Best lap — centered */}
          {bestLapDisplay && (
            <div className="hidden md:flex flex-col items-center absolute left-1/2 -translate-x-1/2">
              <span style={{
                fontFamily: 'JetBrains Mono',
                fontSize: 'clamp(18px, 3.5vh, 32px)',
                fontWeight: 600,
                color: '#A855F7',
                lineHeight: 1,
                textShadow: '0 0 28px rgba(168,85,247,0.6)',
              }}>
                {bestLapDisplay}
              </span>
              <span style={{
                fontFamily: 'BMWTypeNext',
                fontSize: 'clamp(7px, 0.9vh, 9px)',
                letterSpacing: '0.25em',
                color: 'hsl(var(--muted-foreground))',
                textTransform: 'uppercase',
                marginTop: 2,
              }}>
                Best Lap
              </span>
            </div>
          )}

          {/* Right: track logo (when session loaded) + avatar + sign out */}
          <div className="flex items-center gap-3 ml-auto shrink-0">
            {trackLogo && (
              <img src={trackLogo} alt={activeTrackLayout?.name}
                className="hidden sm:block object-contain"
                style={{
                  height: 'clamp(36px, 7vh, 72px)',
                  maxWidth: 200,
                  opacity: 0.92,
                  filter: 'brightness(1.25) drop-shadow(0 0 12px rgba(255,255,255,0.15))',
                }} />
            )}
            {user.picture && (
              <img src={user.picture} alt={user.name} className="rounded-full ring-1 ring-border"
                style={{ width: 'clamp(20px, 3vh, 26px)', height: 'clamp(20px, 3vh, 26px)' }} />
            )}
            <button onClick={() => setUser(null)} className="text-muted-foreground hover:text-destructive transition-colors" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Bottom accent line — uses track primary color */}
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${trackPrimary} 20%, ${trackAccent}80 60%, transparent)` }} />
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel — desktop lg+ */}
        <aside className="hidden lg:flex flex-col w-[340px] shrink-0 border-r border-border bg-card">

          {/* Session loading controls — compact */}
          <div className="shrink-0 p-2.5 space-y-2 border-b border-border">
            <div className="flex gap-2">
              <div className="flex-1"><DropZone onSessionLoaded={store.addSession} /></div>
              <DrivePickerButton onSessionLoaded={store.addSession} />
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
              <div className="py-0.5 space-y-0.5 text-[10px] tracking-wider text-muted-foreground uppercase">
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

          {/* F1-style lap info panel */}
          <LapInfoPanel sessions={store.activeSessions} />

          {/* Track map — fills remaining space */}
          <div className="flex-1 min-h-0 p-1.5">
            <TrackMapChart sessions={store.activeSessions} variant="panel"
              selectedCornerId={selectedCornerId} onCornerSelect={setSelectedCornerId} />
          </div>
        </aside>

        {/* Right panel */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 bg-background">
          {store.activeSessions.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
              {/* Desktop tab strip */}
              <div className="hidden lg:flex shrink-0 border-b border-border bg-card/60 px-3 items-center gap-1">
                {DESKTOP_TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className="relative px-4 py-2.5 text-xs tracking-[0.15em] uppercase transition-colors"
                    style={{
                      color: activeTab === tab.id ? '#F0F0FA' : 'hsl(var(--muted-foreground))',
                      fontFamily: 'BMWTypeNext',
                    }}>
                    {tab.label}
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t"
                        style={{ background: 'linear-gradient(to right, #1C69D4, #A855F7)' }} />
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto scroll-touch p-4 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-4">
                {DESKTOP_TABS.map(tab => (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0">
                    {renderTabContent(tab.id)}
                  </TabsContent>
                ))}
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
        style={{
          height: 'calc(52px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgba(10,10,18,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
        {MOBILE_TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
              style={{
                color: active ? '#1C69D4' : 'hsl(var(--muted-foreground))',
                borderTop: active ? '2px solid #1C69D4' : '2px solid transparent',
              }}>
              <tab.Icon size={18} />
              <span style={{ fontFamily: 'BMWTypeNext', fontSize: '8px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <InstallPrompt />
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
        {['#1C69D4', '#6B2D9E', '#EF3340'].map((c, i) => (
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
