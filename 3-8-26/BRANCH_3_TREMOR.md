# Branch 3: feature/tremor-integration

## Prerequisites
Branch 2 (`feature/rebrand-cleanup`) must be merged to main first.

```bash
git checkout main && git pull
git checkout -b feature/tremor-integration
```

## Install

```bash
pnpm add @tremor/react
```

## Tailwind config
In `tailwind.config.js`, add Tremor to content paths:
```js
content: [
  "./index.html",
  "./src/**/*.{js,ts,jsx,tsx}",
  "./node_modules/@tremor/react/**/*.{js,ts,jsx,tsx}",  // ← add
],
```

## CSS Variables for dark theme
Add to `src/index.css` (inside `:root` or a new block):
```css
/* Tremor dark theme overrides — matches Apex Lab surface palette */
:root {
  --tremor-background-default: #0F0F14;    /* base */
  --tremor-background-muted: #1A1A22;      /* card */
  --tremor-background-subtle: #242430;     /* elevated */
  --tremor-border-default: #2E2E3C;        /* overlay */
  --tremor-content-default: #E8E8F0;       /* fg */
  --tremor-content-subtle: #9A9AB0;        /* muted */
  --tremor-content-emphasis: #F0F0F8;      /* bright fg */
  --tremor-ring: #1C69D4;                  /* primary */
}
```

## READ THE FULL SPEC
The complete component-by-component integration spec is at:
`/mnt/user-data/outputs/TREMOR_INTEGRATION_SPEC.md`

Read that file and execute every replacement listed. The key files to modify:

| File | Tremor Components Used |
|------|----------------------|
| `src/components/SessionStats.tsx` | `Card`, `Metric`, `BadgeDelta`, `ProgressBar` |
| `src/components/LapInfoPanel.tsx` | `SparkAreaChart` |
| `src/components/ProgressTab.tsx` | `AreaChart`, `BarList`, `Card` |
| `src/components/ReadinessTab.tsx` | `ProgressCircle`, `CategoryBar` |

## Key principles
- Replace hand-coded KPI cards with Tremor `Card` + `Metric` — responsive font sizing is built in
- Replace hand-drawn SVG sparklines with `SparkAreaChart` — tooltips and gradients for free
- Replace hand-coded progress indicators with `ProgressCircle` and `CategoryBar`
- Keep all existing chart theme tokens (`chartTheme.ts`) for Recharts charts — Tremor only replaces the non-chart display components
- Use Tremor's dark mode classes (`dark:*`) which map to the CSS variables above

## Verify

```bash
pnpm install
npx tsc --noEmit
npx vite build
```

## Commit

```bash
git add -A
git commit -m "feat: replace hand-coded KPIs with Tremor components"
git push -u origin feature/tremor-integration
```

Merge PR, then proceed to Branch 4.
