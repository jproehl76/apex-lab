import { useEffect } from 'react';
import { toast } from 'sonner';
import { dbGet, dbDelete } from '@/lib/db';
import { parseRacechronoCsv } from '@/lib/parseRacechronoCsv';
import type { SessionSummary } from '@/types/session';
import type { PersistedSessionStore } from '@/lib/usePersistedSessions';

interface SharedFile {
  filename: string;
  text: string;
}

/**
 * On mount, checks IndexedDB for a file shared via the Web Share Target API.
 * If found, parses and loads it as a session, then clears the pending entry.
 */
export function useShareTarget(store: PersistedSessionStore) {
  useEffect(() => {
    // Only process if we landed here via Share Target (?shared=1)
    const url = new URL(window.location.href);
    const isShared = url.searchParams.has('shared');

    async function processPending() {
      const pending = await dbGet<SharedFile>('share:pending');
      if (!pending) return;

      // Clear the pending entry first to avoid re-processing on reload
      await dbDelete('share:pending');

      // Remove ?shared=1 from URL without reload
      if (isShared) {
        url.searchParams.delete('shared');
        window.history.replaceState({}, '', url.pathname + (url.search || ''));
      }

      try {
        const isCsv =
          pending.filename.toLowerCase().endsWith('.csv') ||
          pending.text.trimStart().startsWith('This file is created using RaceChrono');

        let data: SessionSummary;
        if (isCsv) {
          data = parseRacechronoCsv(pending.text);
        } else {
          data = JSON.parse(pending.text) as SessionSummary;
        }

        const result = store.addSession(pending.filename, data);
        if (result.ok) {
          toast.success(`Session loaded from RaceChrono: ${pending.filename}`);
        } else {
          toast.error(result.error ?? 'Could not load shared session.');
        }
      } catch {
        toast.error('Could not parse the shared file.');
      }
    }

    processPending();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
