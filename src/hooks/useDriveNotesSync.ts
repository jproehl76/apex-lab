import { useEffect, useRef, useCallback } from 'react';
import { fetchDriveNotes, saveDriveNotes } from '@/lib/services/driveNotes';
import type { DriveNotesMap } from '@/lib/services/driveNotes';
import type { DebriefNote, AppMemory } from '@/lib/memory';

const DEBOUNCE_MS = 2000;

/** Merge local and remote notes using per-session last-write-wins. */
function mergeNotes(
  local: Record<string, DebriefNote>,
  remote: DriveNotesMap,
): Record<string, DebriefNote> {
  const merged = { ...local };
  for (const [id, remoteNote] of Object.entries(remote)) {
    const localNote = merged[id];
    if (!localNote || remoteNote.updatedAt > localNote.updatedAt) {
      merged[id] = remoteNote;
    }
  }
  return merged;
}

/**
 * Syncs debrief notes to Google Drive.
 * - On mount (with token + loaded memory): pulls from Drive, merges, writes back to both.
 * - Returns a `syncToCloud` callback to debounce-upload after local saves.
 */
export function useDriveNotesSync(
  accessToken: string | null,
  memory: AppMemory,
  memoryLoaded: boolean,
  update: (patch: Partial<AppMemory>) => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(accessToken);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

  const pulledRef = useRef(false);

  // Pull from Drive on mount (once per token + memory load)
  useEffect(() => {
    if (!accessToken || !memoryLoaded || pulledRef.current) return;
    pulledRef.current = true;

    let cancelled = false;

    async function pull() {
      try {
        const remote = await fetchDriveNotes(accessToken!);
        if (cancelled) return;
        if (Object.keys(remote).length === 0 && Object.keys(memory.debriefNotes).length === 0) return;

        const merged = mergeNotes(memory.debriefNotes, remote);
        update({ debriefNotes: merged });

        // Push merged result back to Drive so both sides are in sync
        await saveDriveNotes(accessToken!, merged);
      } catch {
        // Silent: Drive sync is best-effort
      }
    }

    pull();
    return () => { cancelled = true; };
  }, [accessToken, memoryLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced upload to Drive
  const syncToCloud = useCallback((notes: Record<string, DebriefNote>) => {
    if (!tokenRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await saveDriveNotes(tokenRef.current!, notes);
      } catch {
        // Silent: Drive sync is best-effort
      }
    }, DEBOUNCE_MS);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { syncToCloud };
}
