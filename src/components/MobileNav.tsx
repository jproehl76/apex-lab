import { MapIcon, GraduationCap } from 'lucide-react';
import type { ComponentType } from 'react';

interface TabConfig {
  id: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
}

const MOBILE_TABS: TabConfig[] = [
  { id: 'session', label: 'Session', Icon: () => <span style={{ fontSize: 20 }}>⊞</span> },
  { id: 'track', label: 'Track', Icon: MapIcon },
  { id: 'coach', label: 'Coach', Icon: GraduationCap },
  { id: 'progress', label: 'Progress', Icon: () => <span style={{ fontSize: 20 }}>↗</span> },
];

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/**
 * Mobile bottom navigation bar with swipe position indicators.
 * Fixed to bottom of screen with safe area insets.
 */
export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[1000] lg:hidden border-t border-border"
      style={{
        background: 'rgba(10,10,18,0.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Swipe position dots */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        {MOBILE_TABS.map(tab => (
          <div
            key={tab.id}
            className="rounded-full transition-all duration-200"
            style={{
              width: activeTab === tab.id ? 16 : 4,
              height: 3,
              background: activeTab === tab.id ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>

      {/* Tab buttons */}
      <div className="flex items-center justify-around" style={{ height: 48 }}>
        {MOBILE_TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-100 active:scale-[0.90] active:opacity-70 select-none"
              style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
            >
              <tab.Icon size={18} />
              <span
                style={{
                  fontFamily: 'BMWTypeNext',
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { MOBILE_TABS };
