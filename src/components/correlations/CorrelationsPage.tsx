import { Info } from 'lucide-react';
import { CATEGORY_LABELS } from '@vanguard/domain';
import CorrelationCard from './CorrelationCard';
import BehaviorEffectCard from './BehaviorEffectCard';
import CorrelationsHeader from './CorrelationsHeader';
import SleepDriversSection from './SleepDriversSection';
import CorrelationFilters from './CorrelationFilters';
import CorrelationsSummary from './CorrelationsSummary';
import CoverageFooter from './CoverageFooter';
import { useCorrelationsData } from './hooks/useCorrelationsData';
import { Card } from '../ui/Card';

export default function CorrelationsPage() {
  const {
    userId,
    correlations,
    behaviors,
    coverage,
    stats,
    loading,
    error,
    filter, setFilter,
    includeWeak, setIncludeWeak,
    load,
    highlights,
    deepSleepDrivers,
    remSleepDrivers,
    filteredWithoutSleepStages,
    sparseMetrics,
  } = useCorrelationsData();

  if (!userId) return null;

  return (
    <div className="min-h-screen w-full bg-background text-text-primary flex flex-col">
      <CorrelationsHeader loading={loading} onRefresh={load} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-16">
        {/* Epistemic guardrail */}
        <Card variant="accent" padding="0.75rem 1rem" className="flex gap-3" style={{ borderRadius: '18px' }}>
          <Info size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-text-secondary leading-relaxed">
            To warstwa pomiarowa: system skanuje wszystkie metryki z logów (≥5 dni danych) i pokazuje pary,
            gdzie współwystępowanie jest czytelne — także te, których byś nie sprawdził ręcznie. N ≠ przyczyna.
          </p>
        </Card>

        <CorrelationsSummary
          loading={loading}
          stats={stats}
          includeWeak={includeWeak}
          error={error}
          correlationsCount={correlations.length}
          sparseMetrics={sparseMetrics}
        />

        {highlights.length > 0 && (
          <section className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
              Najsilniejsze obserwacje (p&lt;0.05, N≥10)
            </p>
            <div className="space-y-3">
              {highlights.map(h => (
                <CorrelationCard key={h.id} item={h} expanded />
              ))}
            </div>
          </section>
        )}

        {(filter === 'all' || filter === 'sen') && (
          <SleepDriversSection
            title="Co wpływa na sen głęboki (Oura)"
            subtitle="Wybrane z pełnego skanu — wszystko, co ma dane, vs deep sleep (Oura)."
            titleColor="text-primary dark:text-primary"
            drivers={deepSleepDrivers}
          />
        )}

        {(filter === 'all' || filter === 'sen') && (
          <SleepDriversSection
            title="Co wpływa na sen REM (Oura)"
            subtitle="To samo dla REM — pary, które wyszły ze skanu, nie z ręcznej listy hipotez."
            titleColor="text-primary dark:text-primary"
            drivers={remSleepDrivers}
          />
        )}

        <CorrelationFilters filter={filter} setFilter={setFilter} />

        <label className="flex items-center gap-2 text-[11px] text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={includeWeak}
            onChange={(e) => setIncludeWeak(e.target.checked)}
            className="rounded border-border-custom"
          />
          Pokaż słabsze korelacje i zachowania (szum / kalibracja)
        </label>

        {/* Correlation grid */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
            {filter === 'all' ? 'Odkryte pary' : CATEGORY_LABELS[filter]} ({filteredWithoutSleepStages.length})
          </p>
          {filteredWithoutSleepStages.length === 0 ? (
            <p className="text-center text-[12px] text-text-muted py-8">
              {includeWeak
                ? 'Brak wyników w tej kategorii — loguj dane kilka dni z rzędu.'
                : 'Brak mocnych sygnałów w tej kategorii. Włącz słabsze korelacje albo loguj regularniej (kawa z godziną, Oura, treningi).'}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredWithoutSleepStages.map(c => (
                <CorrelationCard key={c.id} item={c} />
              ))}
            </div>
          )}
        </section>

        {/* Behavior effects */}
        <section className="space-y-3 pt-4 border-t border-border-custom">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">
              Zachowania vs recovery (behavior_log)
            </p>
            <p className="text-[11px] text-text-muted mt-1">
              Alkohol, podróż, stres — tylko gdy efekt na recovery jest czytelny (p&lt;0.05 lub duży Cohen&apos;s d).
            </p>
          </div>
          {behaviors.length === 0 ? (
            <Card as="p" variant="outline" padding="1rem" className="text-[12px] text-text-muted text-center border-dashed">
              Brak czytelnych efektów zachowań — loguj alkohol/stres/podróż albo włącz słabsze wyniki powyżej.
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {behaviors.map(b => (
                <BehaviorEffectCard key={b.behavior_key} item={b} />
              ))}
            </div>
          )}
        </section>

        <CoverageFooter coverage={coverage} />
      </main>
    </div>
  );
}
