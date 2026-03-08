/**
 * Vercel Edge Function — AI coaching proxy.
 *
 * Deployment:
 *   1. Set ANTHROPIC_API_KEY in Vercel project environment variables.
 *   2. Deploy to Vercel (auto-detected as a Vite project).
 *   3. Set VITE_COACHING_WORKER_URL=https://<your-vercel-app>.vercel.app in your .env
 *
 * The proxy accepts the full Anthropic messages payload from the client
 * but ignores any api-key the client sends — always uses the server key.
 * The client chooses the model; this proxy validates it against an allowlist.
 */

export const config = { runtime: 'edge' };

// ── Allowlist ─────────────────────────────────────────────────────────────────
const ALLOWED_MODELS = new Set([
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
]);

// ── Simple in-memory rate limiter (resets per Edge instance) ──────────────────
// For persistent rate limiting across instances use Vercel KV.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT   = 10;      // requests per window
const WINDOW_MS    = 3_600_000; // 1 hour

function checkRateLimit(key: string): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    model?: string;
    max_tokens?: number;
    messages?: unknown[];
    system?: string;
    stream?: boolean;
    userEmail?: string;        // optional: used for per-user rate limiting
  };

  try {
    body = await req.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS });
  }

  // ── Validate model ────────────────────────────────────────────────────────
  const model = body.model ?? '';
  if (!ALLOWED_MODELS.has(model)) {
    return new Response(
      JSON.stringify({ error: `Model '${model}' is not allowed` }),
      { status: 400, headers: CORS }
    );
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  // Use CF-Connecting-IP header or X-Forwarded-For as rate limit key
  const ip  = req.headers.get('CF-Connecting-IP')
           ?? req.headers.get('X-Forwarded-For')?.split(',')[0].trim()
           ?? 'unknown';
  const key = body.userEmail ? `user:${body.userEmail}` : `ip:${ip}`;

  if (!checkRateLimit(key)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again in an hour.' }),
      { status: 429, headers: CORS }
    );
  }

  // ── Forward to Anthropic ──────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: ANTHROPIC_API_KEY not set' }),
      { status: 500, headers: CORS }
    );
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':     'application/json',
      'x-api-key':        apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      body.model,
      max_tokens: body.max_tokens ?? 2048,
      stream:     body.stream ?? true,
      system:     body.system,
      messages:   body.messages,
    }),
  });

  // Stream the response back to the client unchanged
  return new Response(upstream.body, {
    status:  upstream.status,
    headers: {
      ...CORS,
      'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
