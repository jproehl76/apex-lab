// ── App branding ──────────────────────────────────────────────────────────────
// These constants identify this app. Keep APP_NAME consistent with the
// deployed URL and public/manifest.json.
export const APP_NAME = 'Apex Lab';
export const APP_LOGO = '/apex-lab/icons/icon-192.png';

export const config = {
  appName: 'Apex Lab',
  carName: '2021 Toyota GR A91 Supra',  // default; overridden by user profile
  carLogoUrl: null as string | null,
  stripeColors: ['#16588E', '#E7222E', '#81C4FF'] as string[],
  defaultPrimaryColor: '#16588E',
  defaultAccentColor: '#A855F7',
  googleDriveFolderId: '1fZOPXu1kO3UsnRE0MB_cba9OPaFVKVBx',
  healthProvider: 'whoop' as 'whoop' | 'strava' | 'oura' | null,
  whoopWorkerUrl: '',
  stravaWorkerUrl: '',   // set if healthProvider === 'strava'
  // Oura uses VITE_OURA_PERSONAL_TOKEN from .env — no workerUrl needed
  coachingWorkerUrl: import.meta.env.VITE_COACHING_WORKER_URL ?? '',
  // ↑ Vercel (or other) proxy that forwards to Anthropic with the server-side key.
  //   Set VITE_COACHING_WORKER_URL=https://<your-app>.vercel.app in .env
  //   Leave empty if users supply their own Anthropic key via Settings.
  ownerEmail: 'jonathan.proehl@gmail.com',
};
