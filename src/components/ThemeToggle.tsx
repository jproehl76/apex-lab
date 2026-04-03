import { Monitor, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';

const MODES = [
  { value: 'system' as const, Icon: Monitor, title: 'System' },
  { value: 'light'  as const, Icon: Sun,     title: 'Light' },
  { value: 'dark'   as const, Icon: Moon,    title: 'Dark' },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="hidden lg:flex items-center rounded border border-border overflow-hidden">
      {MODES.map(({ value, Icon, title }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={title}
          className="flex items-center justify-center w-7 h-7 transition-colors"
          style={{
            background: theme === value ? 'hsl(var(--accent))' : 'transparent',
            color: theme === value ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          }}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}
