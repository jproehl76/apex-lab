import type { ModelId } from './modelConfig';
import { buildSystemPrompt, formatSessionForPrompt } from './coachingPrompt';
import type { LoadedSession } from '@/types/session';
import type { UserProfile } from '@/lib/userProfile';
import { KPH_TO_MPH, M_TO_FEET, formatLapTime } from '@/lib/utils';
import { config } from '@/config';

export type ConversationMessage = { role: 'user' | 'assistant'; content: string };

export interface CoachingOptions {
  apiKey?: string;            // user's own Anthropic key (browser → Anthropic direct)
  modelId: ModelId;
  signal?: AbortSignal;
  conversationHistory: ConversationMessage[];
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

// ── Session → readable summary ─────────────────────────────────────────────

export function buildSessionSummary(
  session: LoadedSession,
  userProfile: UserProfile | null,
  trackHistory: Array<{ date: string; bestLap: string; lapCount: number }>
): { systemPrompt: string; userMessage: string } {
  const { header, consistency, best_lap_corners, thermals, friction_circle } = session.data;

  const carName = userProfile?.carName ?? config.carName;

  const systemPrompt = buildSystemPrompt({
    carName,
    trackName: header.track,
    trackHistory,
    modelId: userProfile?.preferredModel ?? 'claude-sonnet-4-6',
  });

  const cornerDetails = best_lap_corners.map(c => {
    const cc = consistency.corners[c.corner_id] ?? consistency.corners[c.corner_name] ?? null;
    return {
      name:          c.corner_name,
      apexBestMph:   c.min_speed_kph * KPH_TO_MPH,
      apexAvgMph:    cc ? cc.min_speed_avg * KPH_TO_MPH : c.min_speed_kph * KPH_TO_MPH,
      gapMph:        cc ? cc.min_speed_delta * KPH_TO_MPH : 0,
      brakeStdFt:    cc ? cc.brake_point_std_m * M_TO_FEET : 0,
      coastAvgS:     cc ? cc.coast_time_avg : c.coast_time_s,
      trailBrakeS:   c.trail_brake_duration_s > 0 ? c.trail_brake_duration_s : undefined,
    };
  });

  const thermalData = thermals.map(t => ({
    channel:    t.channel,
    peakVal:    t.peak_val,
    unit:       t.unit,
    alertLevel: t.alert_level,
  }));

  const userMessage = formatSessionForPrompt({
    track:             header.track,
    date:              header.date,
    bestLap:           formatLapTime(consistency.best_lap_s),
    lapCount:          consistency.lap_count,
    spread:            consistency.spread_s,
    stdDev:            consistency.std_dev_s,
    consistencyScore:  consistency.consistency_score,
    cornerDetails,
    thermals:          thermalData,
    peakLatG:          friction_circle.peak_lat_g,
    peakBrakeG:        friction_circle.peak_long_g_brake,
    timeAbove08G:      friction_circle.time_above_08g_pct,
  });

  return { systemPrompt, userMessage };
}

// ── SSE stream parser ──────────────────────────────────────────────────────

async function consumeAnthropicStream(
  response: Response,
  { onChunk, onDone, onError, signal }: Pick<CoachingOptions, 'onChunk' | 'onDone' | 'onError' | 'signal'>
): Promise<void> {
  if (!response.body) { onError(new Error('Empty response body')); return; }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  try {
    while (true) {
      if (signal?.aborted) { reader.cancel(); break; }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') { onDone(); return; }
        try {
          const parsed = JSON.parse(raw) as {
            type: string;
            delta?: { type: string; text?: string };
            error?: { message: string };
          };
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            onChunk(parsed.delta.text ?? '');
          } else if (parsed.type === 'error') {
            onError(new Error(parsed.error?.message ?? 'Anthropic stream error'));
            return;
          } else if (parsed.type === 'message_stop') {
            onDone();
            return;
          }
        } catch { /* skip malformed SSE lines */ }
      }
    }
    onDone();
  } catch (err) {
    if (signal?.aborted) return; // normal cancellation
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

// ── Main API function ──────────────────────────────────────────────────────

export async function getCoachingAnalysis(
  systemPrompt: string,
  userMessage: string,
  options: CoachingOptions
): Promise<void> {
  const { apiKey, modelId, signal, conversationHistory, onChunk, onDone, onError } = options;

  const messages: ConversationMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const body = JSON.stringify({
    model:      modelId,
    max_tokens: 2048,
    stream:     true,
    system:     systemPrompt,
    messages,
  });

  try {
    let response: Response;

    if (apiKey) {
      // Direct browser → Anthropic (requires user's own key)
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: {
          'Content-Type':                           'application/json',
          'x-api-key':                              apiKey,
          'anthropic-version':                      '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body,
      });
    } else {
      // Via server proxy (Vercel function or Cloudflare Worker)
      const proxyUrl = config.coachingWorkerUrl;
      if (!proxyUrl) {
        onError(new Error('No API key or proxy URL configured. Add your Anthropic API key in Settings.'));
        return;
      }
      response = await fetch(`${proxyUrl}/coaching`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      onError(new Error(`API error ${response.status}: ${text}`));
      return;
    }

    await consumeAnthropicStream(response, { onChunk, onDone, onError, signal });
  } catch (err) {
    if (signal?.aborted) return;
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
