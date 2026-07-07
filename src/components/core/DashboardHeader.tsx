import { Link } from 'react-router-dom';
import {
  Moon,
  Sun,
  CheckSquare,
  Calendar,
  StickyNote,
  Bookmark,
  LayoutDashboard,
  Search,
} from 'lucide-react';
import { BrandTitle } from '../ui/BrandTitle';
import { PersonaAvatarButton } from '../ui/PersonaAvatarButton';

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
  isCompactLogo?: boolean;
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
  isCompactLogo = false,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border-custom/50 bg-background/70 px-5 py-4.5 backdrop-blur-md shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)]">
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
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" title="System Online" />
        </h1>
        <p className="mt-1 text-[8.5px] font-black uppercase tracking-wider text-text-muted/65">
          {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' })}
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
        <button
          onClick={toggleTheme}
          className="shrink-0 rounded-full border border-border-custom bg-surface-solid/5 p-2.5 text-text-muted hover:text-text-primary hover:bg-surface-solid/15 transition-all duration-300 active:scale-90 cursor-pointer flex items-center justify-center"
          title="Przełącz motyw"
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} className="text-yellow-500" />}
        </button>
        {!showLock && (
          <>
            <button
              onClick={() => onShortcutClick('todo')}
              className={`shrink-0 relative rounded-full border p-2.5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center ${
                view === 'todo'
                  ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] scale-105'
                  : 'bg-surface-solid/5 border-border-custom text-text-muted hover:text-text-primary hover:bg-surface-solid/15'
              }`}
              title="Zadania"
            >
              <CheckSquare size={15} />
            </button>
            <button
              onClick={() => onShortcutClick('kalendarz')}
              className={`shrink-0 relative rounded-full border p-2.5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center ${
                view === 'kalendarz'
                  ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] scale-105'
                  : 'bg-surface-solid/5 border-border-custom text-text-muted hover:text-text-primary hover:bg-surface-solid/15'
              }`}
              title="Kalendarz"
            >
              <Calendar size={15} />
            </button>
            <button
              onClick={() => onShortcutClick('keep')}
              className={`shrink-0 relative rounded-full border p-2.5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center ${
                view === 'keep'
                  ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] scale-105'
                  : 'bg-surface-solid/5 border-border-custom text-text-muted hover:text-text-primary hover:bg-surface-solid/15'
              }`}
              title="Notatki"
            >
              <StickyNote size={15} />
              {staleNoteCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-black text-white shadow-sm ring-1 ring-background">
                  {staleNoteCount > 9 ? '9+' : staleNoteCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onShortcutClick('links')}
              className={`shrink-0 relative rounded-full border p-2.5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center ${
                view === 'links'
                  ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] scale-105'
                  : 'bg-surface-solid/5 border-border-custom text-text-muted hover:text-text-primary hover:bg-surface-solid/15'
              }`}
              title="Zapisane linki"
            >
              <Bookmark size={15} />
            </button>

            <button
              onClick={onSearchClick}
              className="shrink-0 rounded-full border border-border-custom bg-surface-solid/5 p-2.5 text-text-muted hover:text-text-primary hover:bg-surface-solid/15 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center"
              title="Szukaj (Ctrl+K)"
            >
              <Search size={15} />
            </button>

            <Link
              to="/dashboard"
              className="shrink-0 rounded-full border border-border-custom bg-surface-solid/5 p-2.5 text-text-muted hover:text-text-primary hover:bg-surface-solid/15 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center"
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
