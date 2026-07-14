interface CharacterAvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

export function CharacterAvatar({ seed, size = 36, className = '' }: CharacterAvatarProps) {
  const url = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear`;
  return (
    <img
      src={url}
      alt="avatar"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: 'var(--legacy-inline-style-010)', display: 'block', objectFit: 'cover' }}
      draggable={false}
    />
  );
}
