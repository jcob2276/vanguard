import { Lightbulb } from 'lucide-react';

interface InsightSummaryData {
  title: string;
  insight: string;
  evidence?: string[];
  confidence?: 'high' | 'medium' | 'low';
  action?: string;
}

const CONF_COLOR = { high: 'var(--color-success)', medium: 'var(--color-warning)', low: 'var(--color-text-tertiary)' };

export function InsightSummaryCard({ data }: { data: InsightSummaryData }) {
  const color = CONF_COLOR[data.confidence ?? 'medium'];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
          <Lightbulb size={12} style={{ color }} />
        </div>
        <p className="text-sm font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{data.title}</p>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{data.insight}</p>
      {data.evidence && data.evidence.length > 0 && (
        <ul className="space-y-0.5">
          {data.evidence.map((e, i) => (
            <li key={i} className="flex gap-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              <span>•</span><span>{e}</span>
            </li>
          ))}
        </ul>
      )}
      {data.action && (
        <div className="rounded-xl px-3 py-2" style={{ background: `${color}0F` }}>
          <p className="text-xs font-semibold" style={{ color }}>→ {data.action}</p>
        </div>
      )}
    </div>
  );
}
