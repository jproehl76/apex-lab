import { useState, useCallback, useEffect } from 'react';
import type { LoadedSession, SessionSummary } from '@/types/session';
import { makeSessionId, assignSessionColor, isValidSession } from '@/lib/utils';
import { dbGet, dbSet, dbDelete, dbGetSessionKeys, dbClear } from '@/lib/db';

const META_KEY = '__meta';
const MAX_SESSIONS = 10;

// ── localStorage keys from the old format (for one-time migration) ─────────
const OLD_LS_MAIN = 'm3-sessions-v1';
const OLD_LS_PREFIX = 'session:';

async function migrateFromLocalStorage(): Promise<void> {
  try {
    const individualKeys = Object.keys(localStorage).filter(k => k.startsWith(OLD_LS_PREFIX));
    const mainRaw = localStorage.getItem(OLD_LS_MAIN);
    if (!mainRaw && individualKeys.length === 0) return; // nothing to migrate

    const migratedSessions: LoadedSession[] = [];
    let activeIds: string[] = [];

    if (mainRaw) {
      try {
        const parsed = JSON.parse(mainRaw) as { sessions?: LoadedSession[]; activeIds?: string[] };
        if (Array.isArray(parsed.sessions)) migratedSessions.push(...parsed.sessions);
        if (Array.isArray(parsed.activeIds)) activeIds = parsed.activeIds;
      } catch { /* corrupt — skip */ }
      localStorage.removeItem(OLD_LS_MAIN);
    }

    for (const key of individualKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const s = JSON.parse(raw) as LoadedSession;
        if (!migratedSessions.some(x => x.id === s.id)) migratedSessions.push(s);
      } catch { /* corrupt — skip */ }
      localStorage.removeItem(key);
    }

    for (const s of migratedSessions) {
      await dbSet(`session:${s.id}`, s);
    }
    const ids = activeIds.length > 0 ? activeIds : migratedSessions.map(s => s.id);
    if (ids.length > 0) await dbSet(META_KEY, ids);
  } catch { /* migration failed — silently start fresh */ }
}

export interface SessionStore {
  sessions: LoadedSession[];
  activeSessionIds: Set<string>;
  addSession: (filename: string, data: SessionSummary) => { ok: boolean; error?: string };
  removeSession: (id: string) => void;
  toggleActive: (id: string) => void;
  renameSession: (id: string, label: string) => void;
  clearAll: () => void;
  activeSessions: LoadedSession[];
  /** True once the initial IDB rehydration has completed */
  hydrated: boolean;
}

export function useSessionStore(): SessionStore {
  const [sessions, setSessions] = useState<LoadedSession[]>([]);
  const [activeSessionIds, setActiveSessionIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // One-time rehydration from IndexedDB (with localStorage migration)
  useEffect(() => {
    async function load() {
      await migrateFromLocalStorage();
      try {
        const keys = await dbGetSessionKeys();
        const loaded: LoadedSession[] = [];
        for (const key of keys) {
          const s = await dbGet<LoadedSession>(key);
          if (s) loaded.push(s);
        }
        const savedIds = await dbGet<string[]>(META_KEY);
        const activeIds = savedIds ?? loaded.map(s => s.id);
        setSessions(loaded);
        setActiveSessionIds(new Set(activeIds));
      } catch { /* IDB unavailable — start fresh */ }
      setHydrated(true);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const removeSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setActiveSessionIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      dbSet(META_KEY, [...next]).catch(() => {});
      return next;
    });
    dbDelete(`session:${id}`).catch(() => {});
  }, []);

  const addSession = useCallback(
    (filename: string, data: unknown): { ok: boolean; error?: string } => {
      if (!isValidSession(data)) {
        return { ok: false, error: 'File does not appear to be a valid session summary JSON.' };
      }
      const id = makeSessionId(data);
      if (sessions.some(s => s.id === id)) {
        return { ok: false, error: `Session "${id}" is already loaded.` };
      }

      // Evict oldest if at cap (before adding new)
      if (sessions.length >= MAX_SESSIONS) {
        const oldest = [...sessions].sort(
          (a, b) => new Date(a.data.header.date).getTime() - new Date(b.data.header.date).getTime()
        )[0];
        removeSession(oldest.id);
      }

      const color = assignSessionColor(sessions.length);
      const loaded: LoadedSession = { id, filename, color, data };

      setSessions(prev => [...prev, loaded]);
      setActiveSessionIds(prev => {
        const next = new Set([...prev, id]);
        dbSet(META_KEY, [...next]).catch(() => {});
        return next;
      });
      dbSet(`session:${id}`, loaded).catch(() => {});

      return { ok: true };
    },
    [sessions, removeSession]
  );

  const toggleActive = useCallback((id: string) => {
    setActiveSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      dbSet(META_KEY, [...next]).catch(() => {});
      return next;
    });
  }, []);

  const renameSession = useCallback((id: string, label: string) => {
    setSessions(prev => {
      const next = prev.map(s =>
        s.id === id ? { ...s, label: label.trim() || undefined } : s
      );
      const updated = next.find(s => s.id === id);
      if (updated) dbSet(`session:${id}`, updated).catch(() => {});
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSessions([]);
    setActiveSessionIds(new Set());
    dbClear().catch(() => {});
  }, []);

  const activeSessions = sessions.filter(s => activeSessionIds.has(s.id));

  return {
    sessions,
    activeSessionIds,
    addSession,
    removeSession,
    toggleActive,
    renameSession,
    clearAll,
    activeSessions,
    hydrated,
  };
}
