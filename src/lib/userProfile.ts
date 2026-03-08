import { dbGet, dbSet } from './db';
import type { ModelId } from './services/modelConfig';
import { DEFAULT_MODEL } from './services/modelConfig';

export interface UserProfile {
  email: string;
  carName: string;
  carYear?: string;
  carMake?: string;
  carModel?: string;
  carHp?: number;
  carWeight?: number;   // lbs
  carDrivetrain?: 'FWD' | 'RWD' | 'AWD' | '4WD';
  // AI coaching settings
  aiCoachingEnabled: boolean;
  anthropicApiKey?: string;   // stored in local IDB — never leaves the browser
  preferredModel: ModelId;
  updatedAt: string;
}

export const DEFAULT_PROFILE: Omit<UserProfile, 'email' | 'carName' | 'updatedAt'> = {
  aiCoachingEnabled: false,
  preferredModel: DEFAULT_MODEL,
};

const profileKey = (email: string) => `apex-lab-profile-v1:${email}`;

export async function readProfile(email: string): Promise<UserProfile | null> {
  return (await dbGet<UserProfile>(profileKey(email))) ?? null;
}

export async function writeProfile(profile: UserProfile): Promise<void> {
  await dbSet(profileKey(profile.email), { ...profile, updatedAt: new Date().toISOString() });
}

/** Decode a 17-char VIN via the NHTSA API (free, no key required). */
export async function lookupVin(
  vin: string
): Promise<{ year: string; make: string; model: string } | null> {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`
    );
    if (!res.ok) return null;
    const data = await res.json() as { Results: Array<{ Variable: string; Value: string | null }> };
    const get = (v: string) => data.Results.find(r => r.Variable === v)?.Value ?? '';
    return { year: get('Model Year'), make: get('Make'), model: get('Model') };
  } catch { return null; }
}
