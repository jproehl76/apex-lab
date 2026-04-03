// ── Design tokens — single source of truth ────────────────────────────────────
//
// All components should import from here.  Never hardcode a color or font size
// that belongs in this file directly in a component.
//
// Theme-aware: components that need to render differently in light/dark should
// call useChartColors(resolvedTheme) which returns the correct color set.
// Static exports (T, AXIS_STYLE, etc.) remain dark-themed defaults for backward compat.

import { useMemo } from 'react';

// ── Text hierarchy (dark defaults — backward compat) ─────────────────────────
export const T = {
  fg:     '#E8E8F0',  // primary foreground: data values, main content
  label:  '#C0C0D4',  // labels: section headers, legends, axis tick labels  (~9:1)
  muted:  '#9A9AB0',  // muted: units, captions, tooltip sub-labels           (~5.5:1)
  ghost:  '#5A5A72',  // ghost: decorative dashes, placeholders               (~2.5:1)
} as const;

// ── Dual theme text hierarchies ─────────────────────────────────────────────
const T_DARK = T;

const T_LIGHT = {
  fg:     '#1A1D2E',  // primary foreground
  label:  '#3A3D4E',  // labels
  muted:  '#6A6D7E',  // muted
  ghost:  '#B0B3C0',  // decorative
} as const;

// ── Status / performance colors ───────────────────────────────────────────────
// Follow F1 timing screen conventions — purple = session best, green = improvement,
// amber = no improvement, red = deficit/danger.  Never use red for "better."
export const S = {
  best:   '#A855F7',  // session best — F1 purple convention
  good:   '#22C55E',  // improvement / fast / good technique
  warn:   '#F59E0B',  // neutral / moderate / no improvement
  bad:    '#EF4444',  // deficit / danger / poor technique  (unified — was EF3340/EF4444)
  info:   '#16588E',  // informational, reference (BMW M dark blue)
} as const;

// ── Font families ─────────────────────────────────────────────────────────────
export const FF = {
  sans:  'BMWTypeNext',    // UI labels, headers, axis labels
  mono:  'JetBrains Mono', // numeric data values — tabular numerals
} as const;

// ── Font size scale ───────────────────────────────────────────────────────────
// Minimum 10px for any informational text; 11px for axis labels (WCAG best practice).
// Never use <10px for text that conveys data (reduces to decorative below this floor).
export const FS = {
  nano:   11,  // axis tick labels, legend text, tooltip sub-labels
  small:  12,  // axis tick labels (preferred floor), body labels
  base:   13,  // section descriptions, table cell text
  value:  15,  // numeric data values (monospace)
  large:  19,  // corner card values, key secondary metrics
  hero:   28,  // best lap time, hero numbers
} as const;

// ── Scaled font size helper ──────────────────────────────────────────────────
export function scaledFS(scale: number): { nano: number; small: number; base: number; value: number; large: number; hero: number } {
  return {
    nano:   Math.round(FS.nano * scale),
    small:  Math.round(FS.small * scale),
    base:   Math.round(FS.base * scale),
    value:  Math.round(FS.value * scale),
    large:  Math.round(FS.large * scale),
    hero:   Math.round(FS.hero * scale),
  };
}

// ── Chart infrastructure (dark defaults — backward compat) ──────────────────
export const CHART_MARGINS        = { top: 10, right: 12, bottom: 28, left: 56 };
export const CHART_MARGINS_MOBILE = { top: 6,  right: 6,  bottom: 22, left: 44 };

export const AXIS_STYLE = {
  tick:     { fill: '#C0C0D4', fontSize: FS.small, fontFamily: FF.sans, letterSpacing: '0.05em' },
  axisLine: { stroke: '#2A2A3A' },
  tickLine: { stroke: '#2A2A3A' },
} as const;

export const GRID_STYLE = {
  stroke:          '#18181F',
  strokeDasharray: 'none' as const,
  vertical:        false,
} as const;

export const TOOLTIP_STYLE = {
  backgroundColor: '#14141E',
  border:          '1px solid #2E2E3C',
  borderRadius:    '6px',
  padding:         '10px 14px',
  boxShadow:       '0 8px 32px rgba(0,0,0,0.6)',
  fontFamily:      FF.sans,
  fontSize:        `${FS.small}px`,
  letterSpacing:   '0.04em',
  color:           T.fg,
} as const;

// Common tooltip header style (applied inline, not via TOOLTIP_STYLE object)
export const TOOLTIP_HEADER_STYLE = {
  marginBottom:   6,
  color:          T.muted,
  fontSize:       `${FS.nano}px`,
  letterSpacing:  '0.1em',
  textTransform:  'uppercase' as const,
  fontFamily:     FF.sans,
} as const;

