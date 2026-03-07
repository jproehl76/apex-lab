# Apex Worker — Cloudflare Worker Deployment

The `apex-worker.js` script is a single-file Cloudflare Worker (no build step).
It handles WHOOP OAuth proxying, Strava webhook ingestion, and Web Push notifications.

## 1. Create a KV namespace

In the Cloudflare dashboard:
1. **Workers & Pages → KV** → Create namespace → name it `apex-kv`
2. Note the Namespace ID

## 2. Deploy the worker

### Option A — Cloudflare Dashboard (simplest)
1. **Workers & Pages → Create → "Hello World" Worker**
2. Name it `apex-worker`
3. Edit code → paste entire contents of `workers/apex-worker.js` → Deploy

### Option B — Wrangler CLI
```toml
# wrangler.toml
name = "apex-worker"
main = "workers/apex-worker.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "APEX_KV"
id = "YOUR_KV_NAMESPACE_ID"
```
```bash
npx wrangler deploy
```

## 3. Bind the KV namespace

Dashboard: **Worker → Settings → Variables → KV Namespace Bindings**
- Variable name: `APEX_KV`
- KV namespace: `apex-kv`

## 4. Set environment variables

Dashboard: **Worker → Settings → Variables → Environment Variables**

| Variable | Value |
|---|---|
| `WHOOP_CLIENT_ID` | From WHOOP Developer Portal |
| `WHOOP_CLIENT_SECRET` | From WHOOP Developer Portal |
| `STRAVA_CLIENT_ID` | From Strava API settings |
| `STRAVA_CLIENT_SECRET` | From Strava API settings |
| `STRAVA_VERIFY_TOKEN` | Any random string you choose |
| `VAPID_PUBLIC_KEY` | From `node scripts/gen-vapid-keys.mjs` |
| `VAPID_PRIVATE_KEY` | From `node scripts/gen-vapid-keys.mjs` |
| `ALLOWED_ORIGIN` | `https://yourusername.github.io` |

## 5. Generate VAPID keys

```bash
node scripts/gen-vapid-keys.mjs
```

Copy the output:
- `VITE_VAPID_PUBLIC_KEY=...` → add to your `.env` file
- `VAPID_PRIVATE_KEY=...` → add to Cloudflare Worker env vars (step 4)

## 6. Update your app config

In `src/config.ts`, ensure `whoopWorkerUrl` points to your worker:
```ts
whoopWorkerUrl: 'https://apex-worker.YOUR-SUBDOMAIN.workers.dev',
```

Also add to `.env`:
```
VITE_VAPID_PUBLIC_KEY=<your public key from step 5>
```

## 7. Register the Strava webhook (one-time)

After deploying the worker, register the webhook subscription with Strava:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=YOUR_STRAVA_CLIENT_ID \
  -F client_secret=YOUR_STRAVA_CLIENT_SECRET \
  -F callback_url=https://apex-worker.YOUR-SUBDOMAIN.workers.dev/strava/webhook \
  -F verify_token=YOUR_STRAVA_VERIFY_TOKEN
```

## 8. Add health cache secrets to GitHub

In your GitHub repo: **Settings → Secrets and variables → Actions**

| Secret | Value |
|---|---|
| `OURA_TOKEN` | Oura Personal Access Token (cloud.ouraring.com/personal-access-tokens) |
| `WHOOP_WORKER_URL` | Your worker URL (e.g. `https://apex-worker.YOUR-SUBDOMAIN.workers.dev`) |

The health cache workflow runs nightly at 7am UTC and commits `public/data/health-cache.json`.
Trigger manually: **Actions → Health Cache → Run workflow**
