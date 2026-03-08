# JP Apex Lab — Setup Guide

A free, self-hosted HPDE telemetry + coaching PWA.
Fork it, configure it, deploy it — your data stays in your browser.

---

## What you unlock at each tier

| Tier | Features | Time |
|------|----------|------|
| **1 — Core** | Upload RaceChrono CSV → full telemetry dashboard, lap times, sector splits, G-force, coaching insights, Google Sign-In, Google Drive auto-import | ~20 min |
| **2 — Health** | WHOOP, Oura Ring, or Strava readiness data correlated with your sessions | ~20 min |
| **3 — AI Coaching** | Claude AI analyses your laps, answers follow-up questions, compares sessions | ~10 min |
| **4 — Push Notifications** | Browser push when a new Strava activity completes | ~15 min |

Everything runs on **GitHub Pages** (free) + **Cloudflare Workers** free tier + **Vercel** free tier.
No database. No monthly bills.

---

## Prerequisites

```bash
# Node.js 22+  →  https://nodejs.org  (check: node --version)

# pnpm
npm install -g pnpm

# GitHub CLI (manages secrets from the terminal)
# macOS:   brew install gh
# Windows: winget install GitHub.cli
# Other:   https://cli.github.com
gh auth login
```

---

## Tier 1 — Core (Required)

### 1-A  Fork and clone

1. Open **https://github.com/jproehl76/apex-lab**
2. Click **Fork** → keep the default name `apex-lab`
3. Clone locally and install:

```bash
git clone https://github.com/YOUR-USERNAME/apex-lab.git
cd apex-lab
pnpm install
```

---

### 1-B  Enable GitHub Pages

1. Your forked repo → **Settings → Pages**
2. Source: **GitHub Actions**
3. Click **Save**

> The deploy workflow at `.github/workflows/deploy.yml` triggers automatically on every push to `main`.

---

### 1-C  Create a Google OAuth client

The app uses Google Sign-In. You need your own OAuth client.

1. Go to **https://console.cloud.google.com**
2. Create a new project — name it `apex-lab`
3. **APIs & Services → Library** → enable **Google Drive API**
4. **APIs & Services → Library** → enable **Google Picker API**
5. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: your choice (e.g. `My Apex Lab`)
   - Support email + developer email: your Gmail
   - Scopes: `openid`, `email`, `profile`, `drive.readonly`
   - Add yourself as a test user → Save
6. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins:
     ```
     https://YOUR-USERNAME.github.io
     http://localhost:5173
     ```
   - Authorized redirect URIs:
     ```
     https://YOUR-USERNAME.github.io/apex-lab/
     http://localhost:5173/
     ```
   - Create → copy the **Client ID** (ends in `.apps.googleusercontent.com`)

---

### 1-D  Create your Google Drive folder

1. Go to **https://drive.google.com**
2. Create a folder — name it `RaceChrono` (or anything you like)
3. Open the folder; the URL looks like:
   `https://drive.google.com/drive/folders/1ABC...XYZ`
4. Copy the ID — the part after `/folders/`

---

### 1-E  Edit `src/config.ts`

This is the **only source file** you need to touch. Open it and update:

```ts
// ── Branding ──────────────────────────────────────────────────────────────
export const APP_NAME = 'My Apex Lab';           // shown in browser tab & login screen

export const config = {
  appName: 'My Apex Lab',
  carName: '2024 Porsche 911 GT3',               // default display name; users override in Settings

  // Accent colours for the header — use your car's brand colours
  stripeColors: ['#E30613', '#FFFFFF', '#000000'],
  defaultPrimaryColor: '#E30613',
  defaultAccentColor: '#FFFFFF',

  // ── Google Drive ─────────────────────────────────────────────────────────
  googleDriveFolderId: 'PASTE-YOUR-FOLDER-ID-HERE',   // ← from step 1-D

  // ── Health (set in Tier 2; leave null for now) ────────────────────────────
  healthProvider: null,          // 'whoop' | 'oura' | 'strava' | null
  whoopWorkerUrl: '',
  stravaWorkerUrl: '',

  // ── AI coaching proxy (set in Tier 3; leave empty for now) ────────────────
  coachingWorkerUrl: import.meta.env.VITE_COACHING_WORKER_URL ?? '',
};
```

