import { useCallback } from 'react';
import { useSessionStore } from '@/lib/sessionStore';
import type { SessionStore } from '@/lib/sessionStore';

export interface PersistedSessionStore extends SessionStore {
  clearSavedSessions: () => void;
  /** Alias for SessionStore.hydrated — true once IDB rehydration completes */
  hydrated: boolean;
}

/**
 * Thin wrapper around useSessionStore that adds clearSavedSessions.
 * All persistence (IndexedDB) is handled inside useSessionStore.
 */
export function usePersistedSessions(): PersistedSessionStore {
  const store = useSessionStore();

  // clearSavedSessions = clearAll (IDB + in-memory state both cleared)
  const clearSavedSessions = useCallback(() => store.clearAll(), [store]);

  return { ...store, clearSavedSessions };
}
