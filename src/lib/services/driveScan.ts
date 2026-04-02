import { fetchDriveFileContent } from '@/lib/services/googleDrive';
import { parseRacechronoCsv } from '@/lib/parseRacechronoCsv';
import { config } from '@/config';
import type { SessionSummary } from '@/types/session';
import type { LoadedSession } from '@/types/session';
import type { SessionManifestEntry, SessionManifest } from '@/lib/coachingStore';
import { readSessionManifest, writeSessionManifest } from '@/lib/coachingStore';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

const MANIFEST_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * List all session files in the Drive folder (paginated, max 200).
 */
async function listAllDriveFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 2; page++) {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      orderBy: 'modifiedTime desc',
      pageSize: '100',
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime)',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!resp.ok) break;

    const json = await resp.json() as { files: DriveFile[]; nextPageToken?: string };
    allFiles.push(...(json.files ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  return allFiles.filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.csv') || name.endsWith('.json');
  });
}

/**
 * Extract manifest entry from a parsed session summary.
 */
function extractManifestEntry(
  summary: SessionSummary,
  filename: string,
  fileId?: string,
  source: 'drive' | 'local' = 'drive'
): SessionManifestEntry {
  return {
    fileId,
    filename,
    track: summary.header.track,
    date: summary.header.date,
    bestLapS: summary.consistency.best_lap_s,
    lapCount: summary.consistency.lap_count ?? summary.laps.length,
    stdDevS: summary.consistency.std_dev_s,
    source,
  };
}

/**
 * Scan Drive folder and build a session manifest.
 * Fetches + parses each file (5 concurrent) to extract metadata.
 */
export async function scanDriveForManifest(
  accessToken: string,
  onProgress?: (done: number, total: number) => void
): Promise<SessionManifestEntry[]> {
  const folderId = config.googleDriveFolderId;
  if (!folderId) return [];

  const files = await listAllDriveFiles(accessToken, folderId);
  if (files.length === 0) return [];

  const entries: SessionManifestEntry[] = [];
  let done = 0;

  // Process in batches of 5
  for (let i = 0; i < files.length; i += 5) {
    const batch = files.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (file) => {
        const content = await fetchDriveFileContent(file.id, accessToken);
        const isCsv =
          file.name.toLowerCase().endsWith('.csv') ||
          content.trimStart().startsWith('This file is created using RaceChrono');

        let summary: SessionSummary;
        if (isCsv) {
          summary = parseRacechronoCsv(content);
        } else {
          summary = JSON.parse(content) as SessionSummary;
        }
        return extractManifestEntry(summary, file.name, file.id, 'drive');
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') entries.push(r.value);
    }

    done += batch.length;
    onProgress?.(done, files.length);
  }

  return entries;
}

/**
 * Merge locally loaded sessions into a manifest, deduplicating by track+date.
 */
export function mergeLocalSessions(
  manifest: SessionManifestEntry[],
  localSessions: LoadedSession[]
): SessionManifestEntry[] {
  const seen = new Set(manifest.map(e => `${e.track}|${e.date}`));
  const merged = [...manifest];

  for (const s of localSessions) {
    const key = `${s.data.header.track}|${s.data.header.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(extractManifestEntry(s.data, s.filename, undefined, 'local'));
  }

  return merged;
}

/**
 * Get cached manifest if fresh, otherwise re-scan Drive.
 */
export async function getOrScanManifest(
  accessToken: string | null,
  localSessions: LoadedSession[],
  onProgress?: (done: number, total: number) => void
): Promise<{ entries: SessionManifestEntry[]; fromCache: boolean }> {
  const cached = await readSessionManifest();

  if (cached && Date.now() - new Date(cached.scannedAt).getTime() < MANIFEST_MAX_AGE_MS) {
    return { entries: mergeLocalSessions(cached.entries, localSessions), fromCache: true };
  }

  if (!accessToken) {
    // No Drive token: use local sessions only + stale cache
    const driveEntries = cached?.entries ?? [];
    return { entries: mergeLocalSessions(driveEntries, localSessions), fromCache: true };
  }

  const driveEntries = await scanDriveForManifest(accessToken, onProgress);
  const manifest: SessionManifest = {
    entries: driveEntries,
    scannedAt: new Date().toISOString(),
  };
  await writeSessionManifest(manifest);

  return { entries: mergeLocalSessions(driveEntries, localSessions), fromCache: false };
}
