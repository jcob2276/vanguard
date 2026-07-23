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
import { useHaptics } from '../../hooks/useHaptics';

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
  const { medium, heavy, selection } = useHaptics();

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] flex items-center justify-between gap-2 border-b border-black/8 dark:border-white/10 bg-background/80 px-4 py-3 backdrop-blur-[20px] saturate(180%) shadow-sm">
      <div className="min-w-0 shrink-0">
        <h1
          className="font-display text-sm font-bold text-primary select-none cursor-pointer flex items-center gap-1.5 touch-manipulation active:opacity-80"
          title="Przytrzymaj, żeby szybko dodać posiłek"
          onPointerDown={() => { medium(); handleLogoPressStart(); }}
          onPointerUp={handleLogoPressEnd}
          onPointerLeave={handleLogoPressEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
          <BrandTitle />
          <span className="w-2 h-2 rounded-full bg-[var(--color-success)] shadow-xs animate-pulse" title="System Online" />
        </h1>
        <p className="mt-0.5 text-2xs font-semibold tracking-wide text-text-muted">
          {formatDashboardDate()}
        </p>
      </div>
      <div className="header-icon-row flex min-w-0 items-center gap-1.5 overflow-x-auto">
        {userId && (
          <PersonaAvatarButton
            userId={userId}
            unreadCount={unreadCount}
            onLongPress={() => { heavy(); onAvatarLongPress(); }}
            onClick={() => { selection(); onAvatarClick(); }}
          />
        )}
        <Pressable
          onClick={() => { selection(); toggleTheme(); }}
          variant="ghost"
          className="!h-10 !w-10 !p-0 !rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 flex items-center justify-center"
          title="Przełącz motyw"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </Pressable>

        {!showLock && (
          <>
            <div className="hidden sm:block">
              <WorkspaceToolsLauncher active={view} onNavigate={onShortcutClick} placement="header" badgeCount={staleNoteCount} />
            </div>

            <Pressable
              onClick={() => { selection(); onSearchClick?.(); }}
              variant="ghost"
              className="!h-10 !w-10 !p-0 !rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 flex items-center justify-center"
              title="Szukaj (Ctrl+K)"
            >
              <Search size={16} />
            </Pressable>

            {isNativePlatform() && (
              <Link
                to="/settings"
                onClick={() => selection()}
                className="h-10 w-10 shrink-0 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-text-muted hover:text-text-primary hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-transform flex items-center justify-center"
                title="Ustawienia APK"
              >
                <Settings size={16} />
              </Link>
            )}

            <Link
              to="/dashboard"
              onClick={() => selection()}
              className="h-10 w-10 shrink-0 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-text-muted hover:text-text-primary hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-transform flex items-center justify-center"
              title="Desktop dashboard"
            >
              <LayoutDashboard size={16} />
            </Link>
          </>
        )}
      </div>
    </header>
  );
}



