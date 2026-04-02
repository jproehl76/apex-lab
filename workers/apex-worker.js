/**
 * JP Apex Lab — Cloudflare Worker
 *
 * Routes:
 *   POST /whoop/token          — WHOOP OAuth code → token exchange
 *   POST /whoop/refresh        — WHOOP token refresh
 *   GET  /whoop/data?days=N    — Return WHOOP data (used by GitHub Actions health-cache)
 *   GET  /strava/webhook       — Strava hub.challenge verification
 *   POST /strava/webhook       — Receive Strava activity, store in KV, send push
 *   GET  /strava/activities    — Return KV-cached Strava activities
 *   POST /push/subscribe       — Store PushSubscription in KV
 *   DELETE /push/subscribe     — Remove PushSubscription from KV
 *
 * KV namespace binding: APEX_KV
 * Required env vars:
 *   WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET
 *   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_VERIFY_TOKEN
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (base64url P-256)
 *   ALLOWED_ORIGIN (e.g. https://yourusername.github.io)
 */

const CORS_HEADERS = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

function cors(req, env) {
  const allowed = env.ALLOWED_ORIGIN || '*';
  if (allowed === '*') return CORS_HEADERS('*');
  const origin = req.headers.get('Origin') || '';
  if (origin !== allowed) return null; // origin mismatch — block
  return CORS_HEADERS(origin);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// ── WHOOP OAuth ───────────────────────────────────────────────────────────────

async function whoopToken(req, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const { code, redirect_uri } = body;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri,
    client_id: env.WHOOP_CLIENT_ID,
    client_secret: env.WHOOP_CLIENT_SECRET,
  });
  const res = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (res.ok) {
    await env.APEX_KV.put('whoop:tokens', JSON.stringify(data));
  }
  return json(data, res.status);
}

async function whoopRefresh(req, env) {
  let body;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const { refresh_token } = body;
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token,
    client_id: env.WHOOP_CLIENT_ID,
    client_secret: env.WHOOP_CLIENT_SECRET,
  });
  const res = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (res.ok) {
    await env.APEX_KV.put('whoop:tokens', JSON.stringify(data));
  }
  return json(data, res.status);
}

async function whoopData(req, env) {
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') || '30', 10);

  const tokensRaw = await env.APEX_KV.get('whoop:tokens');
  if (!tokensRaw) return json({ error: 'not_connected' }, 401);
  const tokens = JSON.parse(tokensRaw);

  // Fetch recovery cycles
  const startDate = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];
  const apiRes = await fetch(
    `https://api.prod.whoop.com/developer/v1/cycle?start=${startDate}T00:00:00.000Z&limit=25`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  if (apiRes.status === 401) {
    // Mutex: skip refresh if another request refreshed within the last 30 seconds
    const lockRaw = await env.APEX_KV.get('whoop:refresh_lock');
    if (lockRaw) {
      const lockedAt = parseInt(lockRaw, 10);
      if (Date.now() - lockedAt < 30_000) {
        return json({ error: 'token_refresh_in_progress' }, 202);
      }
    }
    await env.APEX_KV.put('whoop:refresh_lock', String(Date.now()), { expirationTtl: 60 });

    // Try refresh
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: env.WHOOP_CLIENT_ID,
      client_secret: env.WHOOP_CLIENT_SECRET,
    });
    const refreshRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    if (!refreshRes.ok) return json({ error: 'refresh_failed' }, 401);
    const newTokens = await refreshRes.json();
    await env.APEX_KV.put('whoop:tokens', JSON.stringify(newTokens));
    await env.APEX_KV.delete('whoop:refresh_lock');
    return json({ error: 'token_refreshed_retry' }, 202);
  }

  if (!apiRes.ok) return json({ error: 'whoop_api_error' }, 502);
  const data = await apiRes.json();
  return json(data);
}

// ── Strava webhook ─────────────────────────────────────────────────────────────

async function stravaWebhookVerify(req, env) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === env.STRAVA_VERIFY_TOKEN) {
    return json({ 'hub.challenge': challenge });
  }
  return new Response('Forbidden', { status: 403 });
}

