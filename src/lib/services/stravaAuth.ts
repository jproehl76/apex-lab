import { config } from '@/config';

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID as string;
const REDIRECT_URI = window.location.origin + import.meta.env.BASE_URL;
const AUTH_URL = 'https://www.strava.com/oauth/authorize';
const SCOPES = 'activity:read_all';
const STORAGE_KEY = 'strava-tokens';
const STATE_KEY = 'strava-oauth-state';

interface StravaTokens {
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
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
}

function loadTokens(): StravaTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StravaTokens) : null;
  } catch {
    return null;
  }
}

function saveTokens(tokens: StravaTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function initiateStravaAuth(): void {
  const state = generateState();
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    approval_prompt: 'auto',
  });

  window.location.href = `${AUTH_URL}?${params.toString()}`;
}

export async function handleStravaCallback(code: string, state: string): Promise<boolean> {
  const savedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (!savedState || savedState !== state) {
    console.error('Strava OAuth state mismatch');
    return false;
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
  });

  try {
    const response = await fetch(config.stravaWorkerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error('Strava token exchange failed:', response.status, response.statusText);
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
    console.error('Strava token exchange failed — CORS issue, contact developer', err);
    return false;
  }
}

export async function refreshStravaToken(): Promise<boolean> {
  const tokens = loadTokens();
  if (!tokens?.refresh_token) return false;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: STRAVA_CLIENT_ID,
  });

  try {
    const response = await fetch(config.stravaWorkerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      console.error('Strava token refresh failed:', response.status, response.statusText);
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
    console.error('Strava token refresh failed — CORS issue, contact developer', err);
    return false;
  }
}

export async function getStravaToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;

  // Token is still valid (with 60s buffer)
  if (Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  // Try to refresh
  const refreshed = await refreshStravaToken();
  if (!refreshed) return null;

  const updated = loadTokens();
  return updated?.access_token ?? null;
}

export function isStravaConnected(): boolean {
  return loadTokens() !== null;
}

export function disconnectStrava(): void {
  localStorage.removeItem(STORAGE_KEY);
}
