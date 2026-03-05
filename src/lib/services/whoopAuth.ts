const WHOOP_CLIENT_ID = import.meta.env.VITE_WHOOP_CLIENT_ID as string;
const WHOOP_CLIENT_SECRET = import.meta.env.VITE_WHOOP_CLIENT_SECRET as string;
const REDIRECT_URI = window.location.origin + import.meta.env.BASE_URL;
const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN_URL = 'https://frosty-bar-6808.jonathan-proehl.workers.dev';
const SCOPES = 'read:recovery read:cycles read:sleep read:profile offline';
const STORAGE_KEY = 'whoop-tokens';
const STATE_KEY = 'whoop-oauth-state';

interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Date.now() + expires_in * 1000
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function generateState(): string {
  return Math.random().toString(36).substring(2, 10);
}

function loadTokens(): WhoopTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WhoopTokens) : null;
  } catch {
    return null;
  }
}

function saveTokens(tokens: WhoopTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function initiateWhoopAuth(): void {
  const state = generateState();
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: WHOOP_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  });

  window.location.href = `${AUTH_URL}?${params.toString()}`;
}

export async function handleWhoopCallback(code: string, state: string): Promise<boolean> {
  const savedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (!savedState || savedState !== state) {
    console.error('WHOOP OAuth state mismatch');
    return false;
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: WHOOP_CLIENT_ID,
    client_secret: WHOOP_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  });

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error('WHOOP token exchange failed:', response.status, response.statusText);
      return false;
    }

    const data = (await response.json()) as TokenResponse;
    saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });
    return true;
  } catch (err) {
    console.error('Token exchange failed — CORS issue, contact developer', err);
    return false;
  }
}

export async function refreshWhoopToken(): Promise<boolean> {
  const tokens = loadTokens();
  if (!tokens?.refresh_token) return false;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: WHOOP_CLIENT_ID,
    client_secret: WHOOP_CLIENT_SECRET,
    scope: SCOPES,
  });

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error('WHOOP token refresh failed:', response.status, response.statusText);
      return false;
    }

    const data = (await response.json()) as TokenResponse;
    saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });
    return true;
  } catch (err) {
    console.error('Token refresh failed — CORS issue, contact developer', err);
    return false;
  }
}

export async function getWhoopToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;

  // Token is still valid (with 60s buffer)
  if (Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  // Try to refresh
  const refreshed = await refreshWhoopToken();
  if (!refreshed) return null;

  const updated = loadTokens();
  return updated?.access_token ?? null;
}

export function isWhoopConnected(): boolean {
  return loadTokens() !== null;
}

export function disconnectWhoop(): void {
  localStorage.removeItem(STORAGE_KEY);
}
