// ── App branding ──────────────────────────────────────────────────────────────
// These constants are configurable via environment variables.
// See .env.example for all required variables.
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Apex Lab';
export const APP_LOGO = import.meta.env.VITE_APP_LOGO || '/apex-lab/icons/icon-192.png';

export const config = {
  appName: import.meta.env.VITE_APP_NAME || 'Apex Lab',
  carName: '',  // set via user profile on first launch
  carLogoUrl: null as string | null,
  stripeColors: ['#16588E', '#E7222E', '#81C4FF'] as string[],
  defaultPrimaryColor: '#16588E',
  defaultAccentColor: '#A855F7',
  // Google Drive folder ID for session data storage
  // Create your own folder and set this in .env
  googleDriveFolderId: import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '',
  coachingWorkerUrl: (import.meta.env.VITE_COACHING_WORKER_URL !== 'undefined' && import.meta.env.VITE_COACHING_WORKER_URL) || '',
  // ↑ Vercel (or other) proxy that forwards to Anthropic with the server-side key.
  //   Set VITE_COACHING_WORKER_URL=https://<your-app>.vercel.app in .env
  //   Leave empty if users supply their own Anthropic key via Settings.
  ownerEmail: import.meta.env.VITE_OWNER_EMAIL || '',
};
