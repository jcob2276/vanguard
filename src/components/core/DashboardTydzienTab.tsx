import { Suspense, lazy } from 'react';
import { useSession } from '../../store/useStore';
import NutritionCard from './NutritionCard';
import NutritionTrainingBarCard from './nutrition/NutritionTrainingBarCard';
import Spinner from '../ui/Spinner';

const Direction = lazy(() => import('../lifestyle/Direction'));

function ViewFallback() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
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
        <div className="space-y-7">
          <NutritionTrainingBarCard session={session} refreshSignal={nutritionKey} />
          <NutritionCard weeklyCalories={weeklyCalories} session={session} refreshSignal={nutritionKey} />
          <Direction session={session} onOpenActionCenter={onOpenActionCenter} />
        </div>
      </Suspense>
    </div>
  );
}
