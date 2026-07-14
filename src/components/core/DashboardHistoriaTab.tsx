import { Suspense, lazy } from 'react';
import { Activity, Sparkles } from 'lucide-react';
import { useSession } from '../../store/useStore';
import Spinner from '../ui/Spinner';
import Tabs from '../ui/Tabs';

const Stats             = lazy(() => import('./Stats'));
const InsightsDashboard = lazy(() => import('../insights/InsightsDashboard').then(m => ({ default: m.InsightsDashboard })));
const StravaWidget      = lazy(() => import('../integrations/StravaWidget'));

const Photos            = lazy(() => import('../identity/Photos'));

function ViewFallback() {
  return (
    <div className="flex min-h-[var(--legacy-h-017)] items-center justify-center rounded-lg border border-on-accent/[0.06] bg-on-accent/[0.02]">
      <Spinner size="md" />
    </div>
  );
}

interface Props {
  historySubTab: 'chronicle' | 'bio';
  onSetSubTab: (tab: 'chronicle' | 'bio') => void;
}

export function DashboardHistoriaTab({ historySubTab, onSetSubTab }: Props) {
  const session = useSession();
  if (!session) return null;

  const tabs = [
    { key: 'chronicle', label: 'Kronika', icon: <Sparkles size={14} /> },
    { key: 'bio', label: 'Trener & Bio', icon: <Activity size={14} /> },
  ];

  return (
    <div className="p-5 pb-8">
      <Suspense fallback={<ViewFallback />}>
        <div className="space-y-6">
          <div className="px-1">
            <Tabs tabs={tabs} active={historySubTab} onChange={onSetSubTab as (key: string) => void} />
          </div>

          <div className={historySubTab === 'chronicle' ? 'space-y-7' : 'hidden'}>
            <InsightsDashboard />
            <Photos />
          </div>
          <div className={historySubTab === 'bio' ? '' : 'hidden'}>
            <Stats runningSlot={<StravaWidget session={session} />} />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
