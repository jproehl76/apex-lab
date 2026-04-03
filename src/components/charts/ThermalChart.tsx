import { Progress } from '@/components/ui/progress';
import type { LoadedSession } from '@/types/session';
import { celsiusToF, sessionLabel, THERMAL_THRESHOLDS, thermalAlertLevel } from '@/lib/utils';
import { FF, FS } from '@/lib/chartTheme';

const CHANNELS = [
  { key: 'oil_temp',     label: 'Oil',     min: 180, max: 300 },
  { key: 'trans_temp',   label: 'Trans',   min: 100, max: 230 },
  { key: 'coolant_temp', label: 'Coolant', min: 150, max: 260 },
  { key: 'iat',          label: 'Intake',  min: 50,  max: 150 },
  { key: 'boost',        label: 'Boost',   min: 0,   max: 2.0 },
];

function alertColor(level: 'ok' | 'watch' | 'critical'): string {
  if (level === 'critical') return '#EF4444';
  if (level === 'watch') return '#F59E0B';
  return '#22C55E';
}

interface Props { sessions: LoadedSession[] }

export function ThermalChart({ sessions }: Props) {
  if (sessions.length === 0) return (
    <p className="text-xs tracking-wider text-muted-foreground uppercase">Load sessions to see thermal data.</p>
  );

  return (
    <div className="space-y-6">
      {sessions.map(session => {
        const cards = CHANNELS.flatMap(opt => {
          const t = session.data.thermals.find(th => th.channel === opt.key);
          if (!t) return [];
          const isBoost = opt.key === 'boost';
          const current = isBoost ? t.end_val.toFixed(2) : Math.round(celsiusToF(t.end_val));
          const peak    = isBoost ? t.peak_val.toFixed(2) : Math.round(celsiusToF(t.peak_val));
          const start   = isBoost ? t.start_val.toFixed(2) : Math.round(celsiusToF(t.start_val));
          const unit    = isBoost ? 'bar' : '°F';
          const level   = thermalAlertLevel(opt.key, t.peak_val);
          const color   = alertColor(level);
          const th      = THERMAL_THRESHOLDS[opt.key];
          const rangeMin = isBoost ? opt.min : Math.round(celsiusToF(opt.min));
          const rangeMax = th ? th.critical * 1.05 : (isBoost ? opt.max : Math.round(celsiusToF(opt.max)));
          const pct = Math.min(100, Math.max(0, ((Number(peak) - rangeMin) / (rangeMax - rangeMin)) * 100));
          return [{ label: opt.label, current, peak, start, unit, color, level, pct }];
        });

        return (
          <div key={session.id} className="space-y-2">
            {sessions.length > 1 && (
              <p className="text-xs tracking-widest text-muted-foreground uppercase">{sessionLabel(session)}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {cards.map(card => (
                <div key={card.label} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  {/* Label + status dot */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: card.color }} />
                      <span style={{ fontFamily: FF.sans, fontSize: `${FS.small}px`, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>{card.label}</span>
                    </div>
                    <span style={{ fontFamily: FF.mono, fontSize: `${FS.small}px`, color: 'hsl(var(--muted-foreground) / 0.5)' }}>
                      pk {card.peak}{card.unit}
                    </span>
                  </div>

                  {/* Current value */}
                  <div className="flex items-baseline gap-1">
                    <span style={{ fontFamily: FF.mono, fontSize: '30px', fontWeight: 600, color: card.color, lineHeight: 1, textShadow: `0 0 20px ${card.color}44` }}>
                      {card.current}
                    </span>
                    <span style={{ fontFamily: FF.sans, fontSize: '14px', color: `${card.color}80` }}>{card.unit}</span>
                  </div>

                  {/* Progress bar */}
                  <Progress value={card.pct} className="h-1 bg-muted"
                    style={{ '--progress-color': card.color } as React.CSSProperties} />

                  {/* Start value */}
                  <p style={{ fontFamily: FF.mono, fontSize: `${FS.small}px`, color: 'hsl(var(--muted-foreground) / 0.4)' }}>
                    start {card.start}{card.unit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
