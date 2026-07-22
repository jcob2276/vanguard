import { notify } from '../../lib/notify';
import { getTodayWarsaw } from '../../lib/date';
import type { FinanceBundle } from '../../lib/financeApi';
import type { FinanceMutations } from '../../lib/financeMutations';
import { FinanceTodayView } from './FinanceTodayView';
import { FireCalculatorPanel } from './FireCalculatorPanel';
import { FinanceAccountsPanel } from './FinanceAccountsPanel';
import { FinanceGoalsPanel } from './FinanceGoalsPanel';
import { FinanceWishlistPanel } from './FinanceWishlistPanel';
import { FinanceSubscriptionsPanel } from './FinanceSubscriptionsPanel';
import { FinanceBillsPanel } from './FinanceBillsPanel';
import { FinanceExpensesPanel, FinanceIncomePanel } from './FinanceFlowsPanels';
import { FinanceMonteCarloSection } from './FinanceMonteCarloSection';
import { FinanceTimelinePanel } from './FinanceTimelinePanel';
import { AllocationPanel } from './AllocationPanel';
import { FinanceCsvImportPanel } from './FinanceCsvImportPanel';
import DividendCalendarPanel from './DividendCalendarPanel';
import PortfolioRebalancePanel from './PortfolioRebalancePanel';
import EtfXrayPanel from './EtfXrayPanel';
import { formatYears } from '../../lib/finance/formatMoney';
import type { FinanceMetrics } from './useFinanceMetrics';
import type { CoinPriceMap } from '../../lib/coingeckoApi';
import { FinanceList, FinanceRow, FinanceSection } from './financeUi';
import type { ParsedTransaction } from '../../lib/finance/csvImport';

export type FinanceTabKey = 'today' | 'portfolio' | 'flows' | 'fire';

interface FinanceTabContentProps {
  tab: FinanceTabKey;
  data: FinanceBundle;
  metrics: FinanceMetrics;
  mutations: FinanceMutations;
  coinPrices?: CoinPriceMap;
  pricesLoading?: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  saveProfilePatch: (patch: Record<string, number>) => void;
}

