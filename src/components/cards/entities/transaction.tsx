import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
interface TransactionData { label: string; amount: number; currency?: string; date?: string; direction?: 'in' | 'out'; category?: string; }
export function TransactionCard({ data }: { data: TransactionData }) {
  const isIn = data.direction === 'in';
  const color = isIn ? 'var(--color-success)' : 'var(--color-danger)';
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${isIn ? 'var(--color-success)' : 'var(--color-danger)'}14` }}>
        {isIn ? <ArrowDownLeft size={14} style={{ color }} /> : <ArrowUpRight size={14} style={{ color }} />}
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{data.label}</p>
        {(data.category || data.date) && <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{data.category}{data.category && data.date ? ' · ' : ''}{data.date}</p>}
      </div>
      <span className="text-[14px] font-bold" style={{ color }}>{isIn ? '+' : '-'}{Math.abs(data.amount)} {data.currency ?? 'PLN'}</span>
    </div>
  );
}
