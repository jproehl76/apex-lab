import { dbGet, dbSet } from '@/lib/db';
import type { ConversationMessage } from '@/lib/services/coachingApi';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CoachingProfile {
  driverName: string;
  carYear?: number;
  carMake?: string;
  carModel?: string;
  carMods?: string;
  experienceLevel?: string;
  goals?: string;
  onboardingComplete: boolean;
  updatedAt: string;
}

export interface SessionManifestEntry {
  fileId?: string;            // Drive file ID (undefined for local-only)
  filename: string;
  track: string;
  date: string;               // ISO date
  bestLapS: number;
  lapCount: number;
  stdDevS: number;
  source: 'drive' | 'local';
}

export interface SessionManifest {
  entries: SessionManifestEntry[];
  scannedAt: string;           // ISO timestamp of last Drive scan
}

export interface CoachingConversation {
  track: string;               // track key or '__general__'
  messages: ConversationMessage[];
  lastSummary?: string;        // condensed summary if conversation is long
  createdAt: string;
  updatedAt: string;
}

// ── IDB keys ───────────────────────────────────────────────────────────────────

const KEY_PROFILE     = 'coaching:profile';
const KEY_MANIFEST    = 'coaching:manifest';
const KEY_LAST_REC    = 'coaching:last-rec';
const convKey = (track: string) => `coaching:conv:${track.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

// ── Profile ────────────────────────────────────────────────────────────────────

export async function readCoachingProfile(): Promise<CoachingProfile | undefined> {
  return dbGet<CoachingProfile>(KEY_PROFILE);
}

export async function writeCoachingProfile(profile: CoachingProfile): Promise<void> {
  return dbSet(KEY_PROFILE, profile);
}

// ── Session Manifest ───────────────────────────────────────────────────────────

export async function readSessionManifest(): Promise<SessionManifest | undefined> {
  return dbGet<SessionManifest>(KEY_MANIFEST);
}

export async function writeSessionManifest(manifest: SessionManifest): Promise<void> {
  return dbSet(KEY_MANIFEST, manifest);
}

// ── Conversations ──────────────────────────────────────────────────────────────

export async function readConversation(track: string): Promise<CoachingConversation | undefined> {
  return dbGet<CoachingConversation>(convKey(track));
}

export async function writeConversation(conv: CoachingConversation): Promise<void> {
  return dbSet(convKey(conv.track), conv);
}

// ── Last Recommendation ────────────────────────────────────────────────────────

export async function readLastRecommendation(): Promise<string | undefined> {
  return dbGet<string>(KEY_LAST_REC);
}

export async function writeLastRecommendation(rec: string): Promise<void> {
  return dbSet(KEY_LAST_REC, rec);
}
