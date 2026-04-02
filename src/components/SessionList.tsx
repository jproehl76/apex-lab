import { useState, useRef, useEffect } from 'react';
import { X, Eye, EyeOff, Pencil, Check } from 'lucide-react';
import { autoAnimate } from '@formkit/auto-animate';
import type { LoadedSession } from '@/types/session';
import { sessionLabel } from '@/lib/utils';
import { ShareButton } from '@/components/ShareButton';

interface SessionListProps {
  sessions: LoadedSession[];
  activeIds: Set<string>;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onClearAll: () => void;
}

export function SessionList({ sessions, activeIds, onToggle, onRemove, onRename, onClearAll }: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) autoAnimate(listRef.current);
  }, []);

  if (sessions.length === 0) return null;

  const startEdit = (session: LoadedSession) => {
    setEditingId(session.id);
    setEditValue(session.label ?? sessionLabel(session));
  };

  const commitEdit = (id: string) => {
    onRename(id, editValue);
    setEditingId(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          Sessions ({sessions.length})
        </p>
        <button onClick={onClearAll} className="text-[12px] tracking-widest uppercase text-muted-foreground/50 hover:text-destructive transition-colors">
          Clear all
        </button>
      </div>

      <div ref={listRef} className="space-y-1">
        {sessions.map((session) => {
          const isActive = activeIds.has(session.id);
          const isEditing = editingId === session.id;

          return (
            <div key={session.id}
              className="flex items-center gap-2 rounded border px-2.5 py-1.5 transition-colors"
              style={{
                borderColor: isActive ? `${session.color}40` : 'hsl(var(--border))',
                background: isActive ? `${session.color}0A` : 'transparent',
              }}>
              <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: session.color }} />

              {isEditing ? (
                <input
                  className="flex-1 min-w-0 text-xs bg-secondary text-foreground rounded px-1 py-0.5 outline-none border border-primary"
                  value={editValue}
                  autoFocus
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(session.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit(session.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <span className="flex-1 min-w-0 text-xs truncate tracking-wide"
                  style={{ color: isActive ? '#D0D0E0' : 'hsl(var(--muted-foreground))' }}>
                  {sessionLabel(session)}
                </span>
              )}

              <button onClick={() => isEditing ? commitEdit(session.id) : startEdit(session)}
                className="shrink-0 p-2 -m-1 rounded text-muted-foreground/40 hover:text-muted-foreground active:opacity-60 transition-all"
                title={isEditing ? 'Save name' : 'Rename session'}>
                {isEditing ? <Check size={12} /> : <Pencil size={12} />}
              </button>

              <ShareButton session={session} className="shrink-0 p-2 -m-1" />

              <button onClick={() => onToggle(session.id)}
                className="shrink-0 p-2 -m-1 rounded text-muted-foreground/40 hover:text-muted-foreground active:opacity-60 transition-all"
                title={isActive ? 'Hide session' : 'Show session'}>
                {isActive ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>

              <button onClick={() => onRemove(session.id)}
                className="shrink-0 p-2 -m-1 rounded text-muted-foreground/40 hover:text-destructive active:opacity-60 transition-all"
                title="Remove session">
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
