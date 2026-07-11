export interface SkeletonProps {
  lines?: number;
  variant?: 'text' | 'card' | 'avatar';
  className?: string;
}

export default function Skeleton({ lines = 3, variant = 'text', className = '' }: SkeletonProps) {
  if (variant === 'avatar') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="h-10 w-10 rounded-full bg-surface-solid animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded bg-surface-solid animate-pulse" />
          <div className="h-2.5 w-1/2 rounded bg-surface-solid animate-pulse" />
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`rounded-2xl border border-border-custom bg-surface p-4 space-y-3 ${className}`}>
        <div className="h-4 w-2/5 rounded bg-surface-solid animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="h-3 rounded bg-surface-solid animate-pulse" style={{ width: `${85 - i * 12}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-surface-solid animate-pulse" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