// Common legend item label style
export const LEGEND_LABEL_STYLE = {
  fontFamily:    FF.sans,
  fontSize:      `${FS.small}px`,
  letterSpacing: '0.08em',
  color:         T.label,
  textTransform: 'uppercase' as const,
} as const;

// ── Channel colors — aligned with FastF1 / community conventions ──────────────
export const CHANNEL_COLORS = {
  speed:    '#1C69D4',  // blue   — speed / position
  brake:    '#EF4444',  // red    — brake (unified)
  throttle: '#22C55E',  // green  — throttle / acceleration
  rpm:      '#F97316',  // orange — engine RPM
  gear:     '#A855F7',  // purple — gear
  steering: '#06B6D4',  // cyan   — steering
  latg:     '#EC4899',  // pink   — lateral G
  longg:    '#EAB308',  // yellow — longitudinal G
} as const;

// ── Session colors ────────────────────────────────────────────────────────────
export const SESSION_COLORS = [
  '#2563EB', '#D97706', '#059669', '#DC2626', '#7C3AED', '#0891B2',
] as const;

// ── Axis label helper (consistent across all Recharts charts) ─────────────────
export function axisLabel(value: string, position: 'insideLeft' | 'insideBottom', offset = 0) {
  return {
    value,
    position,
    offset: position === 'insideLeft' ? (offset || 12) : (offset || -6),
    fill:   T.muted,
    fontSize: FS.nano,
    fontFamily: FF.sans,
    letterSpacing: '0.1em',
  };
}

// ── Theme-aware chart colors hook ─────────────────────────────────────────────
export interface ChartColors {
  t: { fg: string; label: string; muted: string; ghost: string };
  axisStyle: { tick: Record<string, string | number>; axisLine: { stroke: string }; tickLine: { stroke: string } };
  gridStyle: { stroke: string; strokeDasharray: string; vertical: boolean };
  tooltipStyle: Record<string, string | number>;
  tooltipHeaderStyle: Record<string, string | number>;
  legendLabelStyle: Record<string, string | number>;
  canvasBg: string;
  cardBg: string;
  borderColor: string;
  surfaceBg: string;
}

export function useChartColors(resolvedTheme: 'light' | 'dark'): ChartColors {
  return useMemo(() => {
    if (resolvedTheme === 'dark') {
      return {
        t: T_DARK,
        axisStyle: AXIS_STYLE,
        gridStyle: GRID_STYLE,
        tooltipStyle: { ...TOOLTIP_STYLE },
        tooltipHeaderStyle: { ...TOOLTIP_HEADER_STYLE },
        legendLabelStyle: { ...LEGEND_LABEL_STYLE },
        canvasBg: '#08080E',
        cardBg: '#0B0B14',
        borderColor: '#1E1E2E',
        surfaceBg: '#0E0E1A',
      };
    }
    // Light mode
    const tl = T_LIGHT;
    return {
      t: tl,
      axisStyle: {
        tick:     { fill: tl.label, fontSize: FS.small, fontFamily: FF.sans, letterSpacing: '0.05em' },
        axisLine: { stroke: '#D0D3DE' },
        tickLine: { stroke: '#D0D3DE' },
      },
      gridStyle: {
        stroke:          '#E8EBF0',
        strokeDasharray: 'none' as const,
        vertical:        false,
      },
      tooltipStyle: {
        backgroundColor: '#FFFFFF',
        border:          '1px solid #D0D3DE',
        borderRadius:    '6px',
        padding:         '10px 14px',
        boxShadow:       '0 4px 16px rgba(0,0,0,0.1)',
        fontFamily:      FF.sans,
        fontSize:        `${FS.small}px`,
        letterSpacing:   '0.04em',
        color:           tl.fg,
      },
      tooltipHeaderStyle: {
        marginBottom:   6,
        color:          tl.muted,
        fontSize:       `${FS.nano}px`,
        letterSpacing:  '0.1em',
        textTransform:  'uppercase' as const,
        fontFamily:     FF.sans,
      },
      legendLabelStyle: {
        fontFamily:    FF.sans,
        fontSize:      `${FS.small}px`,
        letterSpacing: '0.08em',
        color:         tl.label,
        textTransform: 'uppercase' as const,
      },
      canvasBg: '#F5F6F8',
      cardBg: '#FFFFFF',
      borderColor: '#D0D3DE',
      surfaceBg: '#F0F1F5',
    };
  }, [resolvedTheme]);
}
