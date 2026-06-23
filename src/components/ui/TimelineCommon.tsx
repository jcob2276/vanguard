import { ReactNode } from 'react';

interface TimelineHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  className?: string;
}

export function TimelineHeader({ icon, title, subtitle, trailing, className = '' }: TimelineHeaderProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {icon && (
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[rgba(91,108,255,0.1)] text-[#5B6CFF] flex-shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] leading-snug truncate" style={{ color: 'var(--text-primary)' }}>
          {title}
        </p>
        {subtitle && (
          <p className="text-[12px] font-medium leading-tight mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </div>
  );
}

interface TimelineFooterProps {
  tags?: string[];
  timestamp?: string;
  className?: string;
}

export function TimelineFooter({ tags, timestamp, className = '' }: TimelineFooterProps) {
  return (
    <div className={`flex items-center justify-between gap-2 mt-3 ${className}`}>
      <div className="flex flex-wrap gap-1.5">
        {(tags ?? []).map((tag) => (
          <TimelineTag key={tag} label={tag} />
        ))}
      </div>
      {timestamp && (
        <span
          className="text-[12px] font-medium flex-shrink-0"
          style={{ color: 'var(--color-text-tertiary)', letterSpacing: '-0.15px' }}
        >
          {timestamp}
        </span>
      )}
    </div>
  );
}

interface TimelineTagProps {
  label: string;
  className?: string;
}

export function TimelineTag({ label, className = '' }: TimelineTagProps) {
  return (
    <span
      className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${className}`}
      style={{ color: '#5B6CFF', background: 'rgba(91,108,255,0.08)' }}
    >
      #{label}
    </span>
  );
}

interface TimelineDividerProps {
  dashed?: boolean;
  className?: string;
}

export function TimelineDivider({ dashed = false, className = '' }: TimelineDividerProps) {
  if (dashed) {
    return (
      <div
        className={`w-full h-px my-3 ${className}`}
        style={{
          backgroundImage: 'repeating-linear-gradient(to right, rgba(153,161,175,0.4) 0, rgba(153,161,175,0.4) 5px, transparent 5px, transparent 10px)',
        }}
      />
    );
  }
  return (
    <div
      className={`w-full h-px my-3 ${className}`}
      style={{ backgroundColor: 'rgba(153,161,175,0.1)' }}
    />
  );
}
