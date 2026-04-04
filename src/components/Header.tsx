import { LogOut, Settings } from 'lucide-react';
import apexLabLogo from '@/assets/jp-apex-lab-logo.png';
import type { UserProfile } from '@/lib/userProfile';
import type { TrackLayout } from '@/assets/trackLayouts';
import { config } from '@/config';
import { PrintButton } from '@/components/PrintButton';

interface HeaderProps {
  user: { email: string; name: string; picture: string };
  profile: UserProfile | null;
  activeTrackLayout: TrackLayout | null;
  hasActiveSessions: boolean;
  onSettingsOpen: () => void;
  onPaletteOpen: () => void;
  onSignOut: () => void;
}

/**
 * Main header with motorsport styling, track-adaptive colors,
 * and user controls (settings, command palette, sign out).
 */
export function Header({
  user,
  profile,
  activeTrackLayout,
  hasActiveSessions,
  onSettingsOpen,
  onPaletteOpen,
  onSignOut,
}: HeaderProps) {
  const trackPrimary = activeTrackLayout?.colors.primary ?? config.defaultPrimaryColor;
  const trackAccent = activeTrackLayout?.colors.accent ?? config.defaultAccentColor;
  const trackLogo = activeTrackLayout?.logo;

  return (
    <header
      className="relative shrink-0 overflow-hidden"
      style={{
        height: 'calc(clamp(72px, 13.2vh, 144px) + env(safe-area-inset-top))',
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* CSS motorsport background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(105deg, #0E0E1A 0%, #121220 22%, ${trackPrimary}38 52%, ${trackAccent}20 75%, #0E0E1A 100%)`,
        }}
      />
      {/* Subtle diagonal stripe texture */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -55deg,
            transparent,
            transparent 12px,
            rgba(255,255,255,0.012) 12px,
            rgba(255,255,255,0.012) 13px
          )`,
        }}
      />

      <div className="relative z-10 flex items-center h-full px-4 gap-3">
        {/* App logo */}
        <img
          src={apexLabLogo}
          alt="Apex Lab"
          style={{
            height: 'clamp(52px, 10vh, 110px)',
            width: 'auto',
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />

        {/* Right: track logo + controls */}
        <div className="flex items-center gap-3 ml-auto shrink-0">
          {trackLogo && (
            <img
              src={trackLogo}
              alt={activeTrackLayout?.name}
              className="hidden sm:block object-contain"
              style={{
                height: 'clamp(43px, 8.4vh, 86px)',
                maxWidth: 240,
                opacity: 0.92,
                filter: 'brightness(1.25) drop-shadow(0 0 12px rgba(255,255,255,0.15))',
              }}
            />
          )}

          {/* Settings button */}
          <button
            onClick={onSettingsOpen}
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            title="Settings"
          >
            <Settings size={13} />
          </button>

          {/* Command palette hint */}
          <button
            onClick={onPaletteOpen}
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors text-[12px] tracking-wider"
            title="Command palette (⌘K)"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            <span>⌘K</span>
          </button>

          {/* Print button */}
          {hasActiveSessions && <PrintButton className="hidden lg:flex" />}

          {/* Car name */}
          {profile?.carName && (
            <span
              className="hidden md:block text-muted-foreground"
              style={{
                fontFamily: 'BMWTypeNext',
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {profile.carName}
            </span>
          )}

          {/* User avatar */}
          {user.picture && (
            <img
              src={user.picture}
              alt={user.name}
              className="rounded-full ring-1 ring-border"
              style={{ width: 'clamp(24px, 3.6vh, 31px)', height: 'clamp(24px, 3.6vh, 31px)' }}
            />
          )}

          {/* Sign out */}
          <button
            onClick={onSignOut}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${trackPrimary} 20%, ${trackAccent}80 60%, transparent)`,
        }}
      />
    </header>
  );
}
