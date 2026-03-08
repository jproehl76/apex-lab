export interface AppMemory {
  lastActiveTab: string;
  lastViewedLapIndex: number;
  debriefNotes: Record<string, string>;
  preferences: {
    tempUnit: 'f' | 'c';
    chartHeight: 'compact' | 'normal' | 'expanded';
  };
  trackHistory: Array<{
    sessionId: string;
    track: string;
    date: string;
    bestLap: string;
    lapCount: number;
  }>;
  whoopBaselines: {
    restingHR: number | null;
    hrv: number | null;
    lastUpdated: string | null;
  };
}

export const DEFAULT_MEMORY: AppMemory = {
  lastActiveTab: 'overview',
  lastViewedLapIndex: 0,
  debriefNotes: {},
  preferences: { tempUnit: 'f', chartHeight: 'normal' },
  trackHistory: [],
  whoopBaselines: { restingHR: null, hrv: null, lastUpdated: null },
};

const OLD_DB_NAME  = 'm3_dashboard';
const DB_NAME      = 'apex_lab_v1';
const DB_VERSION   = 1;
const STORE_NAME   = 'memory';
const OLD_MEMORY_KEY = 'm3_memory_v1';
const MEMORY_KEY   = 'apex_lab_memory_v1';

/** One-time migration: copy data from old 'm3_dashboard' IDB to 'apex_lab_v1'. */
async function migrateOldDB(): Promise<void> {
  try {
    // Check whether old DB exists by attempting to open it
    const oldData = await new Promise<AppMemory | null>((resolve) => {
      const req = indexedDB.open(OLD_DB_NAME, 1);
      req.onupgradeneeded = () => { req.transaction?.abort(); resolve(null); };
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) { db.close(); resolve(null); return; }
        const get = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(OLD_MEMORY_KEY);
        get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
        get.onerror   = () => { db.close(); resolve(null); };
      };
      req.onerror = () => resolve(null);
    });

    if (!oldData) return; // nothing to migrate

    // Write to new DB
    const newDB = await openDBInternal();
    await new Promise<void>((resolve, reject) => {
      const tx = newDB.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(oldData, MEMORY_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });

    // Delete old DB
    indexedDB.deleteDatabase(OLD_DB_NAME);
  } catch { /* silent — migration is best-effort */ }
}

let _migrationDone = false;

function openDBInternal(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function openDB(): Promise<IDBDatabase> {
  if (!_migrationDone) {
    _migrationDone = true;
    await migrateOldDB();
  }
  return openDBInternal();
}

function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source as object) as Array<keyof T>) {
    const s = source[key]; const t = target[key];
    if (s !== null && typeof s === 'object' && !Array.isArray(s) && t !== null && typeof t === 'object') {
      result[key] = deepMerge(t, s as Partial<typeof t>);
    } else if (s !== undefined) {
      result[key] = s as T[keyof T];
    }
  }
  return result;
}

export async function readMemory(): Promise<AppMemory> {
  try {
    const db = await openDB();
    return new Promise(resolve => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(MEMORY_KEY);
      req.onsuccess = () => resolve({ ...DEFAULT_MEMORY, ...(req.result ?? {}) });
      req.onerror = () => resolve(DEFAULT_MEMORY);
    });
  } catch { return DEFAULT_MEMORY; }
}

export async function writeMemory(patch: Partial<AppMemory>): Promise<void> {
  try {
    const current = await readMemory();
    const next = deepMerge(current, patch);
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(next, MEMORY_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* silent */ }
}
