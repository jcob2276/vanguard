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
      style={{ width: 36, height: 36 }}
      aria-label="Profil"
    >
      <CharacterAvatar seed={userId} size={36} />

      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: '0 0 0 2px var(--color-primary, #5B6CFF)' }}
      />

      {unreadCount > 0 && (
        <div
          className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-bold"
          style={{
            minWidth: 16,
            height: 16,
            fontSize: 9,
            background: '#F43F5E',
            border: '2px solid var(--surface-solid, white)',
            padding: '0 3px',
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </div>
      )}
    </button>
  );
}
