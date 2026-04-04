const DESKTOP_TABS = [
  { id: 'session', label: 'Session' },
  { id: 'track', label: 'Track' },
  { id: 'coach', label: 'Coach' },
  { id: 'progress', label: 'Progress' },
];

interface DesktopTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/**
 * Desktop tab strip with keyboard shortcut hints.
 * Shows numbered shortcuts on hover.
 */
export function DesktopTabs({ activeTab, onTabChange }: DesktopTabsProps) {
  return (
    <div className="shrink-0 border-b border-border bg-card/60 px-3 flex items-center gap-1">
      {DESKTOP_TABS.map((tab, i) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          title={`${tab.label} (${i + 1})`}
          className="group relative px-4 py-2.5 text-xs tracking-[0.15em] uppercase transition-colors"
          style={{
            color: activeTab === tab.id ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
            fontFamily: 'BMWTypeNext',
          }}
        >
          {tab.label}
          <span
            className="absolute top-1 right-1 text-[8px] opacity-0 group-hover:opacity-30 transition-opacity"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            {i + 1}
          </span>
          {activeTab === tab.id && (
            <span
              className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t"
              style={{ background: 'linear-gradient(to right, hsl(var(--primary)), #A855F7)' }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

export { DESKTOP_TABS };
