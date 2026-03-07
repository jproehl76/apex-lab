import type { LoadedSession } from '@/types/session';
import { sessionLabel, formatLapTime } from '@/lib/utils';

interface PrintViewProps {
  sessions: LoadedSession[];
}

/**
 * Hidden on screen (className="print-view hidden"), visible only when printing.
 * @media print in index.css makes .print-view { display: block !important }.
 */
export function PrintView({ sessions }: PrintViewProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="print-view" style={{ display: 'none' }}>
      {/* Print header */}
      <div style={{ borderBottom: '2px solid #1C69D4', paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', margin: 0 }}>JP Apex Lab</h1>
            <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Session Report</p>
          </div>
          <p style={{ fontSize: 10, color: '#777' }}>
            Printed {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {sessions.map(session => {
        const { header, consistency, laps, best_lap_corners } = session.data;
        const cleanLaps = laps.filter(l => !l.is_outlier).sort((a, b) => a.lap_num - b.lap_num);
        const best = consistency.best_lap_s;

        return (
          <div key={session.id} style={{ marginBottom: 32, pageBreakAfter: 'always' }}>
            {/* Session header */}
            <div style={{ background: '#f5f5f5', padding: '10px 14px', borderRadius: 6, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{header.track}</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#555' }}>
                {header.date} · {header.analyzed_laps} clean laps ·&nbsp;
                {sessionLabel(session)}
              </p>
            </div>

            {/* Key stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Best Lap', value: formatLapTime(best) },
                { label: 'Spread', value: `${consistency.spread_s.toFixed(2)}s` },
                { label: 'Consistency', value: `${consistency.consistency_score.toFixed(0)}%` },
                { label: 'Std Dev', value: `${consistency.std_dev_s.toFixed(3)}s` },
              ].map(({ label, value }) => (
                <div key={label} style={{ border: '1px solid #ddd', borderRadius: 4, padding: '8px 12px' }}>
                  <p style={{ margin: 0, fontSize: 9, color: '#777', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, fontFamily: 'monospace' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Lap times table */}
            <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6, color: '#444' }}>Lap Times</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 16 }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd' }}>Lap</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #ddd' }}>Time</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #ddd' }}>Delta</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #ddd' }}>Max Speed</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #ddd' }}>Peak Lat G</th>
                </tr>
              </thead>
              <tbody>
                {cleanLaps.map(lap => {
                  const isBest = lap.lap_time_s === best;
                  const d = lap.lap_time_s - best;
                  return (
                    <tr key={lap.lap_num} style={{ background: isBest ? '#f3eeff' : undefined }}>
                      <td style={{ padding: '3px 8px', border: '1px solid #eee', fontWeight: isBest ? 700 : 400 }}>
                        L{lap.lap_num}{isBest ? ' ●' : ''}
                      </td>
                      <td style={{ padding: '3px 8px', border: '1px solid #eee', textAlign: 'right', fontFamily: 'monospace', fontWeight: isBest ? 700 : 400 }}>
                        {formatLapTime(lap.lap_time_s)}
                      </td>
                      <td style={{ padding: '3px 8px', border: '1px solid #eee', textAlign: 'right', fontFamily: 'monospace', color: isBest ? '#6b21a8' : d < 0.5 ? '#166534' : d < 1.5 ? '#854d0e' : '#991b1b' }}>
                        {isBest ? '—' : `+${d.toFixed(3)}`}
                      </td>
                      <td style={{ padding: '3px 8px', border: '1px solid #eee', textAlign: 'right', fontFamily: 'monospace' }}>
                        {lap.max_speed_kph.toFixed(0)} km/h
                      </td>
                      <td style={{ padding: '3px 8px', border: '1px solid #eee', textAlign: 'right', fontFamily: 'monospace' }}>
                        {lap.peak_lat_g.toFixed(2)}g
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Corner speeds */}
            {best_lap_corners && best_lap_corners.length > 0 && (
              <>
                <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6, color: '#444' }}>Best Lap Corner Analysis</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                      <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd' }}>Corner</th>
                      <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #ddd' }}>Entry</th>
                      <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #ddd' }}>Apex</th>
                      <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #ddd' }}>Exit</th>
                      <th style={{ padding: '4px 8px', textAlign: 'right', border: '1px solid #ddd' }}>Peak Lat G</th>
                    </tr>
                  </thead>
                  <tbody>
                    {best_lap_corners.map(c => (
                      <tr key={c.corner_id}>
                        <td style={{ padding: '3px 8px', border: '1px solid #eee' }}>{c.corner_name}</td>
                        <td style={{ padding: '3px 8px', border: '1px solid #eee', textAlign: 'right', fontFamily: 'monospace' }}>{c.entry_speed_kph.toFixed(0)}</td>
                        <td style={{ padding: '3px 8px', border: '1px solid #eee', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{c.min_speed_kph.toFixed(0)}</td>
                        <td style={{ padding: '3px 8px', border: '1px solid #eee', textAlign: 'right', fontFamily: 'monospace' }}>{c.exit_speed_kph.toFixed(0)}</td>
                        <td style={{ padding: '3px 8px', border: '1px solid #eee', textAlign: 'right', fontFamily: 'monospace' }}>{c.peak_lat_g.toFixed(2)}g</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
