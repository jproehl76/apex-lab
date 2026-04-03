/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type TextScale = 0.9 | 1.0 | 1.1 | 1.25;

interface ThemeContextValue {
  resolvedTheme: 'dark';
  textScale: TextScale;
  setTextScale: (scale: TextScale) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const SCALE_KEY = 'apex-text-scale';

function applyTextScale(scale: number) {
  document.documentElement.style.setProperty('--text-scale', String(scale));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [textScale, setTextScaleState] = useState<TextScale>(() => {
    const stored = parseFloat(localStorage.getItem(SCALE_KEY) ?? '1');
    return ([0.9, 1.0, 1.1, 1.25] as TextScale[]).includes(stored as TextScale) ? stored as TextScale : 1.0;
  });

  const setTextScale = useCallback((scale: TextScale) => {
    localStorage.setItem(SCALE_KEY, String(scale));
    setTextScaleState(scale);
    applyTextScale(scale);
  }, []);

  // Apply dark class and text scale on mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
    applyTextScale(textScale);
  }, []); // eslint-disable-line

  return (
    <ThemeContext.Provider value={{ resolvedTheme: 'dark', textScale, setTextScale }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
