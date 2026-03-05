import { useState, useMemo } from 'react';
import type { LoadedSession } from '@/types/session';
import { KPH_TO_MPH, M_TO_FEET, sessionLabel } from '@/lib/utils';

interface CornerRow {
  cornerName: string;
  bestSpeedMph: number;
  avgSpeedMph: number;
  gapMph: number;
  brakeStdFt: number;
  coastTimeS: number;
}

function gapColor(gapMph: number): string {
  if (gapMph > 3) return '#EF3340';
  if (gapMph >= 2) return '#F59E0B';
  return '#9898A8';
}

function brakeColor(ft: number): string {
  if (ft > 40) return '#EF3340';
  if (ft >= 20) return '#F59E0B';
  return '#9898A8';
}

function buildRows(session: LoadedSession): CornerRow[] {
  return Object.entries(session.data.consistency.corners)
    .map(([name, corner]) => ({
      cornerName: name,
      bestSpeedMph: corner.min_speed_best * KPH_TO_MPH,
      avgSpeedMph: corner.min_speed_avg * KPH_TO_MPH,
      gapMph: corner.min_speed_delta * KPH_TO_MPH,
      brakeStdFt: corner.brake_point_std_m * M_TO_FEET,
      coastTimeS: corner.coast_time_avg,
    }))
    .sort((a, b) => b.gapMph - a.gapMph);
}

interface Props {
  sessions: LoadedSession[];
}

const TH: React.CSSProperties = {
  fontFamily: 'Barlow Condensed',
  fontSize: '10px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: '#505060',
  fontWeight: 600,
  paddingBottom: 10,
  paddingRight: 12,
};

export function CornerDetailTable({ sessions }: Props) {
  const [activeSessionId, setActiveSessionId] = useState<string>(
    sessions[0]?.id ?? ''
  );

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId]
  );

  const rows = useMemo(
    () => (activeSession ? buildRows(activeSession) : []),
    [activeSession]
  );

  if (sessions.length === 0) {
    return (
      <p style={{ fontFamily: 'Barlow Condensed', fontSize: '12px', letterSpacing: '0.06em', color: '#505060' }}>
        Load a session to see corner detail.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              style={{
                fontFamily: 'Barlow Condensed', fontSize: '11px', letterSpacing: '0.08em',
                textTransform: 'uppercase', padding: '3px 9px', borderRadius: 3, border: '1px solid',
                borderColor: s.id === activeSessionId ? '#1C69D4' : '#1E1E28',
                color: s.id === activeSessionId ? '#1C69D4' : '#404058',
                background: s.id === activeSessionId ? 'rgba(28,105,212,0.10)' : 'transparent',
              }}
            >
              {sessionLabel(s)}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #252535' }}>
              <th className="text-left" style={TH}>Corner</th>
              <th className="text-right" style={TH}>Best</th>
              <th className="text-right" style={TH}>Avg</th>
              <th className="text-right" style={TH}>Gap</th>
              <th className="text-right" style={TH}>Brake σ</th>
              <th className="text-right" style={{ ...TH, paddingRight: 0 }}>Coast</th>
            </tr>
            <tr>
              <td colSpan={6} style={{ paddingBottom: 4 }}>
                <div style={{ display: 'flex', gap: 16, fontFamily: 'Barlow Condensed', fontSize: '9px', letterSpacing: '0.1em', color: '#383848', textTransform: 'uppercase' }}>
                  <span>mph</span>
                  <span style={{ marginLeft: 60 }}>mph</span>
                  <span style={{ marginLeft: 36 }}>mph</span>
                </div>
              </td>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.cornerName}
                style={{ borderBottom: '1px solid #18181F', height: 44 }}
                className="transition-colors"
                onMouseEnter={e => (e.currentTarget.style.background = '#12121C')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Corner name with rank indicator */}
                <td style={{ paddingRight: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 3, background: idx === 0 ? 'rgba(239,51,64,0.15)' : '#12121C',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: idx === 0 ? '1px solid rgba(239,51,64,0.3)' : '1px solid #1E1E28',
                      fontFamily: 'Barlow Condensed', fontSize: '9px', fontWeight: 700,
                      color: idx === 0 ? '#EF3340' : '#404058', flexShrink: 0,
                    }}>
                      {idx + 1}
                    </div>
                    <span style={{ fontFamily: 'Barlow Condensed', fontSize: '14px', fontWeight: 600, letterSpacing: '0.04em', color: '#E8E8F0' }}>
                      {row.cornerName}
                    </span>
                  </div>
                </td>
                <td className="text-right" style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: '#E8E8F0', paddingRight: 12 }}>
                  {row.bestSpeedMph.toFixed(1)}
                </td>
                <td className="text-right" style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: '#7878A0', paddingRight: 12 }}>
                  {row.avgSpeedMph.toFixed(1)}
                </td>
                <td className="text-right" style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', fontWeight: 600, color: gapColor(row.gapMph), paddingRight: 12 }}>
                  {row.gapMph.toFixed(1)}
                </td>
                <td className="text-right" style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: brakeColor(row.brakeStdFt), paddingRight: 12 }}>
                  {row.brakeStdFt.toFixed(0)}
                  <span style={{ fontFamily: 'Barlow Condensed', fontSize: '9px', letterSpacing: '0.06em', color: '#404050', marginLeft: 2 }}>ft</span>
                </td>
                <td className="text-right" style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: row.coastTimeS > 0.2 ? '#F59E0B' : '#7878A0' }}>
                  {row.coastTimeS.toFixed(2)}
                  <span style={{ fontFamily: 'Barlow Condensed', fontSize: '9px', letterSpacing: '0.06em', color: '#404050', marginLeft: 2 }}>s</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
