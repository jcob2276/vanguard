import Button from '../../ui/Button';
import { Card } from '../../ui/Card';

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
    <Card className="flex items-center gap-2.5 transition-all hover:border-primary/25 hover:bg-surface-solid/50 active:scale-[0.99]" padding="0.625rem 0.5rem 0.625rem 0.875rem">
      <button onClick={onTap} className="flex-1 min-w-0 text-left cursor-pointer">
        <p className="text-[13.5px] font-bold text-text-primary truncate">{name}</p>
        {subtitle && <p className="text-[10.5px] text-text-muted truncate mt-0.5">{subtitle}</p>}
      </button>
      <span className="text-[11.5px] font-black text-primary shrink-0 tabular-nums">{calories ?? '?'} kcal</span>
      <Button
        onClick={onQuickAdd}
        loading={loading}
        className="shrink-0 rounded-full p-2"
        size="sm"
      >
        {!loading && quickAddIcon}
      </Button>
    </Card>
  );
}
