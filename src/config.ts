// ── App branding ──────────────────────────────────────────────────────────────
// These constants identify this app. Keep APP_NAME consistent with the
// deployed URL and public/manifest.json.
export const APP_NAME = 'JP Apex Lab';
export const APP_LOGO = '/apex-lab/icons/icon-192.png';

export const config = {
  appName: 'JP Apex Lab',
  carName: '',  // set via user profile on first launch
  carLogoUrl: null as string | null,
  stripeColors: ['#16588E', '#E7222E', '#81C4FF'] as string[],
  defaultPrimaryColor: '#16588E',
  defaultAccentColor: '#A855F7',
  googleDriveFolderId: '1BrltfQ6HfS5O5Rkb0xU767zSpuCtLsGM',
  coachingWorkerUrl: (import.meta.env.VITE_COACHING_WORKER_URL !== 'undefined' && import.meta.env.VITE_COACHING_WORKER_URL) || '',
  // ↑ Vercel (or other) proxy that forwards to Anthropic with the server-side key.
  //   Set VITE_COACHING_WORKER_URL=https://<your-app>.vercel.app in .env
  //   Leave empty if users supply their own Anthropic key via Settings.
  ownerEmail: 'jonathan.proehl@gmail.com',
};
