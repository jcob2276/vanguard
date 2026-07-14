import { useRef } from 'react';
import { CharacterAvatar } from './CharacterAvatar';

interface PersonaAvatarButtonProps {
  userId: string;
  unreadCount?: number;
  onClick?: () => void;
  onLongPress?: () => void;
  className?: string;
}

export function PersonaAvatarButton({
  userId,
  unreadCount = 0,
  onClick,
  onLongPress,
  className = '',
}: PersonaAvatarButtonProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <button
      onClick={() => {
        if (longFired.current) {
          longFired.current = false;
          return;
        }
        onClick?.();
      }}
      onPointerDown={() => {
        if (!onLongPress) return;
        longFired.current = false;
        timer.current = setTimeout(() => {
          longFired.current = true;
          onLongPress();
        }, 550);
      }}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      className={`relative flex-shrink-0 rounded-full cursor-pointer transition-transform active:scale-90 ${className}`}
      style={{ width: 'var(--legacy-inline-style-097)', height: 'var(--legacy-inline-style-038)' }}
      aria-label="Profil"
    >
      <CharacterAvatar seed={userId} size={36} />

      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: 'var(--shadow-avatar-ring)' }}
      />

      {unreadCount > 0 && (
        <div
          className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-on-accent font-bold"
          style={{
            minWidth: 'var(--legacy-inline-style-059)',
            height: 'var(--legacy-inline-style-033)',
            fontSize: 'var(--legacy-inline-style-023)',
            background: 'var(--color-danger)',
            border: 'var(--border-avatar-badge)',
            padding: 'var(--legacy-inline-style-069)',
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </div>
      )}
    </button>
  );
}
