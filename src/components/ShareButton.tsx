import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildShareUrl } from '@/lib/shareSession';
import { formatLapTime } from '@/lib/utils';
import type { LoadedSession } from '@/types/session';

interface ShareButtonProps {
  session: LoadedSession;
  className?: string;
}

export function ShareButton({ session, className = '' }: ShareButtonProps) {
  async function handleShare() {
    const url = buildShareUrl(session);

    // Prefer navigator.share on mobile (shows native share sheet)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${session.data.header.track} — ${session.data.header.date}`,
          text: `Best lap: ${formatLapTime(session.data.consistency.best_lap_s)} at ${session.data.header.track}`,
          url,
        });
        return;
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  }

  return (
    <button
      onClick={handleShare}
      className={`shrink-0 p-2 -m-1 rounded text-muted-foreground/40 hover:text-primary active:opacity-60 transition-all ${className}`}
      title="Share session">
      <Share2 size={12} />
    </button>
  );
}

