import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useFinanceMutations } from '../../lib/financeApi';
import { notify } from '../../lib/notify';
import ContentContainer from '../shared/ContentContainer';
import Spinner from '../ui/Spinner';
import Tabs from '../ui/Tabs';
import { FinanceTabContent, type FinanceTabKey } from './FinanceTabContent';
import { useFinancePageData } from './useFinancePageData';

const TABS = [
  { key: 'today', label: 'Dziś' },
  { key: 'portfolio', label: 'Portfel' },
  { key: 'flows', label: 'Przepływy' },
  { key: 'fire', label: 'Cel' },
] as const;

const WIDTH_BY_TAB: Record<FinanceTabKey, 'narrow' | 'default' | 'wide'> = {
  today: 'narrow',
  fire: 'default',
  portfolio: 'wide',
  flows: 'wide',
};

function FinancePage() {
  const userId = useStore((s) => s.session?.user?.id);
  const { bundleQuery, coinPricesQuery, data, metrics } = useFinancePageData(userId);
  const mutations = useFinanceMutations(userId);
  const [tab, setTab] = useState<FinanceTabKey>('today');
  const reduceMotion = useReducedMotion();

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Błąd zapisu', 'error');
    }
  };

  const saveProfilePatch = (patch: Record<string, number>) => {
    void run(async () => { await mutations.upsertProfile.mutateAsync(patch); });
  };

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-text-muted">
        Zaloguj się, żeby otworzyć finanse.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border-custom/25 bg-background/85 backdrop-blur-[var(--blur-material)]">
        <div className="mx-auto flex max-w-[var(--content-wide)] items-center gap-3 px-[var(--space-4)] py-4 md:px-[var(--space-8)]">
          <Link
            to="/dzis"
            aria-label="Wróć"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition-[transform,background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-95 hover:bg-surface-2 hover:text-text-primary"
          >
            <ArrowLeft size={20} strokeWidth={1.75} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-[var(--tracking-tight)]">Finanse</h1>
          </div>
        </div>
      </header>

      <ContentContainer width={WIDTH_BY_TAB[tab]} className="space-y-8 pb-16 pt-6">
        {bundleQuery.isLoading && (
          <div className="flex justify-center py-16"><Spinner /></div>
        )}
        {bundleQuery.error && (
          <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-danger/20">
            {(bundleQuery.error as Error).message}
          </p>
        )}

        {metrics && data && (
          <>
            <Tabs
              tabs={[...TABS]}
              active={tab}
              onChange={(k) => setTab(k as FinanceTabKey)}
              className="rounded-2xl bg-surface-2/80 p-1 ring-1 ring-border-custom/20 [&_button]:rounded-xl [&_button]:py-2.5 [&_button]:text-sm [&_button]:font-medium"
            />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <FinanceTabContent
                  tab={tab}
                  data={data}
                  metrics={metrics}
                  mutations={mutations}
                  coinPrices={coinPricesQuery.data}
                  pricesLoading={coinPricesQuery.isFetching}
                  run={run}
                  saveProfilePatch={saveProfilePatch}
                />
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </ContentContainer>
    </div>
  );
}

export default FinancePage;
