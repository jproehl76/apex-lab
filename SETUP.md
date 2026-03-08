# Dashboard Setup Guide

This dashboard is designed to be forked and personalized. You edit one config file, swap
two images, fill in a `.env`, and deploy to GitHub Pages. Future updates from the upstream
repo can be pulled in with a single git command.

---

## 1. Fork the repo

Click **Fork** on GitHub to create your own copy. Clone it locally:

```bash
git clone https://github.com/YOUR_USERNAME/apex-lab.git
cd apex-lab
```

---

## 2. Edit `src/config.ts`

This is the **only file you need to touch** for personal branding:

```ts
export const config = {
  ownerName: 'Your Name',
  ownerEmail: 'you@gmail.com',        // only this Google account can log in
  carName: '2020 Toyota GR Supra',
  carLogoUrl: null,                   // URL string, or null to use src/assets/car-logo.jpg
  stripeColors: ['#FF0000', '#FFFFFF', '#000000'], // header accent stripes (any length)
  defaultPrimaryColor: '#FF0000',     // fallback when no track is loaded
  defaultAccentColor: '#FFFFFF',
  googleDriveFolderId: 'YOUR_FOLDER_ID',  // from the Drive folder URL
  healthProvider: null,               // 'whoop' | 'oura' | 'strava' | null
  whoopWorkerUrl: '',                 // only needed if healthProvider === 'whoop'
  stravaWorkerUrl: '',                // only needed if healthProvider === 'strava'
};
```

**Finding your Drive folder ID:** open the folder in Google Drive, copy the long string
from the URL: `https://drive.google.com/drive/folders/THIS_PART_IS_THE_ID`

---

## 3. Swap the image files

Replace these two files in `src/assets/` with your own images:

| File | Purpose |
|------|---------|
| `car-logo.jpg` | Car logo shown on the login screen (square, transparent bg preferred) |
| `track-background.jpg` | Full-bleed background image on the login screen |

Alternatively, set `carLogoUrl` in `config.ts` to a remote URL and skip swapping `car-logo.jpg`.

---

## 4. Set up `.env`

Copy the example file and fill it in:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

If you use WHOOP, also set:
```
VITE_WHOOP_CLIENT_ID=your-whoop-client-id
VITE_WHOOP_CLIENT_SECRET=your-whoop-client-secret
```

If you use Oura, also set:
```
VITE_OURA_PERSONAL_TOKEN=your-oura-personal-access-token
```

If you use Strava, also set:
```
VITE_STRAVA_CLIENT_ID=your-strava-client-id
VITE_STRAVA_CLIENT_SECRET=your-strava-client-secret
```

---

## 5. Google Cloud Console setup

You need a Google OAuth 2.0 client ID to enable login + Drive file picker.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or select an existing one).
2. In the left menu: **APIs & Services → Library** → search for **Google Drive API** → Enable it.
3. Go to **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - Fill in app name, support email, developer email
   - Add scope: `https://www.googleapis.com/auth/drive.readonly`
   - Add your Google account as a test user
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins — add both:
     - `http://localhost:5173` (for local dev)
     - `https://YOUR_USERNAME.github.io` (for GitHub Pages)
   - No redirect URIs needed (this app uses implicit flow)
5. Copy the **Client ID** and paste it into your `.env` as `VITE_GOOGLE_CLIENT_ID`.

---

## 6. Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## 7. Deploy to GitHub Pages

### Automatic (GitHub Actions)

The repo includes a workflow at `.github/workflows/deploy.yml`. Push to `main` and it
deploys automatically.

Make sure your repo has Pages enabled: **Settings → Pages → Source: GitHub Actions**.

Add your secret: **Settings → Secrets → Actions → New repository secret**:
- Name: `VITE_GOOGLE_CLIENT_ID`
- Value: your client ID

### Manual

```bash
pnpm deploy
```

This builds and pushes the `dist/` folder to the `gh-pages` branch.

---

## 8. Pulling future updates from upstream

Add the original repo as a remote once:

```bash
git remote add upstream https://github.com/jonathanproehl/apex-lab.git
```

To pull in new features/fixes:

```bash
git fetch upstream
git merge upstream/main
```

Resolve any conflicts (usually none — your only edits are `src/config.ts` and the two image
files). Push to your fork:

```bash
git push origin main
```

---

## 9. Health Integration (optional — choose one)

Set `healthProvider` in `config.ts` to one of `'whoop'`, `'oura'`, `'strava'`, or `null`.
Leave it `null` to hide the Driver Readiness section entirely.

### WHOOP

1. A WHOOP account and a WHOOP developer app at [developer.whoop.com](https://developer.whoop.com).
2. A Cloudflare Worker (or similar proxy) to handle the OAuth token exchange server-side
   (WHOOP's API requires a client secret which cannot be exposed in the browser).
3. Set `healthProvider: 'whoop'` and `whoopWorkerUrl: 'https://your-worker.workers.dev'` in `config.ts`.
4. Add `VITE_WHOOP_CLIENT_ID` and `VITE_WHOOP_CLIENT_SECRET` to your `.env` and GitHub secrets.

### Oura

Oura uses a Personal Access Token — no OAuth redirect or worker needed.

1. Generate a token at [cloud.ouraring.com/personal-access-tokens](https://cloud.ouraring.com/personal-access-tokens).
2. Set `healthProvider: 'oura'` in `config.ts`.
3. Add `VITE_OURA_PERSONAL_TOKEN=your-token` to your `.env` and GitHub secrets.

### Strava

1. Register an app at [strava.com/settings/api](https://www.strava.com/settings/api).
   Set the Authorization Callback Domain to your GitHub Pages domain.
2. Deploy a Cloudflare Worker to proxy the token exchange (same pattern as WHOOP worker).
3. Set `healthProvider: 'strava'` and `stravaWorkerUrl: 'https://your-worker.workers.dev'` in `config.ts`.
4. Add `VITE_STRAVA_CLIENT_ID` and `VITE_STRAVA_CLIENT_SECRET` to your `.env` and GitHub secrets.

### None

Set `healthProvider: null` and the Driver Readiness section will not appear.
