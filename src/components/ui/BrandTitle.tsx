interface BrandTitleProps { className?: string; }

export function BrandTitle({ className = '' }: BrandTitleProps) {
  const word = 'Vanguard';
  const body = word.slice(0, -1);
  const last = word.slice(-1);
  return (
    <span className={className} style={{ letterSpacing: '0.25em', fontWeight: 900, textTransform: 'uppercase' }}>
      {body}
      <span style={{ color: 'var(--color-primary, #5B6CFF)' }}>{last}</span>
    </span>
  );
}
