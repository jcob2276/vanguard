/**
 * @component DashboardTydzienTab
 * @role Zakładka TYDZIEŃ — Direction (review/KPI/sprint) + NutritionCard.
 * @usedBy Dashboard
 */
import { Suspense, lazy } from 'react';
import { useSession } from '../../store/useStore';
import Spinner from '../ui/Spinner';
import { SlidersHorizontal } from 'lucide-react';
import HorizonHeader from './HorizonHeader';
import WeeklyNutritionPulse from './WeeklyNutritionPulse';
import WeeklyBodyPulse from './WeeklyBodyPulse';
import WeeklyWinsMap from './WeeklyWinsMap';

const Direction = lazy(() => import('../lifestyle/Direction'));

function ViewFallback() {
  return (
    <div className="flex min-h-[var(--ds-h-220px)] items-center justify-center rounded-lg border border-on-accent/[0.06] bg-on-accent/[0.02]">
      <Spinner size="md" />
    </div>
  );
}

interface Props {
  weeklyCalories: number;
  nutritionKey: number;
  onOpenActionCenter: () => void;
}

export function DashboardTydzienTab({ weeklyCalories, nutritionKey, onOpenActionCenter }: Props) {
  const session = useSession();
  if (!session) return null;
  return (
    <div className="p-5 pb-8">
      <div className="mb-5 space-y-4">
        <HorizonHeader
          eyebrow="Reguluję"
          title="Tydzień"
          description="Sprawdź przebieg, zobacz tylko istotne odchylenia i popraw pozostałą część tygodnia."
          icon={SlidersHorizontal}
        />
        <div className="grid gap-3 lg:grid-cols-2">
          <WeeklyBodyPulse />
          <WeeklyNutritionPulse weeklyCalories={weeklyCalories} refreshSignal={nutritionKey} />
        </div>
        <WeeklyWinsMap />
      </div>
      <Suspense fallback={<ViewFallback />}>
        <Direction session={session} onOpenActionCenter={onOpenActionCenter} />
      </Suspense>
    </div>
  );
}
