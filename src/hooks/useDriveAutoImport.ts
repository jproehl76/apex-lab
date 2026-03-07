import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { fetchDriveFileContent } from '@/lib/services/googleDrive';
import { parseRacechronoCsv } from '@/lib/parseRacechronoCsv';
import { config } from '@/config';
import type { SessionSummary } from '@/types/session';
import type { PersistedSessionStore } from '@/lib/usePersistedSessions';

const LS_IMPORTED_KEY = 'drive:imported-ids';
const SS_CHECKED_KEY  = 'drive:auto-checked';

function getImportedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_IMPORTED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveImportedIds(ids: Set<string>) {
  try {
    localStorage.setItem(LS_IMPORTED_KEY, JSON.stringify([...ids]));
  } catch { /* quota */ }
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

/**
 * On app open (once per browser tab), scans the configured Google Drive folder
 * for new session files and automatically imports them.
 * Requires a valid Google OAuth access token with drive.readonly scope.
 */
export function useDriveAutoImport(
  accessToken: string | null,
  store: PersistedSessionStore,
  hydrated: boolean
) {
  const ran = useRef(false);

  useEffect(() => {
    if (!accessToken) return;
    if (!hydrated) return;
    if (!config.googleDriveFolderId) return;
    if (ran.current) return;
    // Once per browser tab session
    if (sessionStorage.getItem(SS_CHECKED_KEY)) return;

    ran.current = true;
    sessionStorage.setItem(SS_CHECKED_KEY, '1');

    async function scan() {
      const importedIds = getImportedIds();

      // List files in the folder
      const params = new URLSearchParams({
        q: `'${config.googleDriveFolderId}' in parents and trashed = false`,
        orderBy: 'modifiedTime desc',
        pageSize: '30',
        fields: 'files(id,name,mimeType,modifiedTime)',
      });

      let files: DriveFile[] = [];
      try {
        const resp = await fetch(
          `https://www.googleapis.com/drive/v3/files?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!resp.ok) return; // not authenticated or quota — silently skip
        const json = await resp.json() as { files: DriveFile[] };
        files = json.files ?? [];
      } catch {
        return; // network error — skip silently
      }

      // Filter to CSV/JSON session files we haven't imported yet
      const newFiles = files.filter(f => {
        if (importedIds.has(f.id)) return false;
        const name = f.name.toLowerCase();
        return name.endsWith('.csv') || name.endsWith('.json');
      });

      if (newFiles.length === 0) return;

      let imported = 0;
      for (const file of newFiles) {
        try {
          const content = await fetchDriveFileContent(file.id, accessToken!);
          const isCsv =
            file.name.toLowerCase().endsWith('.csv') ||
            content.trimStart().startsWith('This file is created using RaceChrono');

          let data: SessionSummary;
          if (isCsv) {
            data = parseRacechronoCsv(content);
          } else {
            data = JSON.parse(content) as SessionSummary;
          }

          const result = store.addSession(file.name, data);
          if (result.ok) imported++;
          importedIds.add(file.id); // mark as seen even on dup-session errors
        } catch {
          // Corrupt or unrecognised file — skip
        }
      }

      saveImportedIds(importedIds);
      if (imported > 0) {
        toast.success(
          imported === 1
            ? '1 new session imported from Drive'
            : `${imported} new sessions imported from Drive`
        );
      }
    }

    scan();
  }, [accessToken, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps
}