async function stravaWebhookReceive(req, env) {
  let event;
  try { event = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  if (event.object_type === 'activity' && event.aspect_type === 'create') {
    const existing = await env.APEX_KV.get('strava:activities');
    const activities = existing ? JSON.parse(existing) : [];
    activities.unshift(event);
    if (activities.length > 100) activities.splice(100);
    await env.APEX_KV.put('strava:activities', JSON.stringify(activities));
    await sendPush(env, 'New Strava Activity', `Activity ${event.object_id} recorded`);
  }

  return new Response('OK', { status: 200 });
}

async function stravaActivities(env) {
  const data = await env.APEX_KV.get('strava:activities');
  return json(data ? JSON.parse(data) : []);
}

// ── Web Push ───────────────────────────────────────────────────────────────────

async function endpointKey(endpoint) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `push:${hex.slice(0, 32)}`;
}

async function pushSubscribe(req, env) {
  let sub;
  try { sub = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const endpoint = sub.endpoint;
  if (!endpoint) return json({ error: 'invalid_subscription' }, 400);
  const key = await endpointKey(endpoint);
  await env.APEX_KV.put(key, JSON.stringify(sub), { expirationTtl: 86_400 * 365 });
  return json({ ok: true });
}

async function pushUnsubscribe(req, env) {
  let sub;
  try { sub = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const endpoint = sub.endpoint;
  if (!endpoint) return json({ error: 'invalid_subscription' }, 400);
  const key = await endpointKey(endpoint);
  await env.APEX_KV.delete(key);
  return json({ ok: true });
}

async function sendPush(env, title, body) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;

  // List all push subscription keys
  const list = await env.APEX_KV.list({ prefix: 'push:' });
  const payload = JSON.stringify({ title, body });

  for (const key of list.keys) {
    const subRaw = await env.APEX_KV.get(key.name);
    if (!subRaw) continue;
    const sub = JSON.parse(subRaw);

    try {
      await sendWebPush(env, sub, payload);
    } catch (err) {
      // Subscription expired — clean up
      if (err.message?.includes('410') || err.message?.includes('404')) {
        await env.APEX_KV.delete(key.name);
      }
    }
  }
}

async function sendWebPush(env, subscription, payload) {
  // Build minimal VAPID JWT
  const endpoint = new URL(subscription.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = { alg: 'ES256', typ: 'JWT' };
  const claims = { aud: audience, exp: expiry, sub: 'mailto:push@apex-lab.dev' };

  function b64url(obj) {
    return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  const signingInput = `${b64url(header)}.${b64url(claims)}`;

  // Import private key
  let b64 = env.VAPID_PRIVATE_KEY.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const privateKeyBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', privateKeyBytes.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Type': 'application/json',
      'TTL': '86400',
    },
    body: payload,
  });

  if (!res.ok && res.status !== 201) {
    throw new Error(`Push failed: ${res.status}`);
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const corsH = cors(req, env);

    if (!corsH) {
      return new Response('Forbidden', { status: 403 });
    }

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsH });
    }

    let res;
    try {
      if (path === '/whoop/token' && method === 'POST')         res = await whoopToken(req, env);
      else if (path === '/whoop/refresh' && method === 'POST')  res = await whoopRefresh(req, env);
      else if (path === '/whoop/data' && method === 'GET')      res = await whoopData(req, env);
      else if (path === '/strava/webhook' && method === 'GET')  res = await stravaWebhookVerify(req, env);
      else if (path === '/strava/webhook' && method === 'POST') res = await stravaWebhookReceive(req, env);
      else if (path === '/strava/activities' && method === 'GET') res = await stravaActivities(env);
      else if (path === '/push/subscribe' && method === 'POST') res = await pushSubscribe(req, env);
      else if (path === '/push/subscribe' && method === 'DELETE') res = await pushUnsubscribe(req, env);
      else res = json({ error: 'not_found' }, 404);
    } catch (err) {
      console.error('[apex-worker] Internal error:', err);
      res = json({ error: 'internal_error' }, 500);
    }

    // Attach CORS headers to response
    const newHeaders = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsH)) newHeaders.set(k, v);
    return new Response(res.body, { status: res.status, headers: newHeaders });
  },
};
