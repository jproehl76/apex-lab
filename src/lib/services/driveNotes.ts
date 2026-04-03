import { config } from '@/config';

export interface DriveNote {
  text: string;
  updatedAt: number;
}

export type DriveNotesMap = Record<string, DriveNote>;

interface DriveNotesFile {
  version: 1;
  notes: DriveNotesMap;
}

const NOTES_FILENAME = 'apex-lab-notes.json';

/** Search for the notes JSON file in the configured Drive folder. Returns file ID or null. */
export async function findNotesFile(accessToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: `name = '${NOTES_FILENAME}' and '${config.googleDriveFolderId}' in parents and trashed = false`,
    fields: 'files(id)',
    pageSize: '1',
  });

  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!resp.ok) return null;

  const json = (await resp.json()) as { files?: Array<{ id: string }> };
  return json.files?.[0]?.id ?? null;
}

/** Download and parse the notes JSON from Drive. Returns empty map if file doesn't exist. */
export async function fetchDriveNotes(accessToken: string): Promise<DriveNotesMap> {
  const fileId = await findNotesFile(accessToken);
  if (!fileId) return {};

  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!resp.ok) return {};

  try {
    const data = (await resp.json()) as DriveNotesFile;
    return data.notes ?? {};
  } catch {
    return {};
  }
}

/** Upload (create or update) the notes JSON file in the configured Drive folder. */
export async function saveDriveNotes(accessToken: string, notes: DriveNotesMap): Promise<void> {
  const fileId = await findNotesFile(accessToken);
  const body: DriveNotesFile = { version: 1, notes };
  const jsonBlob = new Blob([JSON.stringify(body)], { type: 'application/json' });

  const metadata: Record<string, unknown> = { name: NOTES_FILENAME, mimeType: 'application/json' };
  if (!fileId) {
    metadata.parents = [config.googleDriveFolderId];
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', jsonBlob);

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = fileId ? 'PATCH' : 'POST';

  const resp = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!resp.ok) {
    throw new Error(`Drive upload failed: ${resp.status} ${resp.statusText}`);
  }
}
