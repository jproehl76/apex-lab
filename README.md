# JP Apex Lab: Track Telemetry Dashboard

Personal track data dashboard for high-performance driving. Ingests RaceChrono CSV exports and presents lap analysis, corner performance, engine thermals, and AI coaching in a single pit-wall interface.

**Live app:** https://jproehl76.github.io/apex-lab/

---

## What it does

| Tab | Content |
|-----|---------|
| **Session** | Stats, best lap, AI coaching insights, lap time progression |
| **Map** | GPS heat map with speed/throttle/brake channels |
| **Corners** | Corner speed comparison, detail table (gap/brake/coast), friction circle |
| **Health** | Engine thermals (oil/coolant/trans/IAT/boost) |
| **Notes** | Per-session debrief notes, persisted in browser storage |
| **Progress** | Session progression and track history |

Multi-session comparison is supported: load multiple sessions simultaneously to overlay lap times and compare corner speeds across runs.

---

## Data source

All telemetry comes from **RaceChrono** (iOS/Android) with an OBD-II adapter + GPS.

### Exporting from RaceChrono

1. Open the session in RaceChrono
2. Tap the menu, then **Export**
3. Choose **CSV (channels)**
4. AirDrop or share the `.csv` file to your device

Then in the dashboard: drag the CSV onto the drop zone, or use **Load from Drive** if the file is in Google Drive.

---

## Running locally

Requires Node 22+ and pnpm.

```bash
git clone https://github.com/jproehl76/apex-lab.git
cd apex-lab
pnpm install
pnpm dev
```

Open http://localhost:5173/apex-lab/

---

## Deploying

Pushes to `main` automatically deploy to GitHub Pages via the Actions workflow. No manual step needed.

See [SETUP.md](SETUP.md) for the full fork-and-deploy guide.

---

## Stack

- **React 19 + TypeScript 5.9**, Vite build
- **Tailwind CSS + shadcn/ui**, dark theme
- **Recharts**, lap time and corner speed charts
- **D3**, track map SVG projection (Mercator)
- **Leaflet + react-leaflet**, GPS heat map with OpenStreetMap tiles
- **Claude AI**, streaming coaching analysis via Anthropic API
- **Google Drive Picker API**, load CSVs from Drive
- **PWA** with Workbox service worker

---

## Project structure

```
src/
  assets/          Track layouts (GPS waypoints), logo
  components/
    charts/        All chart and visualization components
    ui/            shadcn/ui primitives
  hooks/           useMemory, useShareTarget, useDriveAutoImport
  lib/
    services/      AI coaching, Google Drive, corner detection, OSM track fetch
    utils.ts       Unit conversions, lap formatting, thermal thresholds
  types/           Session data types
```

---

## Auth

Requires Google sign-in (used for identity and optionally Drive access). Credentials are stored in browser storage only. Nothing is sent to any server except the Anthropic API (when AI coaching is enabled).
