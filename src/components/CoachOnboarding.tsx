import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Square } from 'lucide-react';
import { MarkdownBlock } from '@/components/MarkdownBlock';
import { buildExpertSystemPrompt } from '@/lib/services/expertCoachingPrompt';
import { getCoachingAnalysis, type ConversationMessage } from '@/lib/services/coachingApi';
import { EXPERT_COACHING_MODEL } from '@/lib/services/expertCoachingPrompt';
import type { CoachingProfile } from '@/lib/coachingStore';
import { writeCoachingProfile } from '@/lib/coachingStore';

interface Props {
  apiKey: string;
  onComplete: (profile: CoachingProfile) => void;
}

export function CoachOnboarding({ apiKey, onComplete }: Props) {
  const [history, setHistory]       = useState<ConversationMessage[]>([]);
  const [streaming, setStreaming]   = useState('');
  const [input, setInput]          = useState('');
  const [loading, setLoading]      = useState(false);
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef   = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, streaming]);

  function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ConversationMessage = { role: 'user', content: text.trim() };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput('');
    setLoading(true);
    setStreaming('');

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const systemPrompt = buildExpertSystemPrompt(false, null);

    let accumulated = '';
    getCoachingAnalysis(systemPrompt, text.trim(), {
      apiKey,
      modelId: EXPERT_COACHING_MODEL,
      maxTokens: 2048,
      signal: ctrl.signal,
      conversationHistory: nextHistory.slice(0, -1),
      onChunk: (chunk) => {
        accumulated += chunk;
        setStreaming(accumulated);
      },
      onDone: () => {
        setHistory(prev => [...prev, { role: 'assistant', content: accumulated }]);
        setStreaming('');
        setLoading(false);
      },
      onError: (err) => {
        if (ctrl.signal.aborted) return;
        setHistory(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
        setStreaming('');
        setLoading(false);
      },
    });
  }

  // Start onboarding automatically (deferred to avoid setState-in-effect lint)
  const sendOnMount = useRef(false);
  useEffect(() => {
    if (history.length === 0 && !loading && !sendOnMount.current) {
      sendOnMount.current = true;
      queueMicrotask(() => sendMessage('Hello! I just set up the app. Can you walk me through getting started?'));
    }
  });

  function handleStop() {
    abortRef.current?.abort();
    if (streaming) {
      setHistory(prev => [...prev, { role: 'assistant', content: streaming }]);
    }
    setStreaming('');
    setLoading(false);
  }

  async function handleConfirmProfile() {
    // Extract profile from conversation (the model's last response should contain the summary)
    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
    const profile: CoachingProfile = {
      driverName: '',
      onboardingComplete: true,
      updatedAt: new Date().toISOString(),
    };

    // Parse basic info from the conversation
    if (lastAssistant) {
      const text = lastAssistant.content;
      const nameMatch = text.match(/(?:Driver|Name):\s*(.+?)(?:\n|$)/i);
      if (nameMatch) profile.driverName = nameMatch[1].trim();

      const carMatch = text.match(/(?:Car|Vehicle):\s*(.+?)(?:\n|$)/i);
      if (carMatch) {
        const parts = carMatch[1].trim().split(/\s+/);
        const yearMatch = parts.find(p => /^\d{4}$/.test(p));
        if (yearMatch) profile.carYear = parseInt(yearMatch);
        profile.carModel = carMatch[1].trim();
      }

      const goalMatch = text.match(/(?:Goal|Goals?):\s*(.+?)(?:\n|$)/i);
      if (goalMatch) profile.goals = goalMatch[1].trim();

      const expMatch = text.match(/(?:Experience|Level):\s*(.+?)(?:\n|$)/i);
      if (expMatch) profile.experienceLevel = expMatch[1].trim();
    }

    await writeCoachingProfile(profile);
    setProfileConfirmed(true);
    onComplete(profile);
  }

  // Check if the model has output a summary (look for confirmation-like patterns)
  const lastMsg = history[history.length - 1];
  const showConfirm = !profileConfirmed && history.length >= 6 && lastMsg?.role === 'assistant' &&
    /(?:profile|summary|here's what|does this look|sound right|confirm)/i.test(lastMsg.content);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <span className="text-[12px] tracking-widest text-muted-foreground uppercase">
          Coach Onboarding
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-touch p-3 space-y-3">
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
                <p style={{ fontFamily: 'BMWTypeNext', fontSize: 15, color: '#D0D0E8' }}>{msg.content}</p>
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

        {showConfirm && (
          <div className="flex justify-center py-2">
            <button
              onClick={handleConfirmProfile}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs tracking-widest uppercase hover:opacity-90 transition-opacity"
              style={{ fontFamily: 'BMWTypeNext' }}
            >
              Confirm Profile
            </button>
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
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Type your response..."
            disabled={loading || profileConfirmed}
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
              disabled={!input.trim() || profileConfirmed}
              className="shrink-0 p-2 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30">
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
