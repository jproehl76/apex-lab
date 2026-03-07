import { Printer } from 'lucide-react';

interface PrintButtonProps {
  className?: string;
}

export function PrintButton({ className = '' }: PrintButtonProps) {
  return (
    <button
      onClick={() => window.print()}
      className={`no-print flex items-center gap-1.5 px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors text-[10px] tracking-wider ${className}`}
      title="Print / Save as PDF"
      style={{ fontFamily: 'JetBrains Mono' }}>
      <Printer size={12} />
      <span className="hidden xl:inline">PDF</span>
    </button>
  );
}
