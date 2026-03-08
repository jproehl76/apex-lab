// ── App branding ──────────────────────────────────────────────────────────────
// These constants identify this app. Keep APP_NAME consistent with the
// deployed URL and public/manifest.json.
export const APP_NAME = 'JP Apex Lab';
export const APP_LOGO = '/apex-lab/icons/icon-192.png';

export const config = {
  appName: 'JP Apex Lab',
  carName: '2025 BMW G80 M3 Competition xDrive',  // default; overridden by user profile
  carLogoUrl: null as string | null,
  stripeColors: ['#1C69D4', '#6B2D9E', '#EF3340'] as string[],
  defaultPrimaryColor: '#1C69D4',
  defaultAccentColor: '#A855F7',
  googleDriveFolderId: '1BrltfQ6HfS5O5Rkb0xU767zSpuCtLsGM',
  healthProvider: 'whoop' as 'whoop' | 'strava' | 'oura' | null,
  whoopWorkerUrl: 'https://frosty-bar-6808.jonathan-proehl.workers.dev',
  stravaWorkerUrl: '',   // set if healthProvider === 'strava'
  // Oura uses VITE_OURA_PERSONAL_TOKEN from .env — no workerUrl needed
  coachingWorkerUrl: import.meta.env.VITE_COACHING_WORKER_URL ?? '',
  // ↑ Vercel (or other) proxy that forwards to Anthropic with the server-side key.
  //   Set VITE_COACHING_WORKER_URL=https://<your-app>.vercel.app in .env
  //   Leave empty if users supply their own Anthropic key via Settings.
};
