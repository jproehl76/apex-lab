import { useState, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';
import { HardDrive, Loader2 } from 'lucide-react';
import { openDrivePicker, fetchDriveFileContent } from '@/lib/services/googleDrive';
import type { SessionSummary } from '@/types/session';
import { parseRacechronoCsv } from '@/lib/parseRacechronoCsv';

interface Props {
  onSessionLoaded: (filename: string, data: SessionSummary) => { ok: boolean; error?: string };
  onTokenChange?: (token: string | null) => void;
}

export function DrivePickerButton({ onSessionLoaded, onTokenChange }: Props) {
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
        parsed = JSON.parse(content) as SessionSummary;
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

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 w-full justify-center text-xs text-slate-400 hover:text-slate-100 transition-colors px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 bg-slate-900/50 disabled:opacity-50"
      aria-label="Load session from Google Drive"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
      {accessToken ? 'Load from Drive' : 'Connect Google Drive'}
    </button>
  );
}
