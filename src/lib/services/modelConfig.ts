/**
 * Central model registry — update ONLY this file when Anthropic releases new models.
 * The rest of the codebase imports ModelId and AVAILABLE_MODELS from here.
 */

export const AVAILABLE_MODELS = [
  {
    id:    'claude-haiku-4-5-20251001' as const,
    label: 'Haiku 4.5',
    tier:  'fast'     as const,
    hint:  'Fastest & cheapest — good for quick follow-up questions',
  },
  {
    id:    'claude-sonnet-4-6' as const,
    label: 'Sonnet 4.6',
    tier:  'balanced' as const,
    hint:  'Balanced speed & depth — recommended for session analysis',
  },
  {
    id:    'claude-opus-4-6' as const,
    label: 'Opus 4.6',
    tier:  'deep'     as const,
    hint:  'Deepest analysis — best for complex multi-session reviews',
  },
] as const;

export type ModelTier = typeof AVAILABLE_MODELS[number]['tier'];
export type ModelId   = typeof AVAILABLE_MODELS[number]['id'];

export const DEFAULT_MODEL: ModelId = 'claude-sonnet-4-6';
