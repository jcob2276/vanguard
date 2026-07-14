import type { CorrelationResult } from '@vanguard/domain';
import CorrelationCard from './CorrelationCard';

interface SleepDriversSectionProps {
  title: string;
  subtitle: string;
  titleColor: string;
  drivers: CorrelationResult[];
}

export default function SleepDriversSection({ title, subtitle, titleColor, drivers }: SleepDriversSectionProps) {
  if (drivers.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <p className={`text-xs font-black uppercase tracking-[var(--legacy-arbitrary-004)] ${titleColor}`}>
          {title}
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          {subtitle}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {drivers.map(c => (
          <CorrelationCard key={c.id} item={c} />
        ))}
      </div>
    </section>
  );
}
