import { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  return '#505068';
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

interface Props { sessions: LoadedSession[] }

export function CornerDetailTable({ sessions }: Props) {
  const [activeSessionId, setActiveSessionId] = useState(sessions[0]?.id ?? '');
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId) ?? sessions[0], [sessions, activeSessionId]);
  const rows = useMemo(() => activeSession ? buildRows(activeSession) : [], [activeSession]);

  if (sessions.length === 0) return (
    <p className="text-xs tracking-wider text-muted-foreground uppercase">Load a session to see corner detail.</p>
  );

  return (
    <div className="space-y-3">
      {sessions.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {sessions.map(s => (
            <button key={s.id} onClick={() => setActiveSessionId(s.id)}
              className="text-[11px] px-2.5 py-1 rounded border transition-colors tracking-wider uppercase"
              style={{
                borderColor: s.id === activeSessionId ? '#1C69D4' : 'hsl(var(--border))',
                color: s.id === activeSessionId ? '#1C69D4' : 'hsl(var(--muted-foreground))',
                background: s.id === activeSessionId ? 'rgba(28,105,212,0.10)' : 'transparent',
              }}>
              {sessionLabel(s)}
            </button>
          ))}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-[10px] tracking-widest text-muted-foreground uppercase">Corner</TableHead>
            <TableHead className="text-right text-[10px] tracking-widest text-muted-foreground uppercase">Best</TableHead>
            <TableHead className="text-right text-[10px] tracking-widest text-muted-foreground uppercase">Avg</TableHead>
            <TableHead className="text-right text-[10px] tracking-widest text-muted-foreground uppercase">Gap</TableHead>
            <TableHead className="text-right text-[10px] tracking-widest text-muted-foreground uppercase">Brake σ</TableHead>
            <TableHead className="text-right text-[10px] tracking-widest text-muted-foreground uppercase">Coast</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={row.cornerName} className="border-border">
              <TableCell className="py-3">
                <div className="flex items-center gap-2">
                  {idx === 0 && (
                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 rounded font-bold">#{idx + 1}</Badge>
                  )}
                  <span style={{ fontFamily: 'BMWTypeNext', fontSize: '14px', fontWeight: 600, letterSpacing: '0.04em' }}>
                    {row.cornerName}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right" style={{ fontFamily: 'JetBrains Mono', fontSize: '13px' }}>
                {row.bestSpeedMph.toFixed(1)}
                <span className="text-[9px] text-muted-foreground ml-1">mph</span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground" style={{ fontFamily: 'JetBrains Mono', fontSize: '13px' }}>
                {row.avgSpeedMph.toFixed(1)}
              </TableCell>
              <TableCell className="text-right">
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', fontWeight: 600, color: gapColor(row.gapMph) }}>
                  {row.gapMph.toFixed(1)}
                </span>
                <span className="text-[9px] text-muted-foreground ml-1">mph</span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground"
                style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: row.brakeStdFt > 40 ? '#EF3340' : row.brakeStdFt > 20 ? '#F59E0B' : undefined }}>
                {row.brakeStdFt.toFixed(0)}
                <span className="text-[9px] text-muted-foreground ml-1">ft</span>
              </TableCell>
              <TableCell className="text-right text-muted-foreground"
                style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: row.coastTimeS > 0.2 ? '#F59E0B' : undefined }}>
                {row.coastTimeS.toFixed(2)}
                <span className="text-[9px] text-muted-foreground ml-1">s</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
