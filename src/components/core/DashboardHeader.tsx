import { Pressable } from '../ui/ControlPrimitives';
import { Link } from 'react-router-dom';
import { formatDashboardDate } from '../../lib/date';
import {
  Moon,
  Sun,
  LayoutDashboard,
  Search,
  Settings,
} from 'lucide-react';
import { isNativePlatform } from '../../lib/native/platform';
import { BrandTitle } from '../ui/BrandTitle';
import { PersonaAvatarButton } from '../ui/PersonaAvatarButton';
import WorkspaceToolsLauncher from '../shared/WorkspaceToolsLauncher';

interface DashboardHeaderProps {
  userId: string | undefined;
  unreadCount: number;
  onAvatarLongPress: () => void;
  onAvatarClick: () => void;
  theme: string;
  toggleTheme: () => void;
  showLock: boolean;
  view: string;
  onShortcutClick: (dest: string) => void;
  onSearchClick?: () => void;
  staleNoteCount: number;
  handleLogoPressStart: () => void;
  handleLogoPressEnd: () => void;
}

export function DashboardHeader({
  userId,
  unreadCount,
  onAvatarLongPress,
  onAvatarClick,
  theme,
  toggleTheme,
  showLock,
  view,
  onShortcutClick,
  onSearchClick,
  staleNoteCount,
  handleLogoPressStart,
  handleLogoPressEnd,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] flex items-center justify-between gap-2 border-b border-border-custom/50 bg-background/75 px-5 py-4.5 glass-elevated shadow-[var(--shadow-nav)]">
      <div className="min-w-0 shrink-0">
        <h1
          className="font-display text-sm text-primary select-none cursor-pointer flex items-center gap-1.5"
          title="Przytrzymaj, żeby szybko dodać posiłek"
          onPointerDown={handleLogoPressStart}
          onPointerUp={handleLogoPressEnd}
          onPointerLeave={handleLogoPressEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
          <BrandTitle />
          <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_var(--color-success)] animate-pulse" title="System Online" />
        </h1>
        <p className="mt-1 text-2xs font-black uppercase tracking-wider text-text-muted/65">
          {formatDashboardDate()}
        </p>
      </div>
      <div className="header-icon-row flex min-w-0 items-center gap-2 overflow-x-auto">
        {userId && (
          <PersonaAvatarButton
            userId={userId}
            unreadCount={unreadCount}
            onLongPress={onAvatarLongPress}
            onClick={onAvatarClick}
          />
        )}
        <Pressable
          onClick={toggleTheme}
          variant="ghost"
          className="!rounded-full border border-border-custom bg-surface-solid/5 !p-2.5 hover:bg-surface-solid/15 active:scale-90"
          title="Przełącz motyw"
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} className="text-warning" />}
        </Pressable>
        {!showLock && (
          <>
            <div className="hidden sm:block">
              <WorkspaceToolsLauncher active={view} onNavigate={onShortcutClick} placement="header" badgeCount={staleNoteCount} />
            </div>

            <Pressable
              onClick={onSearchClick}
              variant="ghost"
              className="!rounded-full border border-border-custom bg-surface-solid/5 !p-2.5 hover:bg-surface-solid/15 active:scale-95"
              title="Szukaj (Ctrl+K)"
            >
              <Search size={15} />
            </Pressable>

            {isNativePlatform() && (
              <Link
                to="/settings"
                className="shrink-0 rounded-full border border-border-custom bg-surface-solid/5 p-2.5 text-text-muted hover:text-text-primary hover:bg-surface-solid/15 transition-all duration-[var(--motion-slow)] active:scale-95 cursor-pointer flex items-center justify-center"
                title="Ustawienia APK"
              >
                <Settings size={15} />
              </Link>
            )}

            <Link
              to="/dashboard"
              className="shrink-0 rounded-full border border-border-custom bg-surface-solid/5 p-2.5 text-text-muted hover:text-text-primary hover:bg-surface-solid/15 transition-all duration-[var(--motion-slow)] active:scale-95 cursor-pointer flex items-center justify-center"
              title="Desktop dashboard"
            >
              <LayoutDashboard size={15} />
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
