import { useState, useEffect, useCallback } from 'react';
import { useMemory } from '@/hooks/useMemory';

const MAX_CHARS = 2000;
const LS_KEY = (id: string) => `notes:${id}`;

interface Props {
  sessionId: string;
}

export function DebriefNotes({ sessionId }: Props) {
  const { memory, loaded, update } = useMemory();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [migrated, setMigrated] = useState(false);

  // Hydrate from IndexedDB once loaded; migrate from localStorage on first use
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;

    // Wrapped in a microtask to satisfy React compiler's set-state-in-effect rule
    void Promise.resolve().then(() => {
      if (cancelled) return;

      const idbValue = memory.debriefNotes[sessionId] ?? '';
      if (idbValue) {
        setText(idbValue);
        setMigrated(true);
        return;
      }

      // One-time migration: pull from localStorage if IDB has nothing
      try {
        const lsValue = localStorage.getItem(LS_KEY(sessionId));
        if (lsValue) {
          setText(lsValue);
          update({ debriefNotes: { ...memory.debriefNotes, [sessionId]: lsValue } });
          localStorage.removeItem(LS_KEY(sessionId));
        }
      } catch { /* quota or restricted */ }

      setMigrated(true);
    });

    return () => { cancelled = true; };
  }, [loaded, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBlur = useCallback(() => {
    const trimmed = text.slice(0, MAX_CHARS);
    update({ debriefNotes: { ...memory.debriefNotes, [sessionId]: trimmed } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [sessionId, text, memory.debriefNotes, update]);

  const remaining = MAX_CHARS - text.length;

  if (!loaded || !migrated) {
    return (
      <div className="w-full h-20 rounded-lg animate-pulse" style={{ background: '#1A1A24' }} />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 text-xs p-3 resize-none focus:outline-none focus:border-blue-500 transition-colors"
        rows={6}
        maxLength={MAX_CHARS}
        placeholder="Add debrief notes for this session…"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={handleBlur}
        aria-label="Session debrief notes"
      />
      <div className="flex items-center justify-between text-xs">
        <span className={remaining < 100 ? 'text-red-400' : 'text-slate-600'}>
          {text.length} / {MAX_CHARS}
        </span>
        {saved && <span className="text-emerald-400">Saved ✓</span>}
      </div>
    </div>
  );
}
