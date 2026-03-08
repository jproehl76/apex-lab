# BMW G80 M3 Competition — Track Telemetry Dashboard

Personal track data dashboard for the G80 M3 Competition. Ingests RaceChrono CSV exports and presents lap analysis, corner performance, engine thermals, and driver readiness in a single pit-wall interface.

**Live app:** https://jproehl76.github.io/apex-lab/

---

## What it does

| Tab | Content |
|-----|---------|
| **Session** | Stats, best lap, coaching insights, lap time progression |
| **Corners** | Corner speed comparison, detail table (gap/brake σ/coast), friction circle |
| **Health** | Engine thermals (oil/coolant/trans/IAT/boost), WHOOP recovery & readiness |
| **Notes** | Per-session debrief notes, persisted in browser storage |

The left panel (desktop) shows a Road Atlanta reference track map with clickable corner markers — tap any corner to see entry/apex/exit speed, brake point, coast time, and peak lateral G.

Multi-session comparison is supported: load multiple sessions simultaneously to overlay lap times and compare corner speeds across runs.

---

## Data source

All telemetry comes from **RaceChrono** (iOS) running on an OBD-II adapter + GPS.

### Exporting from RaceChrono

1. Open the session in RaceChrono
2. Tap **···** → **Export**
3. Choose **CSV (channels)** — not video, not MoTeC
4. AirDrop or share the `.csv` file to your device

Then in the dashboard: drag the CSV onto the drop zone, or use **Load from Drive** if the file is in Google Drive.

---

## Running locally

Requires Node 18+ and pnpm.

```bash
git clone https://github.com/jproehl76/apex-lab.git
cd apex-lab
pnpm install
pnpm dev
```

Open http://localhost:5173

---

## Deploying

Pushes to `main` automatically deploy to GitHub Pages via the Actions workflow. No manual step needed.

---

## Stack

- **React 18 + TypeScript** — Vite build
- **Tailwind CSS + shadcn/ui** — dark theme, BMW M color palette
- **Recharts** — lap time and corner speed charts
- **D3** — track map SVG projection (Mercator)
- **@formkit/auto-animate** — session list animations
- **WHOOP API** — OAuth2 recovery and readiness data
- **Google Drive Picker API** — load CSVs from Drive

---

## Project structure

```
src/
  assets/          Track layouts (Road Atlanta GPS waypoints), logo, photo
  components/
    charts/        All chart and visualization components
    ui/            shadcn/ui primitives
  hooks/           useMemory (cross-session persistence)
  lib/
    services/      WHOOP auth, Google Drive integration
    utils.ts       Unit conversions, lap formatting, thermal thresholds
  types/           Session data types
```

---

## Auth

Requires Google sign-in (used for identity and optionally Drive access). Credentials are stored in `localStorage` only — nothing is sent to any server. WHOOP connection is optional and uses OAuth2 with tokens stored locally.
