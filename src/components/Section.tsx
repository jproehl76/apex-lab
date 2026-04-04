import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  children: ReactNode;
}

/**
 * Section wrapper with labeled header and divider line.
 * Used throughout the dashboard for consistent visual grouping.
 */
export function Section({ title, children }: SectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="w-[3px] h-3 rounded-full shrink-0"
          style={{ background: 'linear-gradient(to bottom, hsl(var(--primary)), #A855F7)' }}
        />
        <span
          style={{
            fontFamily: 'BMWTypeNext',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          {title}
        </span>
        <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
      </div>
      {children}
    </div>
  );
}
