import { describe, it, expect } from 'vitest';
import {
  formatLapTime,
  celsiusToF,
  thermalAlertLevel,
  isValidSession,
} from '@/lib/utils';

// ─── formatLapTime ────────────────────────────────────────────────────────────

describe('formatLapTime', () => {
  it('formats a sub-minute lap time', () => {
    expect(formatLapTime(58.234)).toBe('0:58.234');
  });

  it('formats a lap time over a minute', () => {
    expect(formatLapTime(90.5)).toBe('1:30.500');
  });

  it('pads seconds correctly when seconds < 10', () => {
    expect(formatLapTime(65.007)).toBe('1:05.007');
  });

  it('returns placeholder for zero', () => {
    expect(formatLapTime(0)).toBe('--:--.---');
  });

  it('returns placeholder for negative values', () => {
    expect(formatLapTime(-5)).toBe('--:--.---');
  });

  it('returns placeholder for Infinity', () => {
    expect(formatLapTime(Infinity)).toBe('--:--.---');
  });

  it('returns placeholder for NaN', () => {
    expect(formatLapTime(NaN)).toBe('--:--.---');
  });
});

// ─── celsiusToF ──────────────────────────────────────────────────────────────

describe('celsiusToF', () => {
  it('converts 0°C to 32°F', () => {
    expect(celsiusToF(0)).toBe(32);
  });

  it('converts 100°C to 212°F', () => {
    expect(celsiusToF(100)).toBe(212);
  });

  it('converts 20°C to 68°F', () => {
    expect(celsiusToF(20)).toBeCloseTo(68, 5);
  });

  it('converts negative Celsius correctly', () => {
    expect(celsiusToF(-40)).toBe(-40);
  });
});

// ─── thermalAlertLevel ───────────────────────────────────────────────────────

describe('thermalAlertLevel', () => {
  // oil_temp thresholds: watch=266°F, critical=284°F (Fahrenheit after conversion)
  // 130°C -> celsiusToF(130) = 266°F (watch boundary)
  // 140°C -> celsiusToF(140) = 284°F (critical boundary)

  it('returns ok for normal oil temp', () => {
    // 100°C -> 212°F, well below watch threshold of 266°F
    expect(thermalAlertLevel('oil_temp', 100)).toBe('ok');
  });

  it('returns watch for oil temp at watch threshold', () => {
    // 130°C -> 266°F = watch threshold
    expect(thermalAlertLevel('oil_temp', 130)).toBe('watch');
  });

  it('returns critical for oil temp above critical threshold', () => {
    // 140°C -> 284°F = critical threshold
    expect(thermalAlertLevel('oil_temp', 140)).toBe('critical');
  });

  it('returns ok for unknown channel', () => {
    expect(thermalAlertLevel('unknown_channel', 9999)).toBe('ok');
  });

  it('handles boost in bar directly (no unit conversion)', () => {
    // boost watch=1.2 bar, critical=1.5 bar — compared directly
    expect(thermalAlertLevel('boost', 1.0)).toBe('ok');
    expect(thermalAlertLevel('boost', 1.3)).toBe('watch');
    expect(thermalAlertLevel('boost', 1.6)).toBe('critical');
  });
});

// ─── isValidSession ──────────────────────────────────────────────────────────

describe('isValidSession', () => {
  const validSession = {
    header: { track: 'Test', date: '2024-01-01' },
    laps: [],
    consistency: {},
    best_lap_corners: [],
    thermals: [],
    friction_circle: {},
  };

  it('returns true for a structurally valid session', () => {
    expect(isValidSession(validSession)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidSession(null)).toBe(false);
  });

  it('returns false for a non-object primitive', () => {
    expect(isValidSession('string')).toBe(false);
    expect(isValidSession(42)).toBe(false);
  });

  it('returns false when laps is missing', () => {
    const { laps: _, ...noLaps } = validSession;
    expect(isValidSession(noLaps)).toBe(false);
  });

  it('returns false when header is missing', () => {
    const { header: _, ...noHeader } = validSession;
    expect(isValidSession(noHeader)).toBe(false);
  });

  it('returns false when laps is not an array', () => {
    expect(isValidSession({ ...validSession, laps: {} })).toBe(false);
  });
});
