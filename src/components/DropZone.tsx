import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import type { SessionSummary } from '@/types/session';
import { parseRacechronoCsv } from '@/lib/parseRacechronoCsv';

const sessionSummarySchema = z.object({
  header: z.object({
    track: z.string(),
    date: z.string(),
  }),
  laps: z.array(z.unknown()),
});

interface DropZoneProps {
  onSessionLoaded: (filename: string, data: SessionSummary) => { ok: boolean; error?: string };
  compact?: boolean;
}

export function DropZone({ onSessionLoaded, compact = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    const isCsv = file.name.endsWith('.csv');
    const isJson = file.name.endsWith('.json');

    if (!isJson && !isCsv) {
      toast.error(`"${file.name}" is not a JSON or CSV file.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (isCsv) {
          const parsed = parseRacechronoCsv(content);
          const result = onSessionLoaded(file.name, parsed);
          if (result.ok) {
            toast.success(`Loaded: ${file.name}`);
          } else {
            toast.error(result.error ?? 'Unknown error.');
          }
        } else {
          const raw = JSON.parse(content);
          const validation = sessionSummarySchema.safeParse(raw);
          if (!validation.success) {
            toast.error(`"${file.name}" is not a valid session file.`);
            return;
          }
          const result = onSessionLoaded(file.name, raw as SessionSummary);
          if (result.ok) {
            toast.success(`Loaded: ${file.name}`);
          } else {
            toast.error(result.error ?? 'Unknown error.');
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not parse "${file.name}".`);
      }
    };
    reader.readAsText(file);
  }, [onSessionLoaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  }, [processFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(processFile);
    e.target.value = '';
  }, [processFile]);

  if (compact) {
    return (
      <label
        className={`relative rounded-lg border border-dashed flex items-center justify-center gap-2 px-3 py-2 transition-all duration-200 cursor-pointer ${
          isDragging ? 'border-blue-500 bg-blue-500/[0.08]' : 'border-border bg-card/60'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <input type="file" accept=".json,.csv" multiple className="sr-only" onChange={onInputChange} />
        <Upload size={14} className={isDragging ? 'text-blue-500' : 'text-muted-foreground'} />
        <span className={`whitespace-nowrap ${isDragging ? 'text-blue-500' : 'text-muted-foreground'}`} style={{ fontFamily: 'BMWTypeNext', fontSize: '13px' }}>
          {isDragging ? 'Drop here' : 'Add Session'}
        </span>
      </label>
    );
  }

  return (
    <label
      className={`relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 p-6 text-center transition-all duration-200 cursor-pointer ${
        isDragging ? 'border-blue-500 bg-blue-500/[0.08]' : 'border-border bg-card/60'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      <input
        type="file"
        accept=".json,.csv"
        multiple
        className="sr-only"
        onChange={onInputChange}
      />
      <Upload size={20} className={isDragging ? 'text-blue-500' : 'text-muted-foreground'} />
      <div>
        <div className="text-foreground" style={{ fontFamily: 'BMWTypeNext', fontSize: '16px', fontWeight: 600, letterSpacing: '0.05em' }}>
          {isDragging ? 'Drop session here' : 'Load Session'}
        </div>
        <div className="text-muted-foreground" style={{ fontFamily: 'BMWTypeNext', fontSize: '13px', marginTop: 2 }}>
          RaceChrono CSV · JSON · tap to browse
        </div>
      </div>
    </label>
  );
}
