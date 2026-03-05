import { useCallback, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { SessionSummary } from '@/types/session';
import { parseRacechronoCsv } from '@/lib/parseRacechronoCsv';

interface DropZoneProps {
  onSessionLoaded: (filename: string, data: SessionSummary) => { ok: boolean; error?: string };
}

export function DropZone({ onSessionLoaded }: DropZoneProps) {
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
          const parsed = JSON.parse(content);
          const result = onSessionLoaded(file.name, parsed);
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

  return (
    <label
      className="relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 p-6 text-center transition-all duration-200 cursor-pointer"
      style={{
        borderColor: isDragging ? '#3B82F6' : '#2E2E3C',
        background: isDragging ? 'rgba(59,130,246,0.08)' : 'rgba(26,26,34,0.6)',
      }}
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
      <Upload size={20} style={{ color: isDragging ? '#3B82F6' : '#606070' }} />
      <div>
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em', color: '#E8E8F0' }}>
          {isDragging ? 'Drop session here' : 'Load Session'}
        </div>
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', color: '#606070', marginTop: 2 }}>
          RaceChrono CSV · JSON · tap to browse
        </div>
      </div>
    </label>
  );
}
