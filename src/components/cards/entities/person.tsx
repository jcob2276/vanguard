import { User } from 'lucide-react';
interface PersonCardData { name: string; role?: string; relation?: string; notes?: string; }
export function PersonCard({ data }: { data: PersonCardData }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[rgba(91,108,255,0.1)]">
        <User size={16} style={{ color: 'var(--color-primary)' }} />
      </div>
      <div>
        <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{data.name}</p>
        {(data.role || data.relation) && <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{data.role ?? data.relation}</p>}
        {data.notes && <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>{data.notes}</p>}
      </div>
    </div>
  );
}