export function FinanceTabContent(props: FinanceTabContentProps) {
  const { tab, data, metrics, mutations, coinPrices, pricesLoading, run, saveProfilePatch } = props;
  const todayDay = Number(getTodayWarsaw().split('-')[2]) || 1;

  if (tab === 'today') {
    return (
      <FinanceTodayView
        metrics={metrics}
        monthKey={metrics.monthKey}
        cashflow={metrics.cashflowMonth}
        todayDay={todayDay}
        recentTransactions={data.transactions}
        incomeSources={data.incomeSources}
        freedomDaysForAmount={metrics.fire.freedomDaysForAmount}
        onAddExpense={(input) => void run(async () => { await mutations.addTransaction.mutateAsync(input); })}
        addingExpense={mutations.addTransaction.isPending}
      />
    );
  }

  if (tab === 'fire') {
    return (
      <div className="space-y-8">
        <FireCalculatorPanel
          input={metrics.fireInput}
          onChange={(patch) => saveProfilePatch({
            ...(patch.monthlyExpenses != null ? { monthly_expenses: patch.monthlyExpenses } : {}),
            ...(patch.monthlyIncome != null ? { monthly_income: patch.monthlyIncome } : {}),
            ...(patch.expectedReturnPct != null ? { expected_return_pct: patch.expectedReturnPct } : {}),
            ...(patch.inflationPct != null ? { inflation_pct: patch.inflationPct } : {}),
            ...(patch.safeWithdrawalRatePct != null ? { safe_withdrawal_rate_pct: patch.safeWithdrawalRatePct } : {}),
            ...(patch.yearsToRetirement != null ? { years_to_retirement: patch.yearsToRetirement } : {}),
          })}
        />
        <FinanceMonteCarloSection fireInput={metrics.fireInput} fireTarget={metrics.fire.fireNumber} />
        <FinanceSection title="Co jeśli…">
          <FinanceList>
            {metrics.scenarios.map((s) => (
              <FinanceRow key={s.label} primary={s.label} trailing={formatYears(s.yearsToFire)} />
            ))}
          </FinanceList>
        </FinanceSection>
        <FinanceTimelinePanel
          snapshots={data.snapshots}
          currentNetWorth={metrics.netWorth}
          saving={mutations.saveMonthlySnapshot.isPending}
          onSaveSnapshot={() => void run(async () => {
            await mutations.saveMonthlySnapshot.mutateAsync({
              net_worth: metrics.netWorth,
              liquid_cash: metrics.liquid,
              investments: metrics.investments,
            });
            notify('Zapisano snapshot miesiąca', 'success');
          })}
        />
      </div>
    );
  }

  if (tab === 'portfolio') {
    return (
      <div className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <FinanceAccountsPanel
            accounts={data.accounts}
            coinPrices={coinPrices}
            pricesLoading={pricesLoading}
            onAdd={(input) => void run(async () => { await mutations.addAccount.mutateAsync(input); })}
            onUpdate={(input) => void run(async () => { await mutations.updateAccount.mutateAsync(input); })}
            onRemove={(id) => void run(async () => { await mutations.removeAccount.mutateAsync(id); })}
          />
          <FinanceGoalsPanel
            goals={data.goals}
            onAdd={(input) => void run(async () => { await mutations.addGoal.mutateAsync(input); })}
            onUpdateProgress={(input) => void run(async () => { await mutations.updateGoalProgress.mutateAsync(input); })}
            onRemove={(id) => void run(async () => { await mutations.removeGoal.mutateAsync(id); })}
          />
          <AllocationPanel slices={metrics.allocation} />
          <div className="lg:col-span-2 space-y-8">
            <DividendCalendarPanel />
            <PortfolioRebalancePanel />
            <EtfXrayPanel />
            <FinanceWishlistPanel
              items={data.wishlist}
              freedomDaysForAmount={metrics.fire.freedomDaysForAmount}
              onAdd={(input) => void run(async () => { await mutations.addWishlist.mutateAsync(input); })}
              onUpdate={(input) => void run(async () => { await mutations.updateWishlistItem.mutateAsync(input); })}
              onRemove={(id) => void run(async () => { await mutations.removeWishlist.mutateAsync(id); })}
            />
          </div>
        </div>
      </div>
    );
  }

  // flows tab
  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <FinanceIncomePanel
          sources={data.incomeSources}
          onAdd={(input) => void run(async () => { await mutations.addIncomeSource.mutateAsync(input); })}
          onRemove={(id) => void run(async () => { await mutations.removeIncomeSource.mutateAsync(id); })}
        />
        <FinanceSubscriptionsPanel
          subscriptions={data.subscriptions}
          onAdd={(input) => void run(async () => { await mutations.addSubscription.mutateAsync(input); })}
          onRemove={(id) => void run(async () => { await mutations.removeSubscription.mutateAsync(id); })}
        />
        <FinanceBillsPanel
          bills={data.bills}
          onAdd={(input) => void run(async () => { await mutations.addBill.mutateAsync(input); })}
          onRemove={(id) => void run(async () => { await mutations.removeBill.mutateAsync(id); })}
        />
        <FinanceExpensesPanel
          transactions={data.transactions}
          onAdd={(input) => void run(async () => { await mutations.addTransaction.mutateAsync(input); })}
        />
        <div className="lg:col-span-2">
          <FinanceCsvImportPanel
            importing={mutations.importTransactions.isPending}
            onImport={async (rows: ParsedTransaction[]) => {
              const result = await mutations.importTransactions.mutateAsync(rows);
              notify(`Wgrano ${result.inserted} transakcji${result.skipped > 0 ? `, ${result.skipped} pominięto` : ''}`, 'success');
              return result;
            }}
          />
        </div>
      </div>
    </div>
  );
}