---

### 1-F  Run the automated setup script

This script prompts you for each value, adds GitHub Actions secrets, and creates your local `.env`:

```bash
node scripts/setup.mjs
```

> If you prefer to do it manually, see the **Manual secrets** section at the bottom.

When prompted, enter:
- Your GitHub username
- Your `VITE_GOOGLE_CLIENT_ID` from step 1-C

---

### 1-G  Commit and push

```bash
git add src/config.ts
git commit -m "config: personal setup"
git push
```

Watch the deployment: **https://github.com/YOUR-USERNAME/apex-lab/actions**

**Your app is live at: `https://YOUR-USERNAME.github.io/apex-lab/`** ✓

---

## Tier 2 — Health Data (Optional — choose one)

---

### Option A — Oura Ring (simplest, no Cloudflare needed)

1. Generate a token at **https://cloud.ouraring.com/personal-access-tokens**
2. Copy the token

```bash
gh secret set VITE_OURA_PERSONAL_TOKEN --body "YOUR-TOKEN" --repo YOUR-USERNAME/apex-lab
gh secret set OURA_TOKEN               --body "YOUR-TOKEN" --repo YOUR-USERNAME/apex-lab
```

3. In `src/config.ts`:
   ```ts
   healthProvider: 'oura',
   ```

4. Push to redeploy:
   ```bash
   git add src/config.ts && git commit -m "config: enable Oura" && git push
   ```

5. Enable nightly sync → **Step 2-D** below.

---

### Option B — WHOOP (requires Cloudflare Worker)

#### B-1. Create a WHOOP developer app

1. **https://developer.whoop.com** → Create App
2. Redirect URI: `https://YOUR-USERNAME.github.io/apex-lab/`
3. Copy **Client ID** and **Client Secret**

#### B-2. Deploy the Cloudflare Worker

1. Sign up free at **https://cloudflare.com**
2. **Workers & Pages → Create → Hello World** → name it `apex-worker` → Deploy
3. **Edit code** → select all → paste the contents of `workers/apex-worker.js` → **Save and Deploy**

#### B-3. Create a KV namespace

1. **Workers & Pages → KV → Create namespace**
2. Name: `apex-kv` → Create

#### B-4. Bind KV to the worker

**apex-worker → Settings → Variables → KV Namespace Bindings → Add**

| Variable name | KV namespace |
|---|---|
| `APEX_KV` | `apex-kv` |

Save.

#### B-5. Set worker environment variables

**apex-worker → Settings → Variables → Environment Variables → Add variable**

| Variable | Value |
|---|---|
| `WHOOP_CLIENT_ID` | From B-1 |
| `WHOOP_CLIENT_SECRET` | From B-1 |
| `ALLOWED_ORIGIN` | `https://YOUR-USERNAME.github.io` |

Save and redeploy.

#### B-6. Get your worker URL

It appears in the Cloudflare dashboard: `https://apex-worker.YOUR-SUBDOMAIN.workers.dev`

#### B-7. Wire into config and secrets

```bash
gh secret set VITE_WHOOP_CLIENT_ID     --body "YOUR-CLIENT-ID"     --repo YOUR-USERNAME/apex-lab
gh secret set VITE_WHOOP_CLIENT_SECRET --body "YOUR-CLIENT-SECRET" --repo YOUR-USERNAME/apex-lab
gh secret set WHOOP_WORKER_URL --body "https://apex-worker.YOUR-SUBDOMAIN.workers.dev" --repo YOUR-USERNAME/apex-lab
```

In `src/config.ts`:
```ts
healthProvider: 'whoop',
whoopWorkerUrl: 'https://apex-worker.YOUR-SUBDOMAIN.workers.dev',
```

```bash
git add src/config.ts && git commit -m "config: enable WHOOP" && git push
```

---

### Option C — Strava (requires Cloudflare Worker)

#### C-1. Create a Strava API app

1. **https://www.strava.com/settings/api** → Create an app
2. Authorization Callback Domain: `YOUR-USERNAME.github.io`
3. Copy **Client ID** and **Client Secret**

