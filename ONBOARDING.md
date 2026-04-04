# Apex Lab: Onboarding Guide

Welcome! This guide will help you set up your own instance of Apex Lab, a track telemetry dashboard for HPDE and track day enthusiasts.

## Prerequisites

Before you begin, ensure you have:

| Requirement | Version | Install Link |
|------------|---------|--------------|
| Node.js | 22+ | [nodejs.org](https://nodejs.org) |
| pnpm | 10+ | `npm install -g pnpm` |
| GitHub CLI | Latest | [cli.github.com](https://cli.github.com) |
| Git | Latest | [git-scm.com](https://git-scm.com) |

## Quick Start (5 minutes)

```bash
# 1. Clone your fork
git clone https://github.com/YOUR_USERNAME/apex-lab.git
cd apex-lab

# 2. Copy environment template
cp .env.example .env

# 3. Install dependencies
pnpm install

# 4. Run setup validation
pnpm validate

# 5. Start development server
pnpm dev
```

Open http://localhost:5173/apex-lab/ in your browser.

## Service Setup

### 1. Google Cloud Console (Required)

The app uses Google Sign-In for authentication and Google Drive for session storage.

**Create a Google Cloud Project:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** > **New Project**
3. Name it `apex-lab` or similar, then **Create**

**Enable Required APIs:**
1. Go to **APIs & Services** > **Library**
2. Search and enable: **Google Drive API**
3. Search and enable: **Google Picker API**

**Configure OAuth Consent Screen:**
1. Go to **APIs & Services** > **OAuth consent screen**
2. User type: **External**
3. Fill in:
   - App name: `Apex Lab` (or your custom name)
   - User support email: Your email
   - Developer contact: Your email
4. **Save and Continue**
5. Scopes: Click **Add or Remove Scopes**, add:
   - `openid`
   - `email`
   - `profile`
   - `drive.readonly`
6. **Save and Continue**
7. Test users: Add your Google account email
8. **Save and Continue**

**Create OAuth Credentials:**
1. Go to **APIs & Services** > **Credentials**
2. **Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Name: `Apex Lab Web`
5. Authorized JavaScript origins:
   ```
   http://localhost:5173
   http://localhost:4173
   https://YOUR_USERNAME.github.io
   ```
6. Authorized redirect URIs:
   ```
   http://localhost:5173/
   http://localhost:4173/
   https://YOUR_USERNAME.github.io/apex-lab/
   ```
7. **Create**
8. Copy the **Client ID** (ends in `.apps.googleusercontent.com`)

**Add to your .env:**
```bash
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

### 2. Google Drive Folder (Required)

1. Go to [drive.google.com](https://drive.google.com)
2. Create a new folder named `RaceChrono` (or any name you prefer)
3. Open the folder
4. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

**Add to your .env:**
```bash
VITE_GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here
```

### 3. Vercel (Required for AI Coaching)

The AI coaching feature requires a server-side proxy to protect your Anthropic API key.

**Deploy to Vercel:**
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. **Add New Project** > Import your `apex-lab` fork
3. Framework: **Vite** (auto-detected)
4. **Deploy**

**Configure Environment Variables:**
1. Go to your Vercel project **Settings** > **Environment Variables**
2. Add:
   | Name | Value |
   |------|-------|
   | `ANTHROPIC_API_KEY` | Your key from [console.anthropic.com](https://console.anthropic.com) |
   | `ALLOWED_ORIGIN` | `https://YOUR_USERNAME.github.io` |

3. **Redeploy** the project for changes to take effect

**Add to your .env:**
```bash
VITE_COACHING_WORKER_URL=https://your-app.vercel.app
```

### 4. Anthropic API Key (Required for AI Coaching)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Go to **Settings** > **API Keys**
4. **Create Key**
5. Copy the key (starts with `sk-ant-`)

**Add to Vercel** (not .env - keep server-side only):
- Set `ANTHROPIC_API_KEY` in Vercel Environment Variables

## GitHub Actions Setup

For automated deployments to GitHub Pages:

**Enable GitHub Pages:**
1. Go to your repo **Settings** > **Pages**
2. Source: **GitHub Actions**
3. **Save**

**Add GitHub Secrets:**
```bash
gh auth login  # If not already authenticated

gh secret set VITE_GOOGLE_CLIENT_ID --body "your-client-id"
gh secret set VITE_COACHING_WORKER_URL --body "https://your-app.vercel.app"
gh secret set VITE_GOOGLE_DRIVE_FOLDER_ID --body "your-folder-id"
```

**Trigger a deployment:**
```bash
git commit --allow-empty -m "chore: trigger deployment"
git push
```

## Validation

Run the setup validator to check your configuration:

```bash
pnpm validate
```

This checks:
- All required environment variables are set
- Google Client ID format is valid
- Coaching worker URL is reachable
- Google Drive folder ID is present

## Troubleshooting

### Google Sign-In Fails

**Symptoms:** "Error 400: redirect_uri_mismatch" or blank login screen

**Fix:**
1. Check that your domain is in **Authorized JavaScript origins** in Google Cloud Console
2. Check that your redirect URI is in **Authorized redirect URIs**
3. Wait 5-10 minutes for changes to propagate

### AI Coaching Returns Error

**Symptoms:** "Server configuration error" or CORS error

**Fix:**
1. Verify `ANTHROPIC_API_KEY` is set in **Vercel Environment Variables**
2. Verify `ALLOWED_ORIGIN` matches your deployment URL exactly (including `https://`)
3. **Redeploy** the Vercel project after adding environment variables

### Drive Import Button Missing

**Symptoms:** No "Load from Drive" option

**Fix:**
1. Enable **Google Picker API** in Google Cloud Console
2. Verify `VITE_GOOGLE_DRIVE_FOLDER_ID` is set

### Blank Page / 404

**Symptoms:** White screen or "Not Found" after deployment

**Fix:**
1. Check GitHub Actions tab for build errors
2. Verify **Settings** > **Pages** source is **GitHub Actions**
3. URL must include path: `https://YOUR_USERNAME.github.io/apex-lab/`

## Configuration Reference

| Variable | Location | Required | Description |
|----------|----------|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | .env + GitHub Secrets | Yes | Google OAuth client ID |
| `VITE_GOOGLE_DRIVE_FOLDER_ID` | .env + GitHub Secrets | Yes | Google Drive folder for sessions |
| `VITE_COACHING_WORKER_URL` | .env + GitHub Secrets | For AI | Vercel deployment URL |
| `VITE_APP_NAME` | .env | No | Custom app name |
| `VITE_OWNER_EMAIL` | .env | No | Your email for rate limiting |
| `ANTHROPIC_API_KEY` | Vercel only | For AI | Anthropic API key (never in .env) |
| `ALLOWED_ORIGIN` | Vercel only | For AI | Your deployment URL for CORS |

## Next Steps

1. **Upload your first session**: Export a CSV from RaceChrono and drag it onto the dashboard
2. **Enable AI coaching**: Complete the Vercel setup above
3. **Customize branding**: Set `VITE_APP_NAME` in your .env

Need help? Open an issue on the repository.
