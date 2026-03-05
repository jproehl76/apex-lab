export const CHART_MARGINS = { top: 10, right: 12, bottom: 28, left: 56 };
export const CHART_MARGINS_MOBILE = { top: 6, right: 6, bottom: 22, left: 44 };

export const AXIS_STYLE = {
  tick: { fill: '#505060', fontSize: 11, fontFamily: 'BMWTypeNext', letterSpacing: '0.05em' },
  axisLine: { stroke: '#252535' },
  tickLine: { stroke: '#252535' },
};

export const GRID_STYLE = {
  stroke: '#18181F',
  strokeDasharray: 'none' as const,
  vertical: false,
};

export const TOOLTIP_STYLE = {
  backgroundColor: '#14141E',
  border: '1px solid #2E2E3C',
  borderRadius: '6px',
  padding: '10px 14px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  fontFamily: 'BMWTypeNext',
  fontSize: '13px',
  letterSpacing: '0.04em',
  color: '#E8E8F0',
};

export const CHANNEL_COLORS = {
  speed:    '#1C69D4',
  brake:    '#EF3340',
  throttle: '#00C853',
  rpm:      '#F97316',
  gear:     '#A855F7',
  steering: '#06B6D4',
  latg:     '#EC4899',
  longg:    '#EAB308',
};

// Session colors (existing palette — keep consistent)
export const SESSION_COLORS = ['#2563EB','#D97706','#059669','#DC2626','#7C3AED','#0891B2'];