#### C-2. Deploy Cloudflare Worker

Same as B-2 through B-4 above.

#### C-3. Set Strava worker environment variables

| Variable | Value |
|---|---|
| `STRAVA_CLIENT_ID` | From C-1 |
| `STRAVA_CLIENT_SECRET` | From C-1 |
| `STRAVA_VERIFY_TOKEN` | Any random string (e.g. `my-strava-token-9f3k`) — save it |
| `ALLOWED_ORIGIN` | `https://YOUR-USERNAME.github.io` |

#### C-4. Register the Strava webhook (one-time, run after worker is live)

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=YOUR_STRAVA_CLIENT_ID \
  -F client_secret=YOUR_STRAVA_CLIENT_SECRET \
  -F callback_url=https://apex-worker.YOUR-SUBDOMAIN.workers.dev/strava/webhook \
  -F verify_token=YOUR_STRAVA_VERIFY_TOKEN
```

Response will include `{"id": 1234}` — you can note it but don't need to store it.

#### C-5. Wire into config and secrets

```bash
gh secret set VITE_STRAVA_CLIENT_ID     --body "YOUR-ID"     --repo YOUR-USERNAME/apex-lab
gh secret set VITE_STRAVA_CLIENT_SECRET --body "YOUR-SECRET" --repo YOUR-USERNAME/apex-lab
```

In `src/config.ts`:
```ts
healthProvider: 'strava',
stravaWorkerUrl: 'https://apex-worker.YOUR-SUBDOMAIN.workers.dev',
```

```bash
git add src/config.ts && git commit -m "config: enable Strava" && git push
```

---

### 2-D  Enable the nightly health cache

This GitHub Action runs at 7am UTC every night. It fetches 90 days of health data
and commits a static JSON file — so the app never makes API calls at runtime.

Set the relevant secret (already done above for WHOOP; only needed if using Oura separately):

```bash
# Oura only:
gh secret set OURA_TOKEN --body "YOUR-TOKEN" --repo YOUR-USERNAME/apex-lab
```

Test it now:
1. **GitHub repo → Actions → Health Cache → Run workflow**
2. After ~30 seconds, a `public/data/health-cache.json` file appears in your repo

---

## Tier 3 — AI Coaching (Optional)

The coach uses Claude to analyse telemetry and answer follow-up questions.
Users can bring their own Anthropic API key — no server setup needed.

### Option A — Each user supplies their own key (simplest)

No server needed. Each user:
1. Gets an API key at **https://console.anthropic.com**
2. Opens the Settings gear in the app → AI Coaching → pastes key → Save

The key is stored in IndexedDB on their device only. Never sent anywhere except Anthropic.

---

### Option B — Shared Vercel proxy (one key, all users of your fork)

#### 3B-1. Deploy to Vercel

1. Sign up free at **https://vercel.com**
2. **Add New Project** → Import from GitHub → select `apex-lab`
3. Framework: **Vite** (auto-detected) → **Deploy**

#### 3B-2. Add the Anthropic key to Vercel

**Vercel project → Settings → Environment Variables → Add**

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from https://console.anthropic.com |

Redeploy: **Deployments → Redeploy**

#### 3B-3. Point the app at your proxy

```bash
gh secret set VITE_COACHING_WORKER_URL --body "https://YOUR-APP.vercel.app" --repo YOUR-USERNAME/apex-lab
```

```bash
git commit --allow-empty -m "chore: trigger rebuild with coaching proxy" && git push
```

---

## Tier 4 — Web Push Notifications (Optional)

Get a browser push when a Strava activity is recorded.
Requires: Cloudflare Worker from Tier 2-B or 2-C.

### 4-A  Generate VAPID keys (run once)

```bash
node scripts/gen-vapid-keys.mjs
```

Output:
```
VITE_VAPID_PUBLIC_KEY=BNxxxxxxxx...    ← add to GitHub secret
VAPID_PRIVATE_KEY=MIGxxxxxxxx...       ← add to Cloudflare Worker
```

### 4-B  Add public key to GitHub

```bash
gh secret set VITE_VAPID_PUBLIC_KEY --body "BNxxxxxxxx..." --repo YOUR-USERNAME/apex-lab
```

### 4-C  Add private key to Cloudflare

**apex-worker → Settings → Variables → Environment Variables → Add**

| Variable | Value |
|---|---|
| `VAPID_PRIVATE_KEY` | `MIGxxxxxxxx...` from step 4-A |

### 4-D  Rebuild

```bash
git commit --allow-empty -m "chore: enable push notifications" && git push
```

After the app redeploys: open it on desktop, click the **bell icon** in the header → **Enable notifications**.

---

## Local development

```bash
cp .env.example .env
# Edit .env — add VITE_GOOGLE_CLIENT_ID at minimum
pnpm dev
# → http://localhost:5173/apex-lab/
```

---

## Pulling future updates

Add the upstream once:

```bash
git remote add upstream https://github.com/jproehl76/apex-lab.git
```

Pull updates anytime:

```bash
git fetch upstream
git merge upstream/main
# Resolve any conflicts (typically only in src/config.ts)
git push
```

---

## Manual secrets reference

If you prefer not to use `node scripts/setup.mjs`, add secrets directly:

```bash
gh secret set SECRET_NAME --body "value" --repo YOUR-USERNAME/apex-lab
```

| Secret | Where | Required? |
|--------|-------|-----------|
| `VITE_GOOGLE_CLIENT_ID` | GitHub Actions | **Yes** |
| `VITE_OURA_PERSONAL_TOKEN` | GitHub Actions | Oura only |
| `VITE_WHOOP_CLIENT_ID` | GitHub Actions | WHOOP only |
| `VITE_WHOOP_CLIENT_SECRET` | GitHub Actions | WHOOP only |
| `VITE_STRAVA_CLIENT_ID` | GitHub Actions | Strava only |
| `VITE_STRAVA_CLIENT_SECRET` | GitHub Actions | Strava only |
| `VITE_VAPID_PUBLIC_KEY` | GitHub Actions | Push notifications only |
| `VITE_COACHING_WORKER_URL` | GitHub Actions | Shared AI proxy only |
| `OURA_TOKEN` | GitHub Actions | Oura health cache |
| `WHOOP_WORKER_URL` | GitHub Actions | WHOOP health cache |
| `ANTHROPIC_API_KEY` | Vercel env var | Shared AI proxy only |
| `WHOOP_CLIENT_ID` | Cloudflare Worker | WHOOP only |
| `WHOOP_CLIENT_SECRET` | Cloudflare Worker | WHOOP only |
| `STRAVA_CLIENT_ID` | Cloudflare Worker | Strava only |
| `STRAVA_CLIENT_SECRET` | Cloudflare Worker | Strava only |
| `STRAVA_VERIFY_TOKEN` | Cloudflare Worker | Strava only |
| `VAPID_PRIVATE_KEY` | Cloudflare Worker | Push notifications only |
| `ALLOWED_ORIGIN` | Cloudflare Worker | Any Cloudflare usage |

---

## Troubleshooting

**Blank page / 404**
Check **Actions** tab — did the build succeed?
Check **Settings → Pages** → source must be **GitHub Actions**.
The URL must include the path: `https://YOUR-USERNAME.github.io/apex-lab/`

**Google login fails**
Verify `https://YOUR-USERNAME.github.io` is in the authorized origins in Google Cloud Console.
Check that `VITE_GOOGLE_CLIENT_ID` is set under **Settings → Secrets and variables → Actions**.

**Drive import button doesn't appear**
Both **Google Drive API** and **Google Picker API** must be enabled in Google Cloud Console.

**WHOOP "connection failed"**
The WHOOP redirect URI in the developer portal must exactly match `https://YOUR-USERNAME.github.io/apex-lab/`.
Check Cloudflare Worker logs: **Workers & Pages → apex-worker → Logs**.

**Health cache not updating**
Run manually: **Actions → Health Cache → Run workflow**.
Confirm the token secret exists under Actions secrets (not repository variables).

**AI coaching shows no response**
If using Option A: verify the API key in Settings is valid (use the Test button).
If using Option B: check that `ANTHROPIC_API_KEY` is set in Vercel env vars and the project was redeployed.
