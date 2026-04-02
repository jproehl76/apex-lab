import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Bot, Send, Square, ChevronDown, CloudOff } from 'lucide-react';
import { MarkdownBlock } from '@/components/MarkdownBlock';
import { CoachOnboarding } from '@/components/CoachOnboarding';
import { sendExpertCoachingMessage, type ExpertCoachingContext } from '@/lib/services/expertCoachingApi';
import type { ConversationMessage } from '@/lib/services/coachingApi';
import type { LoadedSession } from '@/types/session';
import type { UserProfile } from '@/lib/userProfile';
import type { CoachingProfile, SessionManifestEntry } from '@/lib/coachingStore';
import {
  readCoachingProfile,
  readConversation,
  writeConversation,
  readLastRecommendation,
  writeLastRecommendation,
  type CoachingConversation,
} from '@/lib/coachingStore';
import { getOrScanManifest, mergeLocalSessions } from '@/lib/services/driveScan';
import { formatLapTime } from '@/lib/utils';
import { config } from '@/config';

const GENERAL_TRACK = '__general__';

export interface ExpertCoachProps {
  sessions: LoadedSession[];
  profile: UserProfile | null;
  userEmail: string;
  driveAccessToken: string | null;
}

export function ExpertCoach({ sessions, profile, userEmail, driveAccessToken }: ExpertCoachProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [coachingProfile, setCoachingProfile] = useState<CoachingProfile | null>(null);
  const [manifest, setManifest] = useState<SessionManifestEntry[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string>(GENERAL_TRACK);
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [streaming, setStreaming] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRec, setLastRec] = useState<string | undefined>();
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scanRan = useRef(false);

  const apiKey = profile?.anthropicApiKey;
  const isOwner = userEmail.toLowerCase() === config.ownerEmail?.toLowerCase();

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, streaming]);

  // ── Load coaching profile + last recommendation ────────────────────────────
  useEffect(() => {
    async function load() {
      const [cp, rec] = await Promise.all([
        readCoachingProfile(),
        readLastRecommendation(),
      ]);
      setCoachingProfile(cp ?? null);
      setLastRec(rec);
      setProfileLoaded(true);
    }
    load();
  }, []);

  // ── Build/scan manifest ────────────────────────────────────────────────────
  useEffect(() => {
    if (scanRan.current) return;
    scanRan.current = true;

    async function scan() {
      const { entries } = await getOrScanManifest(
        driveAccessToken,
        sessions,
        (done, total) => setScanProgress({ done, total })
      );
      setManifest(entries);
      setScanProgress(null);
    }
    scan();
  }, [driveAccessToken, sessions]);

  // Merge local sessions into manifest (derived state)
  const mergedManifest = useMemo(
    () => manifest.length > 0 ? mergeLocalSessions(manifest, sessions) : manifest,
    [manifest, sessions]
  );

  // ── Track list from manifest ───────────────────────────────────────────────
  const trackOptions = useMemo(() => {
    const byTrack = new Map<string, { count: number; bestLapS: number; lastDate: string }>();
    for (const e of mergedManifest) {
      const existing = byTrack.get(e.track);
      if (!existing) {
        byTrack.set(e.track, { count: 1, bestLapS: e.bestLapS, lastDate: e.date });
      } else {
        existing.count++;
        if (e.bestLapS < existing.bestLapS) existing.bestLapS = e.bestLapS;
        if (e.date > existing.lastDate) existing.lastDate = e.date;
      }
    }
    return [...byTrack.entries()]
      .sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate))
      .map(([track, info]) => ({ track, ...info }));
  }, [mergedManifest]);

  // ── Load conversation when track changes ───────────────────────────────────
  useEffect(() => {
    async function loadConv() {
      const conv = await readConversation(selectedTrack);
      setHistory(conv?.messages ?? []);
    }
    loadConv();
  }, [selectedTrack]);

  // ── Find recent/best sessions for selected track ──────────────────────────
  const { recentSession, bestSession } = useMemo(() => {
    if (selectedTrack === GENERAL_TRACK) return { recentSession: undefined, bestSession: undefined };
    const trackSessions = sessions.filter(s => s.data.header.track === selectedTrack);
    if (trackSessions.length === 0) return { recentSession: undefined, bestSession: undefined };

    const sorted = [...trackSessions].sort((a, b) =>
      b.data.header.date.localeCompare(a.data.header.date)
    );
    const recent = sorted[0];
    const best = [...trackSessions].sort((a, b) =>
      a.data.consistency.best_lap_s - b.data.consistency.best_lap_s
    )[0];

    return { recentSession: recent, bestSession: best };
  }, [selectedTrack, sessions]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || loading || !apiKey) return;

    const userMsg: ConversationMessage = { role: 'user', content: text.trim() };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput('');
    setLoading(true);
    setStreaming('');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const context: ExpertCoachingContext = {
      isOwner,
      coachingProfile,
      manifest: mergedManifest,
      selectedTrack: selectedTrack === GENERAL_TRACK ? undefined : selectedTrack,
      recentSession,
      bestSession,
      lastRecommendation: lastRec,
    };

    let accumulated = '';
    sendExpertCoachingMessage(
      text.trim(),
      history, // send prior history (not including current user msg, API adds it)
      context,
      {
        apiKey,
        signal: ctrl.signal,
        onChunk: (chunk) => {
          accumulated += chunk;
          setStreaming(accumulated);
        },
        onDone: () => {
          const newHistory = [...nextHistory, { role: 'assistant' as const, content: accumulated }];
          setHistory(newHistory);
          setStreaming('');
          setLoading(false);

          // Persist conversation
          const conv: CoachingConversation = {
            track: selectedTrack,
            messages: newHistory,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          writeConversation(conv).catch(() => {});

          // Store last recommendation (last 500 chars of response)
          const snippet = accumulated.slice(-500);
          writeLastRecommendation(snippet).catch(() => {});
          setLastRec(snippet);
        },
        onError: (err) => {
          if (ctrl.signal.aborted) return;
          setHistory(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
          setStreaming('');
          setLoading(false);
        },
      }
    );
  }, [history, loading, apiKey, isOwner, coachingProfile, mergedManifest, selectedTrack, recentSession, bestSession, lastRec]);

  function handleStop() {
    abortRef.current?.abort();
    if (streaming) {
      setHistory(prev => [...prev, { role: 'assistant', content: streaming }]);
    }
    setStreaming('');
    setLoading(false);
  }

  // ── No API key ─────────────────────────────────────────────────────────────
  if (!apiKey) {
    return (
      <div className="flex items-center justify-center p-8 rounded-lg bg-card border border-border">
        <p className="text-xs tracking-widest text-muted-foreground uppercase text-center">
          Add your Anthropic API key in Settings to use the expert coach
        </p>
      </div>
    );
  }

  // ── Onboarding for non-owner without profile ──────────────────────────────
  if (profileLoaded && !isOwner && !coachingProfile?.onboardingComplete) {
    return (
      <div className="rounded-lg bg-card border border-border overflow-hidden" style={{ height: 500 }}>
        <CoachOnboarding apiKey={apiKey} onComplete={setCoachingProfile} />
      </div>
    );
  }

  // ── Track stats for selected track ─────────────────────────────────────────
  const trackInfo = selectedTrack !== GENERAL_TRACK
    ? trackOptions.find(t => t.track === selectedTrack)
    : null;

  return (
    <div className="flex flex-col rounded-lg bg-card border border-border overflow-hidden" style={{ height: 520 }}>
      {/* Track selector + scan progress */}
      <div className="shrink-0 px-3 py-2 border-b border-border space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={selectedTrack}
              onChange={e => setSelectedTrack(e.target.value)}
              className="w-full appearance-none bg-background border border-border rounded px-3 py-1.5 pr-8 text-xs text-foreground focus:outline-none focus:border-primary/50"
              style={{ fontFamily: 'BMWTypeNext', letterSpacing: '0.08em' }}
            >
              <option value={GENERAL_TRACK}>General Coaching</option>
              {trackOptions.map(t => (
                <option key={t.track} value={t.track}>
                  {t.track} ({t.count} sessions)
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          {!driveAccessToken && (
            <div className="flex items-center gap-1 text-muted-foreground/50" title="Connect Google Drive for full session history">
              <CloudOff size={12} />
              <span className="text-[8px] tracking-widest uppercase">No Drive</span>
            </div>
          )}
        </div>

        {/* Scan progress */}
        {scanProgress && (
          <div className="space-y-0.5">
            <div className="h-1 bg-background rounded overflow-hidden">
              <div
                className="h-full bg-primary/60 transition-all duration-300"
                style={{ width: `${(scanProgress.done / scanProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-[8px] tracking-widest text-muted-foreground/50 uppercase">
              Scanning Drive: {scanProgress.done}/{scanProgress.total} files
            </p>
          </div>
        )}

        {/* Track stats bar */}
        {trackInfo && (
          <div className="flex items-center gap-3 text-[9px] tracking-wider text-muted-foreground">
            <span>{trackInfo.count} sessions</span>
            <span className="text-primary">{formatLapTime(trackInfo.bestLapS)}</span>
            <span>Last: {trackInfo.lastDate}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-touch p-3 space-y-3 min-h-0">
        {history.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <Bot size={24} className="text-primary/30" />
            <p className="text-[10px] tracking-widest text-muted-foreground/40 uppercase max-w-[280px]">
              {selectedTrack === GENERAL_TRACK
                ? 'Ask about your overall driving progression, track recommendations, or season planning'
                : `Ask about your performance at ${selectedTrack}`}
            </p>
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="shrink-0 mt-0.5">
                <Bot size={14} className="text-primary" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
              msg.role === 'user'
                ? 'bg-primary/10 border border-primary/20'
                : 'bg-card border border-border'
            }`}>
              {msg.role === 'assistant' ? (
                <MarkdownBlock text={msg.content} />
              ) : (
                <p style={{ fontFamily: 'BMWTypeNext', fontSize: 13, color: '#D0D0E8' }}>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex gap-2">
            <div className="shrink-0 mt-0.5"><Bot size={14} className="text-primary" /></div>
            <div className="max-w-[85%] rounded-lg px-3 py-2 bg-card border border-border">
              <MarkdownBlock text={streaming} />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-2">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder={
              selectedTrack === GENERAL_TRACK
                ? 'Ask your coach anything...'
                : `Ask about ${selectedTrack}...`
            }
            disabled={loading}
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            style={{ fontFamily: 'BMWTypeNext' }}
          />
          {loading ? (
            <button onClick={handleStop}
              className="shrink-0 p-2 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors">
              <Square size={16} />
            </button>
          ) : (
            <button onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="shrink-0 p-2 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30">
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
