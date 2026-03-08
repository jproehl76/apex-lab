import { openDB } from './memory';

export interface UserProfile {
  email: string;
  carName: string;
  carYear?: string;
  carMake?: string;
  carModel?: string;
  carHp?: number;
  carWeight?: number;   // lbs
  carDrivetrain?: 'FWD' | 'RWD' | 'AWD' | '4WD';
  updatedAt: string;
}

const STORE_NAME = 'memory';
const profileKey = (email: string) => `apex-lab-profile-v1:${email}`;

export async function readProfile(email: string): Promise<UserProfile | null> {
  try {
    const db = await openDB();
    return new Promise(resolve => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(profileKey(email));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

export async function writeProfile(profile: UserProfile): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(profile, profileKey(profile.email));
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch { /* silent */ }
}

/** Decode a 17-char VIN using the NHTSA API (free, no key required). */
export async function lookupVin(vin: string): Promise<{ year: string; make: string; model: string } | null> {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const get = (variable: string): string =>
      (data.Results as Array<{ Variable: string; Value: string | null }>)
        .find(r => r.Variable === variable)?.Value ?? '';
    return { year: get('Model Year'), make: get('Make'), model: get('Model') };
  } catch { return null; }
}
