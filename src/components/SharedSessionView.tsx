import type { ShareSummary } from '@/lib/shareSession';

interface Props {
  summary: ShareSummary;
  onClose: () => void;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(3).padStart(6, '0');
  return `${m}:${rem}`;
}

function delta(s: number, best: number): string {
  if (s === best) return '●';
  return `+${(s - best).toFixed(3)}`;
}

/**
 * Full-screen overlay shown when the app is opened via a #share= URL.
 * Read-only session summary for coaches / sharing.
 */
export function SharedSessionView({ summary, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between"
        style={{ background: 'linear-gradient(105deg,#0E0E1A 0%,#1C69D4 52%,#0E0E1A 100%)' }}>
        <div>
          <h1 style={{ fontFamily: 'BMWTypeNext', fontSize: 18, fontWeight: 700, color: '#F0F0FA', letterSpacing: '0.1em' }}>
            {summary.track}
          </h1>
          <p style={{ fontFamily: 'BMWTypeNext', fontSize: 10, color: '#9090B0', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            {summary.date} · Shared session
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors text-xs tracking-wider"
          style={{ fontFamily: 'BMWTypeNext' }}>
          Open App
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl mx-auto w-full">
        {/* Best lap */}
        <div className="rounded-xl border border-border bg-card p-6 flex items-center gap-6">
          <div>
            <p style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
              Best Lap
            </p>
            <p style={{ fontFamily: 'JetBrains Mono', fontSize: 36, fontWeight: 700, color: '#A855F7' }}>
              {fmt(summary.bestLap)}
            </p>
          </div>
          <div>
            <p style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
              Clean Laps
            </p>
            <p style={{ fontFamily: 'JetBrains Mono', fontSize: 28, fontWeight: 600, color: '#E8E8F0' }}>
              {summary.laps.length}
            </p>
          </div>
        </div>

        {/* Lap times */}
        <div>
          <h2 style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
            Lap Times
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {summary.laps.map(([num, time]) => {
              const isBest = time === summary.bestLap;
              const d = delta(time, summary.bestLap);
              const dColor = isBest ? '#A855F7' : (time - summary.bestLap) < 0.5 ? '#22C55E' : (time - summary.bestLap) < 1.5 ? '#F59E0B' : '#EF4444';
              return (
                <div key={num} className="flex items-center px-4 py-2 border-b border-border last:border-0"
                  style={{ background: isBest ? 'rgba(168,85,247,0.06)' : undefined }}>
                  <span style={{ fontFamily: 'BMWTypeNext', fontSize: 10, color: '#9090B0', width: 36 }}>L{num}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: isBest ? 700 : 400, color: isBest ? '#A855F7' : '#E8E8F0', flex: 1 }}>
                    {fmt(time)}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: dColor }}>{d}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coaching notes */}
        {summary.coaching.length > 0 && (
          <div>
            <h2 style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
              Consistency Notes
            </h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {summary.coaching.map((note, i) => (
                <div key={i} className="px-4 py-3">
                  <p style={{ fontFamily: 'BMWTypeNext', fontSize: 12, color: '#E8E8F0' }}>{note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Apex speeds */}
        {summary.corners.length > 0 && (
          <div>
            <h2 style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
              Best Lap Apex Speeds
            </h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {summary.corners.map(([name, speed], i) => (
                <div key={i} className="flex items-center px-4 py-2">
                  <span style={{ fontFamily: 'BMWTypeNext', fontSize: 11, color: '#E8E8F0', flex: 1 }}>{name}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 600, color: '#1C69D4' }}>
                    {speed.toFixed(1)} km/h
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ fontFamily: 'BMWTypeNext', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', opacity: 0.5, textAlign: 'center', paddingBottom: 16 }}>
          JP Apex Lab · jproehl76.github.io/apex-lab
        </p>
      </div>
    </div>
  );
}
