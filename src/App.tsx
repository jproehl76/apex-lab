import { useState, useEffect } from 'react';
import { Menu, LogOut } from 'lucide-react';
import { LoginScreen } from '@/components/LoginScreen';
import { Toaster } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { DropZone } from '@/components/DropZone';
import { SessionList } from '@/components/SessionList';
import { SessionStats } from '@/components/SessionStats';
import { LapTimesChart } from '@/components/charts/LapTimesChart';
import { CornerSpeedChart } from '@/components/charts/CornerSpeedChart';
import { ThermalChart } from '@/components/charts/ThermalChart';
import { FrictionCircleChart } from '@/components/charts/FrictionCircleChart';
import { useSessionStore } from '@/lib/sessionStore';
import React from 'react';
import trackPhoto from '@/assets/m3-track.jpg';
import bmwMLogo from '@/assets/bmw-m-logo.jpg';

const AUTH_KEY = 'm3-auth-user';

interface AuthUser {
  email: string;
  name: string;
  picture: string;
}

export default function App() {
  const store = useSessionStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }, [user]);

  if (!user) {
    return <LoginScreen onAuth={setUser} />;
  }

  const signOut = () => setUser(null);

  const sidebarContent = (
    <>
      <DropZone onSessionLoaded={store.addSession} />
      <SessionList
        sessions={store.sessions}
        activeIds={store.activeSessionIds}
        onToggle={store.toggleActive}
        onRemove={store.removeSession}
        onRename={store.renameSession}
        onClearAll={store.clearAll}
      />
      {store.sessions.length === 0 && (
        <div className="text-xs text-slate-600 leading-relaxed">
          <p className="font-medium text-slate-500 mb-1">Getting started</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Export CSV from RaceChrono</li>
            <li>Run the preprocessor to get a <span className="font-mono text-slate-400">_summary.json</span></li>
            <li>Drop the JSON file here</li>
            <li>Load multiple sessions to compare</li>
          </ol>
        </div>
      )}
    </>
  );

  return (
    <div className="h-screen bg-slate-950 text-slate-100 font-sans relative flex flex-col">
      <Toaster position="bottom-right" richColors />

      {/* Full-page watermark */}
      <img
        src={trackPhoto}
        alt=""
        aria-hidden="true"
        className="fixed inset-0 w-full h-full object-cover pointer-events-none"
        style={{ objectPosition: 'center 40%', filter: 'brightness(0.55) saturate(0.8)', opacity: 0.50, zIndex: 0 }}
      />

      <header className="border-b border-slate-800 sticky top-0 z-10 relative">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden text-slate-400 hover:text-slate-100 transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div className="h-6 w-1 rounded-full bg-blue-500" />
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-100">M3 Session Dashboard</h1>
              <p className="text-xs text-slate-400">2025 BMW G80 M3 Competition xDrive</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Desktop sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(p => !p)}
              className="hidden md:block text-xs text-slate-400 hover:text-slate-100 transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-500 bg-slate-950/50"
            >
              {sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            </button>
            <div className="flex items-center gap-2">
              <img src={user.picture} alt={user.name} className="h-7 w-7 rounded-full" />
              <button onClick={signOut} className="text-slate-500 hover:text-red-400 transition-colors" title="Sign out">
                <LogOut size={16} />
              </button>
            </div>
            <img
              src={bmwMLogo}
              alt="BMW M"
              className="h-[200px] w-[200px]"
              style={{ mixBlendMode: 'screen' }}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        {sidebarOpen && (
          <aside className="hidden md:flex w-72 shrink-0 border-r border-slate-800 bg-slate-900/40 flex-col gap-4 p-4 overflow-y-auto relative">
            {sidebarContent}
          </aside>
        )}

        {/* Mobile sidebar — Sheet */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-80 bg-slate-900 border-slate-800 text-slate-100 flex flex-col gap-4 pt-10 overflow-y-auto"
          >
            {sidebarContent}
          </SheetContent>
        </Sheet>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {store.activeSessions.length === 0 ? (
            <EmptyDashboard />
          ) : (
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="bg-slate-900/90 border border-slate-800 flex-wrap h-auto gap-1">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="laptimes" className="text-xs">Lap Times</TabsTrigger>
                <TabsTrigger value="corners" className="text-xs">Corner Speeds</TabsTrigger>
                <TabsTrigger value="thermals" className="text-xs">Thermals</TabsTrigger>
                <TabsTrigger value="development" className="text-xs">Driver Development</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <Section title="Session Summary">
                  <SessionStats sessions={store.activeSessions} />
                </Section>
                <Section title="Lap Time Progression">
                  <LapTimesChart sessions={store.activeSessions} />
                </Section>
              </TabsContent>

              <TabsContent value="laptimes">
                <Section title="Lap Time Progression">
                  <LapTimesChart sessions={store.activeSessions} />
                </Section>
              </TabsContent>

              <TabsContent value="corners">
                <Section title="Corner Speed Comparison">
                  <CornerSpeedChart sessions={store.activeSessions} />
                </Section>
              </TabsContent>

              <TabsContent value="thermals">
                <Section title="Thermal Trends">
                  <ThermalChart sessions={store.activeSessions} />
                </Section>
              </TabsContent>

              <TabsContent value="development">
                <Section title="Driver Development Radar">
                  <FrictionCircleChart sessions={store.activeSessions} />
                </Section>
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-slate-300 tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
      <div className="text-4xl">🏁</div>
      <div>
        <p className="text-slate-400 font-medium">No sessions loaded</p>
        <p className="text-slate-600 text-sm mt-1">Open the menu and drop session JSON files to get started</p>
      </div>
    </div>
  );
}
