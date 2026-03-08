import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Square, ChevronRight } from 'lucide-react';
import type { LoadedSession } from '@/types/session';
import type { UserProfile } from '@/lib/userProfile';
import type { ConversationMessage } from '@/lib/services/coachingApi';
import { buildSessionSummary, getCoachingAnalysis } from '@/lib/services/coachingApi';
import { AVAILABLE_MODELS } from '@/lib/services/modelConfig';
import type { AppMemory } from '@/lib/memory';

// ── Minimal markdown renderer (no external lib) ────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)(\n|$)/gs, (m) => `<ul>${m}</ul>`)
    .replace(/<\/ul><ul>/g, '')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[h|u|p|l])(.+)$/gm, '$1');
}

function MarkdownBlock({ text }: { text: string }) {
  return (
    <div
      className="coaching-md"
      style={{ fontFamily: 'BMWTypeNext', fontSize: 13, lineHeight: 1.65, color: '#D0D0E8' }}
      dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(text)}</p>` }}
    />
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  sessions: LoadedSession[];
  profile: UserProfile | null;
  trackHistory: AppMemory['trackHistory'];
}

// ── Component ──────────────────────────────────────────────────────────────

export function CoachingChat({ sessions, profile, trackHistory }: Props) {
  const [history, setHistory]       = useState<ConversationMessage[]>([]);
  const [streamText, setStreamText] = useState('');
  const [streaming, setStreaming]   = useState(false);
  const [input, setInput]           = useState('');
  const [error, setError]           = useState('');
  const abortRef                    = useRef<AbortController | null>(null);
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  const session     = sessions[0];
  const modelId     = profile?.preferredModel ?? 'claude-sonnet-4-6';
  const modelLabel  = AVAILABLE_MODELS.find(m => m.id === modelId)?.label ?? modelId;
  const isEnabled   = profile?.aiCoachingEnabled ?? false;
  const hasKey      = !!profile?.anthropicApiKey || !!import.meta.env.VITE_ANTHROPIC_API_KEY;
  const hasProxy    = !!import.meta.env.VITE_COACHING_WORKER_URL || false;
  const canCoach    = isEnabled && (hasKey || hasProxy) && !!session;

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (streaming) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamText, streaming]);

  async function startAnalysis(userMessage: string) {
    if (!session || streaming) return;

    const { systemPrompt, userMessage: autoMessage } = buildSessionSummary(
      session,
      profile,
      trackHistory
        .filter(h => h.track === session.data.header.track)
        .map(h => ({ date: h.date, bestLap: h.bestLap, lapCount: h.lapCount }))
    );

    const msg = userMessage || autoMessage;
    const newHistory: ConversationMessage[] = [...history, { role: 'user', content: msg }];
    setHistory(newHistory);
    setStreamText('');
    setStreaming(true);
    setError('');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let accumulated = '';

    await getCoachingAnalysis(systemPrompt, msg, {
      apiKey:              profile?.anthropicApiKey ?? import.meta.env.VITE_ANTHROPIC_API_KEY,
      modelId,
      signal:              ctrl.signal,
      conversationHistory: history,
      onChunk: (text) => {
        accumulated += text;
        setStreamText(accumulated);
      },
      onDone: () => {
        setStreaming(false);
        setHistory(prev => [...prev, { role: 'assistant', content: accumulated }]);
        setStreamText('');
        abortRef.current = null;
      },
      onError: (err) => {
        setStreaming(false);
        setError(err.message);
        setStreamText('');
        abortRef.current = null;
      },
    });
  }

  function abort() {
    abortRef.current?.abort();
    setStreaming(false);
    if (streamText) {
      setHistory(prev => [...prev, { role: 'assistant', content: streamText + ' *(cancelled)*' }]);
    }
    setStreamText('');
  }

  async function handleSend() {
    const msg = input.trim();
    if (!msg || streaming) return;
    setInput('');
    await startAnalysis(msg);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // ── Gated: not enabled or no key ────────────────────────────────────────

  if (!isEnabled) return null;

  if (!canCoach) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 mt-4 flex items-center gap-3">
        <Bot size={18} className="text-muted-foreground shrink-0" />
        <p style={{ fontFamily: 'BMWTypeNext', fontSize: 12, color: '#9090B0' }}>
          Add your Anthropic API key in Settings to enable AI coaching.
        </p>
      </div>
    );
  }

  // ── Full chat UI ──────────────────────────────────────────────────────────

  return (
    <div className="mt-4 space-y-3">
      {/* Header bar */}
      <div className="flex items-center gap-2">
        <Bot size={14} className="text-primary shrink-0" />
        <span style={{ fontFamily: 'BMWTypeNext', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
          AI Coaching
        </span>
        {/* Model badge */}
        <span
          className="ml-auto px-2 py-0.5 rounded-full text-[9px] tracking-wider border border-border"
          style={{ fontFamily: 'JetBrains Mono', color: '#6070B0' }}
        >
          {modelLabel}
        </span>
      </div>

      {/* Conversation history */}
      {history.length > 0 && (
        <div className="space-y-3 max-h-[480px] overflow-y-auto scroll-touch pr-1">
          {history.map((msg, i) => (
            <div key={i} className={`rounded-xl p-3 ${msg.role === 'user'
              ? 'bg-primary/10 border border-primary/20 ml-6'
              : 'bg-card border border-border'
            }`}>
              {msg.role === 'user' ? (
                <p style={{ fontFamily: 'BMWTypeNext', fontSize: 12, color: '#9090B0', fontStyle: 'italic' }}>
                  {msg.content.length > 200 ? '(session analysis request)' : msg.content}
                </p>
              ) : (
                <MarkdownBlock text={msg.content} />
              )}
            </div>
          ))}
          {/* Live stream */}
          {streaming && streamText && (
            <div className="rounded-xl p-3 bg-card border border-border">
              <MarkdownBlock text={streamText} />
              <span className="inline-block w-1.5 h-3 bg-primary ml-0.5 animate-pulse rounded-sm" />
            </div>
          )}
          {streaming && !streamText && (
            <div className="rounded-xl p-3 bg-card border border-border flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span style={{ fontFamily: 'BMWTypeNext', fontSize: 11, color: '#6070B0' }}>
                Analysing your session…
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/5"
          style={{ fontFamily: 'BMWTypeNext', color: '#EF3340' }}>
          {error}
        </p>
      )}

      {/* Action row */}
      <div className="flex gap-2">
        {history.length === 0 ? (
          /* First-time analysis button */
          <button
            onClick={() => startAnalysis('')}
            disabled={!session || streaming}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs tracking-wider transition-colors disabled:opacity-40"
            style={{
              background: 'linear-gradient(to right, #1C69D420, #A855F720)',
              border: '1px solid rgba(168,85,247,0.3)',
              color: '#A855F7',
              fontFamily: 'BMWTypeNext',
              letterSpacing: '0.12em',
            }}
          >
            <Bot size={13} />
            Get AI Coaching
            <ChevronRight size={12} />
          </button>
        ) : (
          /* Follow-up input */
          <>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask a follow-up question…"
              disabled={streaming}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              style={{ fontFamily: 'BMWTypeNext', fontSize: 12 }}
            />
            {streaming ? (
              <button
                onClick={abort}
                className="shrink-0 px-3 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                title="Stop"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="shrink-0 px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors disabled:opacity-40"
                title="Send"
              >
                <Send size={14} />
              </button>
            )}
          </>
        )}

        {/* Abort during initial analysis */}
        {streaming && history.length === 0 && (
          <button
            onClick={abort}
            className="shrink-0 px-3 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Square size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
