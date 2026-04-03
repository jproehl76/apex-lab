import { getCoachingAnalysis, type ConversationMessage } from '@/lib/services/coachingApi';
import {
  EXPERT_COACHING_MODEL,
  buildExpertSystemPrompt,
  formatTier1Summary,
  formatTier2TrackData,
  buildInitialUserMessage,
  formatDebriefNotes,
} from '@/lib/services/expertCoachingPrompt';
import { buildSessionSummary } from '@/lib/services/coachingApi';
import type { CoachingProfile, SessionManifestEntry } from '@/lib/coachingStore';
import type { LoadedSession } from '@/types/session';
import type { DebriefNote } from '@/lib/memory';

export interface ExpertCoachingContext {
  isOwner: boolean;
  coachingProfile?: CoachingProfile | null;
  manifest: SessionManifestEntry[];
  selectedTrack?: string;
  recentSession?: LoadedSession;
  bestSession?: LoadedSession;
  lastRecommendation?: string;
  debriefNotes?: Record<string, DebriefNote>;
}

export interface ExpertCoachingOptions {
  apiKey?: string;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

/**
 * Send a message to the expert coaching system.
 * On first message (empty history), builds Tier 1/2 data context.
 * On follow-ups, sends the user message with full history.
 */
export async function sendExpertCoachingMessage(
  userMessage: string,
  history: ConversationMessage[],
  context: ExpertCoachingContext,
  options: ExpertCoachingOptions
): Promise<void> {
  const systemPrompt = buildExpertSystemPrompt(
    context.isOwner,
    context.coachingProfile
  );

  let messageToSend = userMessage;

  // First message: inject Tier 1 + Tier 2 data
  if (history.length === 0) {
    const tier1 = formatTier1Summary(context.manifest);

    let tier2: string | undefined;
    if (context.selectedTrack) {
      const trackEntries = context.manifest.filter(
        e => e.track === context.selectedTrack
      );

      const recentText = context.recentSession
        ? buildSessionSummary(context.recentSession, null, []).userMessage
        : undefined;
      const bestText = context.bestSession && context.bestSession.id !== context.recentSession?.id
        ? buildSessionSummary(context.bestSession, null, []).userMessage
        : undefined;

      tier2 = formatTier2TrackData(trackEntries, recentText, bestText);
    }

    const debriefBlock = context.debriefNotes
      ? formatDebriefNotes(
          context.debriefNotes,
          context.manifest,
          context.selectedTrack
        )
      : undefined;

    const dataMessage = buildInitialUserMessage(
      tier1,
      tier2,
      context.selectedTrack,
      context.lastRecommendation,
      debriefBlock
    );

    // Prepend data context to user's message
    messageToSend = userMessage
      ? `${dataMessage}\n\n---\n\nUser message: ${userMessage}`
      : dataMessage;
  }

  return getCoachingAnalysis(systemPrompt, messageToSend, {
    apiKey: options.apiKey,
    modelId: EXPERT_COACHING_MODEL,
    maxTokens: 4096,
    signal: options.signal,
    conversationHistory: history,
    onChunk: options.onChunk,
    onDone: options.onDone,
    onError: options.onError,
  });
}
