interface BrandTitleProps { className?: string; }

export function BrandTitle({ className = '' }: BrandTitleProps) {
  const word = 'Vanguard';
  const body = word.slice(0, -1);
  const last = word.slice(-1);
  return (
    <span className={className} style={{ letterSpacing: 'var(--legacy-inline-style-046)', fontWeight: 'var(--legacy-inline-style-028)', textTransform: 'uppercase' }}>
      {body}
      <span style={{ color: 'var(--color-primary, var(--color-primary))' }}>{last}</span>
    </span>
  );
}
