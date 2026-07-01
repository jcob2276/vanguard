import { Loader2 } from 'lucide-react';

export interface FoodRowProps {
  name: string;
  subtitle?: string | null;
  calories: number | null;
  loading?: boolean;
  onTap: () => void;
  onQuickAdd: () => void;
  quickAddIcon: React.ReactNode;
}

export default function FoodRow({ name, subtitle, calories, loading, onTap, onQuickAdd, quickAddIcon }: FoodRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border-custom bg-surface-solid/30 px-3 py-2 hover:bg-surface-solid/60 transition-all">
      <button onClick={onTap} className="flex-1 min-w-0 text-left cursor-pointer">
        <p className="text-[13px] font-bold text-text-primary truncate">{name}</p>
        {subtitle && <p className="text-[10px] text-text-muted truncate">{subtitle}</p>}
      </button>
      <span className="text-[11px] font-black text-primary shrink-0">{calories ?? '?'} kcal</span>
      <button onClick={onQuickAdd} disabled={loading}
        className="shrink-0 rounded-full bg-primary p-1.5 text-white active:scale-90 transition-all cursor-pointer disabled:opacity-50">
        {loading ? <Loader2 size={13} className="animate-spin" /> : quickAddIcon}
      </button>
    </div>
  );
}
