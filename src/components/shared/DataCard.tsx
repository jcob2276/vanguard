import type { ReactNode } from 'react';
import { Card } from '../ui/Card';

export interface DataCardProps {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function DataCard({ label, value, detail, icon, className = '' }: DataCardProps) {
  return (
    <Card className={`grid gap-[var(--space-3)] ${className}`} padding="var(--space-5)">
      <div className="flex items-center justify-between gap-[var(--space-3)] text-xs font-semibold text-text-muted"><span>{label}</span>{icon}</div>
      <div className="text-2xl font-bold tracking-tight text-text-primary">{value}</div>
      {detail && <div className="text-xs text-text-secondary">{detail}</div>}
    </Card>
  );
}

export default DataCard;
