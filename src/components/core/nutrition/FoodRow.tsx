import Spinner from '../../ui/Spinner';

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
    <div className="flex items-center gap-2.5 rounded-2xl border border-border-custom/70 bg-surface-solid/25 pl-3.5 pr-2 py-2.5 shadow-sm transition-all hover:border-primary/25 hover:bg-surface-solid/50 active:scale-[0.99]">
      <button onClick={onTap} className="flex-1 min-w-0 text-left cursor-pointer">
        <p className="text-[13.5px] font-bold text-text-primary truncate">{name}</p>
        {subtitle && <p className="text-[10.5px] text-text-muted truncate mt-0.5">{subtitle}</p>}
      </button>
      <span className="text-[11.5px] font-black text-primary shrink-0 tabular-nums">{calories ?? '?'} kcal</span>
      <button onClick={onQuickAdd} disabled={loading}
        className="shrink-0 rounded-full bg-primary p-2 text-white shadow-sm active:scale-90 transition-all cursor-pointer disabled:opacity-50">
        {loading ? <Spinner size="sm" className="h-3 w-3 !border-white/30 !border-t-white" /> : quickAddIcon}
      </button>
    </div>
  );
}
