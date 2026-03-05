import { useState, useEffect } from 'react';
import {
  LogOut, LayoutDashboard, Activity, BarChart2, Heart,
  Timer, TrendingUp, Thermometer, Target, FileText, Map as MapIcon,
} from 'lucide-react';
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
import { TraceChart } from '@/components/charts/TraceChart';
import { LapDeltaChart } from '@/components/charts/LapDeltaChart';
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

interface TabDef {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

// Desktop right-panel tabs (track map is permanently in the left panel)
const ANALYSIS_TABS: TabDef[] = [
  { id: 'overview',    label: 'Overview',   Icon: LayoutDashboard },
  { id: 'laps',        label: 'Lap Times',  Icon: Timer },
  { id: 'corners',     label: 'Corners',    Icon: TrendingUp },
  { id: 'traces',      label: 'Traces',     Icon: Activity },
  { id: 'lap-delta',   label: 'Delta',      Icon: BarChart2 },
  { id: 'development', label: 'Development',Icon: Target },
  { id: 'thermals',    label: 'Thermals',   Icon: Thermometer },
  { id: 'readiness',   label: 'Readiness',  Icon: Heart },
  { id: 'notes',       label: 'Notes',      Icon: FileText },
];

// Mobile bottom nav (track map IS a full-screen tab on mobile)
const MOBILE_TABS: TabDef[] = [
  { id: 'map',      label: 'Map',     Icon: MapIcon },
  { id: 'overview', label: 'Home',    Icon: LayoutDashboard },
  { id: 'corners',  label: 'Corners', Icon: TrendingUp },
  { id: 'traces',   label: 'Traces',  Icon: Activity },
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

  // Restore last active tab
  useEffect(() => {
    if (loaded) setActiveTab(memory.lastActiveTab || 'overview');
  }, [loaded]); // eslint-disable-line

  // Persist active tab
  useEffect(() => {
    if (loaded) update({ lastActiveTab: activeTab });
  }, [activeTab, loaded]); // eslint-disable-line

  // Track history
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

  // WHOOP OAuth callback
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get('code'), state = p.get('state');
    if (code && state) {
      window.history.replaceState({}, '', window.location.pathname);
      handleWhoopCallback(code, state).then(ok => {
        if (ok) { setWhoopConnected(true); toast.success('WHOOP connected'); }
        else toast.error('WHOOP connection failed — check console');
      }).catch(() => toast.error('WHOOP connection failed'));
    }
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_KEY);
  }, [user]);

  if (!user) return <LoginScreen onAuth={setUser} />;

  const signOut = () => setUser(null);

  // Best lap across active sessions
  const bestSession = store.activeSessions.length > 0
    ? store.activeSessions.reduce((b, s) => s.data.consistency.best_lap_s < b.data.consistency.best_lap_s ? s : b)
    : null;
  const bestLapDisplay = bestSession ? formatLapTime(bestSession.data.consistency.best_lap_s) : null;

  const sessionDates = store.activeSessions.map(s => s.data.header.date);

  // ── Tab content renderer ────────────────────────────────────────────────────
  function renderTabContent(tab: string) {
    if (store.activeSessions.length === 0) return <EmptyDashboard />;
    switch (tab) {
      case 'overview': return (
        <div className="space-y-4">
          <Section title="Session Summary"><ErrorBoundary><SessionStats sessions={store.activeSessions} /></ErrorBoundary></Section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Coaching Insights"><ErrorBoundary><CoachingInsights sessions={store.activeSessions} /></ErrorBoundary></Section>
            <Section title="WHOOP Recovery"><ErrorBoundary><WhoopPanel sessionDates={sessionDates} connectedOverride={whoopConnected} /></ErrorBoundary></Section>
          </div>
          <Section title="Lap Time Progression"><ErrorBoundary><LapTimesChart sessions={store.activeSessions} /></ErrorBoundary></Section>
        </div>
      );
      case 'map': return (  // mobile-only full-screen map tab
        <div className="h-full p-3">
          <TrackMapChart sessions={store.activeSessions} variant="chart"
            selectedCornerId={selectedCornerId} onCornerSelect={setSelectedCornerId} />
        </div>
      );
      case 'laps': return (
        <div className="space-y-4">
          <Section title="Lap Time Progression"><ErrorBoundary><LapTimesChart sessions={store.activeSessions} /></ErrorBoundary></Section>
          <Section title="Lap Delta by Corner"><ErrorBoundary><LapDeltaChart sessions={store.activeSessions} /></ErrorBoundary></Section>
        </div>
      );
      case 'corners': return (
        <div className="space-y-4">
          <Section title="Corner Speed Comparison"><ErrorBoundary><CornerSpeedChart sessions={store.activeSessions} /></ErrorBoundary></Section>
          <Section title="Corner Detail"><ErrorBoundary><CornerDetailTable sessions={store.activeSessions} /></ErrorBoundary></Section>
        </div>
      );
      case 'corner-detail': return (
        <Section title="Corner Detail"><ErrorBoundary><CornerDetailTable sessions={store.activeSessions} /></ErrorBoundary></Section>
      );
      case 'traces': return (
        <Section title="Throttle & Brake Trace"><ErrorBoundary><TraceChart sessions={store.activeSessions} /></ErrorBoundary></Section>
      );
      case 'lap-delta': return (
        <Section title="Lap Delta by Corner"><ErrorBoundary><LapDeltaChart sessions={store.activeSessions} /></ErrorBoundary></Section>
      );
      case 'thermals': return (
        <Section title="Thermal Trends"><ErrorBoundary><ThermalChart sessions={store.activeSessions} /></ErrorBoundary></Section>
      );
      case 'development': return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Friction Circle"><ErrorBoundary><FrictionScatterChart sessions={store.activeSessions} /></ErrorBoundary></Section>
          <Section title="Driver Development Radar"><ErrorBoundary><FrictionCircleChart sessions={store.activeSessions} /></ErrorBoundary></Section>
        </div>
      );
      case 'readiness': return (
        <Section title="Driver Readiness">
          <ErrorBoundary><ReadinessTab sessionDates={sessionDates} connectedOverride={whoopConnected} /></ErrorBoundary>
        </Section>
      );
      case 'notes': return (
        <Section title="Debrief Notes">
          {store.activeSessions.map(s => (
            <div key={s.id} className="space-y-1">
              {store.activeSessions.length > 1 && (
                <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', color: '#606070', fontWeight: 500 }}>{sessionLabel(s)}</p>
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
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#0A0A12' }}>
      <Toaster position="bottom-right" richColors />

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* HERO HEADER                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <header className="relative shrink-0 overflow-hidden"
        style={{ height: 'clamp(72px, 14vh, 200px)' }}>

        {/* Track photo — positioned right-center so the car shows on the right */}
        <img
          src={trackPhoto} alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center 40%', opacity: 0.65 }}
        />

        {/* Gradient overlays */}
        {/* Left: dark (text readable) → right: transparent (photo shows through) */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(100deg, rgba(10,10,18,0.97) 0%, rgba(10,10,18,0.90) 28%, rgba(10,10,18,0.50) 55%, rgba(10,10,18,0.62) 100%)',
        }} />
        {/* Bottom fade into app body */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, transparent 40%, rgba(10,10,18,0.80) 100%)',
        }} />
        {/* Blue accent bloom — top-left */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 0% 50%, rgba(28,105,212,0.12) 0%, transparent 60%)',
        }} />

        {/* Content */}
        <div className="relative z-10 flex items-center h-full px-5 gap-4">

          {/* BMW M logo */}
          <img
            src={bmwMLogo} alt="BMW M"
            className="shrink-0 object-contain"
            style={{
              height: 'clamp(36px, 7vh, 80px)',
              width:  'clamp(36px, 7vh, 80px)',
              mixBlendMode: 'screen',
              filter: 'brightness(1.15) saturate(1.1)',
            }}
          />

          {/* Title block */}
          <div className="flex flex-col justify-center min-w-0">
            <h1 style={{
              fontFamily: 'Barlow Condensed',
              fontSize: 'clamp(18px, 3.2vh, 38px)',
              fontWeight: 700,
              letterSpacing: '0.07em',
              color: '#F0F0FA',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}>
              G80 M3 Competition
            </h1>
            <p className="hidden sm:block" style={{
              fontFamily: 'Barlow Condensed',
              fontSize: 'clamp(10px, 1.4vh, 14px)',
              letterSpacing: '0.2em',
              color: '#505060',
              textTransform: 'uppercase',
              lineHeight: 1,
              marginTop: 3,
            }}>
              Track Telemetry Dashboard
            </p>
          </div>

          {/* Best lap — center display, only on md+ when data loaded */}
          {bestLapDisplay && (
            <div className="hidden md:flex flex-col items-center absolute left-1/2 -translate-x-1/2">
              <span style={{
                fontFamily: 'JetBrains Mono',
                fontSize: 'clamp(18px, 3.5vh, 32px)',
                fontWeight: 600,
                color: '#A855F7',
                lineHeight: 1,
                textShadow: '0 0 20px rgba(168,85,247,0.5), 0 0 40px rgba(168,85,247,0.2)',
              }}>
                {bestLapDisplay}
              </span>
              <span style={{
                fontFamily: 'Barlow Condensed',
                fontSize: 'clamp(8px, 1.2vh, 11px)',
                letterSpacing: '0.2em',
                color: '#605068',
                textTransform: 'uppercase',
                marginTop: 2,
              }}>
                Best Lap
              </span>
            </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-3 ml-auto shrink-0">
            {user.picture && (
              <img src={user.picture} alt={user.name}
                className="rounded-full ring-1 ring-[#2E2E3C]"
                style={{ width: 'clamp(24px, 3.5vh, 32px)', height: 'clamp(24px, 3.5vh, 32px)' }} />
            )}
            <button onClick={signOut} style={{ color: '#505060' }}
              className="hover:text-[#EF4444] transition-colors" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Bottom border line — gradient blue → purple */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{
          background: 'linear-gradient(to right, transparent, #1C69D4 20%, #A855F7 60%, transparent)',
        }} />
      </header>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* BODY                                                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT PANEL: track map + session controls (desktop xl+) ───────── */}
        <aside className="hidden lg:flex flex-col w-[380px] shrink-0 border-r border-[#1E1E28]"
          style={{ background: '#080810' }}>

          {/* Session controls */}
          <div className="shrink-0 p-3 space-y-2 border-b border-[#1E1E28]">
            <DropZone onSessionLoaded={store.addSession} />
            <DrivePickerButton onSessionLoaded={store.addSession} />
            {store.sessions.length > 0 && (
              <div className="flex items-center justify-between">
                <SessionList
                  sessions={store.sessions}
                  activeIds={store.activeSessionIds}
                  onToggle={store.toggleActive}
                  onRemove={store.removeSession}
                  onRename={store.renameSession}
                  onClearAll={store.clearAll}
                />
              </div>
            )}
            {store.sessions.length === 0 && (
              <div className="py-1 space-y-1" style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', letterSpacing: '0.08em', color: '#404058', textTransform: 'uppercase' }}>
                <p style={{ color: '#505060' }}>Getting started</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Export CSV from RaceChrono</li>
                  <li>Drop here or load from Drive</li>
                  <li>Load multiple sessions to compare</li>
                </ol>
              </div>
            )}
            {store.sessions.length > 0 && (
              <button
                onClick={store.clearSavedSessions}
                className="text-xs transition-colors"
                style={{ fontFamily: 'Barlow Condensed', fontSize: '10px', letterSpacing: '0.1em', color: '#303040', textTransform: 'uppercase' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                onMouseLeave={e => (e.currentTarget.style.color = '#303040')}
              >
                Clear saved sessions
              </button>
            )}
          </div>

          {/* Track map — fills remaining height */}
          <div className="flex-1 min-h-0 p-3">
            <TrackMapChart
              sessions={store.activeSessions}
              variant="panel"
              selectedCornerId={selectedCornerId}
              onCornerSelect={setSelectedCornerId}
            />
          </div>
        </aside>

        {/* ── RIGHT PANEL: analysis tabs + content ─────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">

          {/* Desktop tab strip */}
          {store.activeSessions.length > 0 && (
            <div className="hidden lg:flex items-center gap-0.5 px-3 py-2 border-b border-[#1E1E28] overflow-x-auto shrink-0"
              style={{ background: '#080810' }}>
              {ANALYSIS_TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded whitespace-nowrap transition-all duration-150 shrink-0"
                    style={{
                      fontFamily: 'Barlow Condensed', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase',
                      background: active ? 'rgba(28,105,212,0.12)' : 'transparent',
                      color: active ? '#1C69D4' : '#404058',
                      borderBottom: active ? '2px solid #1C69D4' : '2px solid transparent',
                    }}>
                    <tab.Icon size={13} strokeWidth={active ? 2 : 1.5} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Content */}
          <main className="flex-1 overflow-y-auto scroll-touch p-4 pb-[calc(80px+env(safe-area-inset-bottom))] lg:pb-4"
            style={{ background: '#0A0A12' }}>
            {renderTabContent(activeTab)}
          </main>
        </div>
      </div>

      {/* ── Mobile bottom tab bar ─────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 lg:hidden flex items-center justify-around border-t border-[#1E1E28]"
        style={{
          height: 'calc(56px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgba(8,8,16,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {MOBILE_TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
              style={{
                color: active ? '#1C69D4' : '#404058',
                borderTop: active ? '2px solid #1C69D4' : '2px solid transparent',
              }}>
              <tab.Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span style={{ fontFamily: 'Barlow Condensed', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      <InstallPrompt />
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg" style={{ background: '#0C0C16', border: '1px solid #1C1C28' }}>
      <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: '1px solid #1C1C28', background: '#0A0A14' }}>
        <div className="w-px h-3.5 rounded-full" style={{ background: 'linear-gradient(to bottom, #1C69D4, #A855F7)' }} />
        <h2 style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', color: '#505068', textTransform: 'uppercase' }}>
          {title}
        </h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center min-h-[400px]">
      <img src={bmwMLogo} alt="" aria-hidden="true"
        className="w-20 h-20 object-contain"
        style={{ mixBlendMode: 'screen', filter: 'brightness(1.1)', opacity: 0.12 }} />
      <div className="space-y-1">
        <p style={{ fontFamily: 'Barlow Condensed', fontSize: '18px', fontWeight: 600, letterSpacing: '0.1em', color: '#404058', textTransform: 'uppercase' }}>
          No session loaded
        </p>
        <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', letterSpacing: '0.08em', color: '#2E2E3C', textTransform: 'uppercase' }}>
          Drop a RaceChrono CSV or load from Drive
        </p>
      </div>
    </div>
  );
}
