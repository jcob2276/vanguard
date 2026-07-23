/**
 * @component DashboardHistoriaTab
 * @role Zakładka HISTORIA — Stats (ciało/treningi/dieta), InsightsDashboard, StravaWidget, Photos.
 * @usedBy Dashboard
 */
import { Suspense, lazy } from 'react';
import { Archive, History, Sparkles } from 'lucide-react';
import { useSession } from '../../store/useStore';
import Spinner from '../ui/Spinner';
import Tabs from '../ui/Tabs';
import HorizonHeader from './HorizonHeader';

const Stats             = lazy(() => import('./Stats'));
const StandaloneBodyMetricsCard = lazy(() => import('./stats/StandaloneBodyMetricsCard'));
const InsightsDashboard = lazy(() => import('../insights/InsightsDashboard').then(m => ({ default: m.InsightsDashboard })));
const StravaWidget      = lazy(() => import('../integrations/StravaWidget'));

const Photos            = lazy(() => import('../identity/Photos'));
const NutritionCard     = lazy(() => import('./NutritionCard'));

function ViewFallback() {
  return (
    <div className="flex min-h-[var(--ds-h-220px)] items-center justify-center rounded-lg border border-on-accent/[0.06] bg-on-accent/[0.02]">
      <Spinner size="md" />
    </div>
  );
}

interface Props {
  historySubTab: 'chronicle' | 'archive';
  onSetSubTab: (tab: 'chronicle' | 'archive') => void;
  weeklyCalories: number;
  nutritionKey: number;
}

export function DashboardHistoriaTab({ historySubTab, onSetSubTab, weeklyCalories, nutritionKey }: Props) {
  const session = useSession();
  if (!session) return null;

  const tabs = [
    { key: 'chronicle', label: 'Kronika', icon: <Sparkles size={14} /> },
    { key: 'archive', label: 'Archiwum', icon: <Archive size={14} /> },
  ];

  return (
    <div className="p-5 pb-8">
      <div className="mb-5">
        <HorizonHeader
          eyebrow="Uczę się"
          title="Historia"
          description="Znaczące zdarzenia, pełne dane źródłowe i statystyki — każdy poziom osobno."
          icon={History}
        />
      </div>
      <Suspense fallback={<ViewFallback />}>
        <div className="space-y-6">
          <div className="px-1">
            <Tabs tabs={tabs} active={historySubTab} onChange={onSetSubTab as (key: string) => void} />
          </div>

          <div className={historySubTab === 'chronicle' ? 'space-y-7' : 'hidden'}>
            <StandaloneBodyMetricsCard />
            <InsightsDashboard mode="chronicle" />
            <Photos />
          </div>

          <div className={historySubTab === 'archive' ? '' : 'hidden'}>
            <div className="mb-6">
              <NutritionCard weeklyCalories={weeklyCalories} refreshSignal={nutritionKey} />
            </div>
            <Stats runningSlot={<StravaWidget session={session} />} />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
