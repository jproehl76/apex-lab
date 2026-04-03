import { useEffect } from 'react';
import { MapIcon, GraduationCap, LogOut, Trash2, LayoutGrid } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (tab: string) => void;
  onClearAll: () => void;
  onSignOut: () => void;
  hasData: boolean;
}

const TABS = [
  { id: 'session',  label: 'Session',  Icon: () => <span>⊞</span>,  key: '1' },
  { id: 'track',    label: 'Track',    Icon: MapIcon,                key: '2' },
  { id: 'coach',    label: 'Coach',    Icon: GraduationCap,          key: '3' },
  { id: 'progress', label: 'Progress', Icon: () => <span>↗</span>, key: '4' },
];

export function CommandPalette({
  open, onOpenChange, onNavigate, onClearAll, onSignOut, hasData,
}: CommandPaletteProps) {
  // ⌘K / Ctrl+K to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  function run(fn: () => void) {
    onOpenChange(false);
    fn();
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {TABS.map(tab => (
            <CommandItem
              key={tab.id}
              value={`go to ${tab.label}`}
              onSelect={() => run(() => onNavigate(tab.id))}
            >
              <tab.Icon size={14} />
              <span>Go to {tab.label}</span>
              <CommandShortcut>{tab.key}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        {hasData && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Sessions">
              <CommandItem
                value="clear all sessions"
                onSelect={() => run(onClearAll)}
              >
                <Trash2 size={14} />
                <span>Clear all sessions</span>
              </CommandItem>
              <CommandItem
                value="session overview"
                onSelect={() => run(() => onNavigate('session'))}
              >
                <LayoutGrid size={14} />
                <span>Session overview</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem value="sign out" onSelect={() => run(onSignOut)}>
            <LogOut size={14} />
            <span>Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
