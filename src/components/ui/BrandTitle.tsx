interface BrandTitleProps { className?: string; }

export function BrandTitle({ className = '' }: BrandTitleProps) {
  const word = 'Vanguard';
  const body = word.slice(0, -1);
  const last = word.slice(-1);
  return (
    <span className={className} style={{ letterSpacing: 'var(--ds-inline-style-0-25em)', fontWeight: 'var(--ds-inline-style-900)', textTransform: 'uppercase' }}>
      {body}
      <span style={{ color: 'var(--color-primary)' }}>{last}</span>
    </span>
  );
}
