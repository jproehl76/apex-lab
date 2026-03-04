import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropZone } from '@/components/DropZone';
import { SessionList } from '@/components/SessionList';
import { SessionStats } from '@/components/SessionStats';
import { LapTimesChart } from '@/components/charts/LapTimesChart';
import { CornerSpeedChart } from '@/components/charts/CornerSpeedChart';
import { ThermalChart } from '@/components/charts/ThermalChart';
import { FrictionCircleChart } from '@/components/charts/FrictionCircleChart';
import { useSessionStore } from '@/lib/sessionStore';
import React from 'react';
import trackPhoto from "@/assets/trackPhoto";
export default function App() {
  const store = useSessionStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 sticky top-0 z-10 overflow-hidden">
        {/* Photo strip — subtle, darkened, motion blur visible */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${trackPhoto})`,
            backgroundPosition: 'center 40%',
            filter: 'brightness(0.35) saturate(0.7)',
          }}
        />
        {/* Gradient overlay — fades photo into dark on right */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-slate-950/40 to-slate-950/80" />
        {/* Content */}
        <div className="relative flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1 rounded-full bg-blue-500" />
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-100">M3 Session Dashboard</h1>
              <p className="text-xs text-slate-400">2025 BMW G80 M3 Competition xDrive · #358</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen((p: boolean) => !p)}
            className="text-xs text-slate-400 hover:text-slate-100 transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-500 bg-slate-950/50"
          >
            {sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          </button>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 57px)' }}>
        {sidebarOpen && (
          <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/40 flex flex-col gap-4 p-4 overflow-y-auto relative">
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32" style={{backgroundImage:`url(${trackPhoto})`,backgroundSize:"cover",backgroundPosition:"center 50%",opacity:0.07,maskImage:"linear-gradient(to bottom, transparent, black)",WebkitMaskImage:"linear-gradient(to bottom, transparent, black)"}} />
            <DropZone onSessionLoaded={store.addSession} />
            <SessionList
              sessions={store.sessions}
              activeIds={store.activeSessionIds}
              onToggle={store.toggleActive}
              onRemove={store.removeSession}
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
          </aside>
        )}

        <main className="flex-1 overflow-y-auto p-6">
          {store.activeSessions.length === 0 ? (
            <EmptyDashboard />
          ) : (
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="bg-slate-900 border border-slate-800">
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-slate-300 tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <div className="text-4xl">🏁</div>
      <div>
        <p className="text-slate-400 font-medium">No sessions loaded</p>
        <p className="text-slate-600 text-sm mt-1">Drop session JSON files in the sidebar to get started</p>
      </div>
    </div>
  );
}
