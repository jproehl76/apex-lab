# JP Apex Lab: Setup Guide

A free, self-hosted HPDE telemetry + coaching PWA.
Fork it, configure it, deploy it: your data stays in your browser.

---

## What you unlock at each tier

| Tier | Features | Time |
|------|----------|------|
| **1: Core** | Upload RaceChrono CSV, full telemetry dashboard, lap times, corner analysis, G-force, Google Sign-In, Google Drive auto-import | ~20 min |
| **2: AI Coaching** | Claude AI analyses your laps, answers follow-up questions, compares sessions | ~10 min |

Everything runs on **GitHub Pages** (free) + optionally **Vercel** free tier for AI proxy.
No database. No monthly bills.

---

## Prerequisites

```bash
# Node.js 22+
node --version

# pnpm
npm install -g pnpm

# GitHub CLI (manages secrets from the terminal)
# macOS:   brew install gh
# Windows: winget install GitHub.cli
# Other:   https://cli.github.com
gh auth login
```

---

## Tier 1: Core (Required)

### 1-A  Fork and clone

1. Open **https://github.com/jproehl76/apex-lab**
2. Click **Fork**
3. Clone locally and install:

```bash
git clone https://github.com/YOUR-USERNAME/apex-lab.git
cd apex-lab
pnpm install
```

---

### 1-B  Enable GitHub Pages

1. Your forked repo, **Settings, Pages**
2. Source: **GitHub Actions**
3. Click **Save**

> The deploy workflow at `.github/workflows/deploy.yml` triggers automatically on every push to `main`.

---

### 1-C  Create a Google OAuth client

The app uses Google Sign-In. You need your own OAuth client.

1. Go to **https://console.cloud.google.com**
2. Create a new project, name it `apex-lab`
3. **APIs & Services, Library**: enable **Google Drive API**
4. **APIs & Services, Library**: enable **Google Picker API**
5. **APIs & Services, OAuth consent screen**
   - User type: **External**
   - App name: your choice (e.g. `My Apex Lab`)
   - Support email + developer email: your Gmail
   - Scopes: `openid`, `email`, `profile`, `drive.readonly`
   - Add yourself as a test user, Save
6. **APIs & Services, Credentials, Create Credentials, OAuth 2.0 Client ID**
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
   - Create, copy the **Client ID** (ends in `.apps.googleusercontent.com`)

---

### 1-D  Create your Google Drive folder

1. Go to **https://drive.google.com**
2. Create a folder, name it `RaceChrono` (or anything you like)
3. Open the folder; the URL looks like:
   `https://drive.google.com/drive/folders/1ABC...XYZ`
4. Copy the ID (the part after `/folders/`)

---

### 1-E  Edit `src/config.ts`

This is the **only source file** you need to touch. Open it and update:

```ts
export const config = {
  appName: 'My Apex Lab',
  carName: '',  // set via user profile on first launch

  // Accent colours for the header
  stripeColors: ['#1C69D4', '#6B2D9E', '#EF3340'],
  defaultPrimaryColor: '#1C69D4',
  defaultAccentColor: '#A855F7',

  googleDriveFolderId: 'PASTE-YOUR-FOLDER-ID-HERE',   // from step 1-D

  coachingWorkerUrl: '',  // set in Tier 2 if using shared AI proxy
};
```

---

### 1-F  Run the automated setup script

```bash
node scripts/setup.mjs
```

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

**Your app is live at: `https://YOUR-USERNAME.github.io/apex-lab/`**

---

## Tier 2: AI Coaching (Optional)

The coach uses Claude to analyse telemetry and answer follow-up questions.
Users can bring their own Anthropic API key, no server setup needed.

### Option A: Each user supplies their own key (simplest)

No server needed. Each user:
1. Gets an API key at **https://console.anthropic.com**
2. Opens the Settings gear in the app, AI Coaching, pastes key, Save

The key is stored in IndexedDB on their device only. Never sent anywhere except Anthropic.

---

### Option B: Shared Vercel proxy (one key, all users of your fork)

#### 2B-1. Deploy to Vercel

1. Sign up free at **https://vercel.com**
2. **Add New Project**, Import from GitHub, select `apex-lab`
3. Framework: **Vite** (auto-detected), **Deploy**

#### 2B-2. Add the Anthropic key to Vercel

**Vercel project, Settings, Environment Variables, Add**

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from https://console.anthropic.com |

Redeploy: **Deployments, Redeploy**

#### 2B-3. Point the app at your proxy

```bash
gh secret set VITE_COACHING_WORKER_URL --body "https://YOUR-APP.vercel.app" --repo YOUR-USERNAME/apex-lab
```

```bash
git commit --allow-empty -m "chore: trigger rebuild with coaching proxy" && git push
```

---

## Local development

```bash
cp .env.example .env
# Edit .env: add VITE_GOOGLE_CLIENT_ID at minimum
pnpm dev
# http://localhost:5173/apex-lab/
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

```bash
gh secret set SECRET_NAME --body "value" --repo YOUR-USERNAME/apex-lab
```

| Secret | Where | Required? |
|--------|-------|-----------|
| `VITE_GOOGLE_CLIENT_ID` | GitHub Actions | **Yes** |
| `VITE_COACHING_WORKER_URL` | GitHub Actions | Shared AI proxy only |
| `ANTHROPIC_API_KEY` | Vercel env var | Shared AI proxy only |

---

## Troubleshooting

**Blank page / 404**
Check **Actions** tab: did the build succeed?
Check **Settings, Pages**: source must be **GitHub Actions**.
The URL must include the path: `https://YOUR-USERNAME.github.io/apex-lab/`

**Google login fails**
Verify `https://YOUR-USERNAME.github.io` is in the authorized origins in Google Cloud Console.
Check that `VITE_GOOGLE_CLIENT_ID` is set under **Settings, Secrets and variables, Actions**.

**Drive import button doesn't appear**
Both **Google Drive API** and **Google Picker API** must be enabled in Google Cloud Console.

**AI coaching shows no response**
If using Option A: verify the API key in Settings is valid (use the Test button).
If using Option B: check that `ANTHROPIC_API_KEY` is set in Vercel env vars and the project was redeployed.
