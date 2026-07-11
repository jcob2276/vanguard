import { Suspense, lazy } from 'react';
import { Activity, Sparkles } from 'lucide-react';
import { useSession } from '../../store/useStore';
import Spinner from '../ui/Spinner';

const Stats             = lazy(() => import('./Stats'));
const InsightsDashboard = lazy(() => import('../insights/InsightsDashboard').then(m => ({ default: m.InsightsDashboard })));
const TaskAnalyticsCard = lazy(() => import('../insights/TaskAnalyticsCard'));
const StravaWidget      = lazy(() => import('../integrations/StravaWidget'));

const Photos            = lazy(() => import('../identity/Photos'));

function ViewFallback() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
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
  return (
    <div className="p-5 pb-8">
      <Suspense fallback={<ViewFallback />}>
        <div className="space-y-6">
          <div className="flex justify-center px-1">
            <div className="flex w-full p-0.75 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-border-custom/50">
              <button
                type="button"
                onClick={() => onSetSubTab('chronicle')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all cursor-pointer text-[12px] font-bold ${historySubTab === 'chronicle' ? 'bg-bg-secondary shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-primary' : 'text-text-muted hover:text-text-primary'}`}
              >
                <Sparkles size={14} />
                <span>Kronika</span>
              </button>
              <button
                type="button"
                onClick={() => onSetSubTab('bio')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all cursor-pointer text-[12px] font-bold ${historySubTab === 'bio' ? 'bg-bg-secondary shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-primary' : 'text-text-muted hover:text-text-primary'}`}
              >
                <Activity size={14} />
                <span>Trener & Bio</span>
              </button>
            </div>
          </div>

          <div className={historySubTab === 'chronicle' ? 'space-y-7' : 'hidden'}>
            <TaskAnalyticsCard />
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
