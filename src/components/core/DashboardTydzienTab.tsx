import { Suspense, lazy } from 'react';
import { useSession } from '../../store/useStore';
import NutritionCard from './NutritionCard';
import NutritionTrainingBarCard from './nutrition/NutritionTrainingBarCard';
import Spinner from '../ui/Spinner';

const Direction = lazy(() => import('../lifestyle/Direction'));

function ViewFallback() {
  return (
    <div className="flex min-h-[var(--legacy-h-017)] items-center justify-center rounded-lg border border-on-accent/[0.06] bg-on-accent/[0.02]">
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
      <Suspense fallback={<ViewFallback />}>
        <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-7 lg:space-y-0">
          <NutritionTrainingBarCard refreshSignal={nutritionKey} />
          <NutritionCard weeklyCalories={weeklyCalories} refreshSignal={nutritionKey} />
          <div className="lg:col-span-2">
            <Direction session={session} onOpenActionCenter={onOpenActionCenter} />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
