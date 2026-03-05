import { isWhoopConnected, initiateWhoopAuth } from '@/lib/services/whoopAuth';
import { WhoopPanel } from '@/components/WhoopPanel';
import { Activity } from 'lucide-react';

interface Props {
  sessionDates: string[];
  connectedOverride?: boolean;
}

export function ReadinessTab({ sessionDates, connectedOverride }: Props) {
  const connected = isWhoopConnected() || !!connectedOverride;

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-6 p-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#1A1A22', border: '1px solid #2E2E3C' }}>
          <Activity size={28} style={{ color: '#606070' }} />
        </div>
        <div className="text-center">
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: '20px', fontWeight: 600, color: '#E8E8F0', letterSpacing: '0.05em', marginBottom: 8 }}>Driver Readiness</div>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: '13px', color: '#606070', lineHeight: 1.5, maxWidth: 280, margin: '0 auto' }}>
            Connect your WHOOP to see recovery score, HRV, and sleep data alongside your lap times.
          </div>
        </div>
        <button onClick={initiateWhoopAuth}
          className="px-6 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all duration-150 active:scale-95"
          style={{ fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#3B82F6' }}>
          Connect via WHOOP →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WhoopPanel sessionDates={sessionDates} connectedOverride={connectedOverride} />
    </div>
  );
}
