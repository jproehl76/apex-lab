import { useState, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';
import { z } from 'zod';
import { HardDrive, Loader2 } from 'lucide-react';
import { openDrivePicker, fetchDriveFileContent } from '@/lib/services/googleDrive';
import type { SessionSummary } from '@/types/session';
import { parseRacechronoCsv } from '@/lib/parseRacechronoCsv';

const sessionSummarySchema = z.object({
  header: z.object({
    track: z.string(),
    date: z.string(),
  }),
  laps: z.array(z.unknown()),
});

interface Props {
  onSessionLoaded: (filename: string, data: SessionSummary) => { ok: boolean; error?: string };
  onTokenChange?: (token: string | null) => void;
  compact?: boolean;
}

export function DrivePickerButton({ onSessionLoaded, onTokenChange, compact = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    onSuccess: (response) => {
      setAccessToken(response.access_token);
      onTokenChange?.(response.access_token);
    },
    onError: () => {
      toast.error('Google Drive authentication failed.');
    },
  });

  const handleClick = useCallback(async () => {
    if (!accessToken) {
      login();
      return;
    }
    setLoading(true);
    try {
      const selection = await openDrivePicker(accessToken);
      if (!selection) return;
      const content = await fetchDriveFileContent(selection.fileId, accessToken);
      const isCsv = selection.filename.toLowerCase().endsWith('.csv') || content.trimStart().startsWith('This file is created using RaceChrono');
      let parsed: SessionSummary;
      if (isCsv) {
        parsed = parseRacechronoCsv(content);
      } else {
        const raw = JSON.parse(content);
        const validation = sessionSummarySchema.safeParse(raw);
        if (!validation.success) {
          toast.error('The Drive file is not a valid session file.');
          return;
        }
        parsed = raw as SessionSummary;
      }
      const result = onSessionLoaded(selection.filename, parsed);
      if (!result.ok) {
        toast.error(result.error ?? 'Failed to load session.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load from Drive.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, login, onSessionLoaded]);

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;

  if (compact) {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors px-2 py-2 rounded-lg border border-border hover:border-border/80 bg-card/50 disabled:opacity-50"
        aria-label={accessToken ? 'Load from Drive' : 'Connect Google Drive'}
        title={accessToken ? 'Load from Drive' : 'Connect Google Drive'}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 w-full justify-center text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg border border-border hover:border-border/80 bg-card/50 disabled:opacity-50"
      aria-label="Load session from Google Drive"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
      {accessToken ? 'Load from Drive' : 'Connect Google Drive'}
    </button>
  );
}
