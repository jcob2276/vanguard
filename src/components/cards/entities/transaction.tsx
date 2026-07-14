import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
interface TransactionData { label: string; amount: number; currency?: string; date?: string; direction?: 'in' | 'out'; category?: string; }
export function TransactionCard({ data }: { data: TransactionData }) {
  const isIn = data.direction === 'in';
  const color = isIn ? 'var(--color-success)' : 'var(--color-danger)';
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${isIn ? 'var(--color-success)' : 'var(--color-danger)'} 8%, transparent)` }}>
        {isIn ? <ArrowDownLeft size={14} style={{ color }} /> : <ArrowUpRight size={14} style={{ color }} />}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{data.label}</p>
        {(data.category || data.date) && <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{data.category}{data.category && data.date ? ' · ' : ''}{data.date}</p>}
      </div>
      <span className="text-base font-bold" style={{ color }}>{isIn ? '+' : '-'}{Math.abs(data.amount)} {data.currency ?? 'PLN'}</span>
    </div>
  );
}
