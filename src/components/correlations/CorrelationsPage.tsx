import { useState } from 'react';
import { Info } from 'lucide-react';
import CorrelationCard from './CorrelationCard';
import CorrelationsHeader from './CorrelationsHeader';
import CorrelationFilters from './CorrelationFilters';
import { useCorrelationsData } from './hooks/useCorrelationsData';
import { useNOf1Store, NOf1Experiment } from '../../store/nOf1Store';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import { notify } from '../../lib/notify';

export default function CorrelationsPage() {
  const {
    userId,
    filteredFactors,
    confirmedFactors,
    probableFactors,
    hypotheses,
    load,
    sparseMetrics,
    impactFactors,
  } = useCorrelationsData();

  const { experiments, cancelExperiment, completeExperiment } = useNOf1Store();
  const [activeTab, setActiveTab] = useState<'main' | 'experiments' | 'archive'>('main');

  if (!userId) return null;

  const activeExperiments = experiments.filter((e) => e.status === 'active');
  const completedExperiments = experiments.filter((e) => e.status === 'completed');

  const handleCompleteExperiment = (exp: NOf1Experiment) => {
    const factor = impactFactors.find((f) => f.x_metric === exp.factorKey && f.y_metric === exp.outcomeKey);
    if (!factor || factor.scatter.length === 0) {
      completeExperiment(exp.id, null, null, null, 'Ukończono bez zebranych danych.');
      notify('Ukończono eksperyment (brak danych w logach)', 'info');
      return;
    }

    const expPoints = factor.scatter.filter((p) => p.day >= exp.startDate && p.day <= exp.endDate);
    const baselinePoints = factor.scatter.filter((p) => p.day < exp.startDate);

    const expY = expPoints.map((p) => p.y);
    const baseY = baselinePoints.map((p) => p.y);

    const expMean = expY.length > 0 ? expY.reduce((a, b) => a + b, 0) / expY.length : null;
    const baseMean = baseY.length > 0 ? baseY.reduce((a, b) => a + b, 0) / baseY.length : null;
    const delta = expMean !== null && baseMean !== null ? expMean - baseMean : null;

    completeExperiment(exp.id, baseMean, expMean, delta, 'Ewaluacja automatyczna na podstawie logów.');
    
    let resultMsg = 'Eksperyment ukończony!';
    if (delta !== null) {
      const formatted = delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
      resultMsg += ` Różnica średniej: ${formatted} dla ${exp.outcomeLabel}.`;
    }
    notify(resultMsg, 'success');
  };

  const getDaysRemaining = (endDateStr: string) => {
    const today = new Date();
    const end = new Date(endDateStr);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <div className="min-h-screen w-full bg-background text-text-primary flex flex-col">
      <CorrelationsHeader loading={false} onRefresh={load} />

      <div className="border-b border-border-custom bg-surface-solid/40 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 flex gap-4 text-xs font-semibold">
          <Button
            variant="ghost"
            onClick={() => setActiveTab('main')}
            className={`py-3.5 border-b-2 rounded-none px-0 tracking-normal hover:bg-transparent ${
              activeTab === 'main' ? 'border-primary text-primary font-bold' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Czynniki wpływu
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('experiments')}
            className={`py-3.5 border-b-2 rounded-none px-0 tracking-normal hover:bg-transparent flex items-center gap-1.5 ${
              activeTab === 'experiments' ? 'border-primary text-primary font-bold' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Eksperymenty N-of-1
            {activeExperiments.length > 0 && (
              <span className="bg-success/20 text-success text-3xs px-1.5 py-0.5 rounded-full border border-success/20 font-bold animate-pulse">
                {activeExperiments.length}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveTab('archive')}
            className={`py-3.5 border-b-2 rounded-none px-0 tracking-normal hover:bg-transparent ${
              activeTab === 'archive' ? 'border-primary text-primary font-bold' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Archiwum dowodów
          </Button>
        </div>
      </div>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-16">
        {activeTab === 'main' && (
          <>
            <Card variant="accent" padding="0.75rem 1rem" className="flex gap-3" style={{ borderRadius: 'var(--ds-inline-style-18px)' }}>
              <Info size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary leading-relaxed">
                Strona analizuje, które czynniki mają statystycznie stabilny wpływ na Twój sen, readiness, wykonanie i formę.
                Sygnały przechodzą testy istotności (FDR) oraz stabilności.
              </p>
            </Card>

            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-15em)] text-text-muted">
                Najważniejsze teraz (Kluczowe czynniki)
              </h2>
              {confirmedFactors.length === 0 && probableFactors.length === 0 ? (
                <Card variant="outline" padding="2rem" className="text-center text-xs text-text-muted border-dashed">
                  Brak wykazanych mocnych czynników wpływu na ten moment. Zbieraj więcej logów.
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {confirmedFactors.map(f => (
                    <CorrelationCard key={f.id} item={f} />
                  ))}
                  {probableFactors.map(f => (
                    <CorrelationCard key={f.id} item={f} />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-15em)] text-text-muted">
                Do sprawdzenia (Kandydaci na eksperyment)
              </h2>
              {hypotheses.length === 0 ? (
                <Card variant="outline" padding="2rem" className="text-center text-xs text-text-muted border-dashed">
                  Brak hipotez do zbadania w obecnym oknie danych.
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {hypotheses.map(f => (
                    <CorrelationCard key={f.id} item={f} showExperimentButton />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3 pt-2">
              <h2 className="text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-15em)] text-text-muted">
                Brak wystarczających danych
              </h2>
              {sparseMetrics.length === 0 ? (
                <p className="text-xs text-text-muted">Logowanie jest kompletne i wystarczające.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  {sparseMetrics.slice(0, 3).map(m => (
                    <Card key={m.key} variant="surface" padding="0.75rem" className="text-xs border-dashed">
                      <div className="font-bold text-text-primary">{m.hint}</div>
                      <p className="text-3xs text-text-muted mt-1">Potrzeba jeszcze {m.needed} dni logowania.</p>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'experiments' && (
          <>
            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-15em)] text-text-muted">
                Aktywne eksperymenty N-of-1
              </h2>
              {activeExperiments.length === 0 ? (
                <Card variant="outline" padding="2rem" className="text-center text-xs text-text-muted border-dashed">
                  Brak aktywnego eksperymentu. Uruchom test dla wybranej hipotezy w zakładce &quot;Czynniki wpływu&quot;.
                </Card>
              ) : (
                <div className="space-y-3">
                  {activeExperiments.map(exp => {
                    const daysLeft = getDaysRemaining(exp.endDate);
                    const pct = Math.round(((exp.durationDays - daysLeft) / exp.durationDays) * 100);
                    return (
                      <Card key={exp.id} variant="surface" padding="1.25rem" className="border border-success/20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <span className="text-3xs font-black uppercase tracking-widest text-success bg-success/10 px-2 py-0.5 rounded border border-success/20">
                              W toku: Dzień {exp.durationDays - daysLeft} z {exp.durationDays}
                            </span>
                            <h3 className="text-sm font-bold text-text-primary mt-2">
                              Eksperyment: {exp.factorLabel} vs {exp.outcomeLabel}
                            </h3>
                            <p className="text-xs text-text-secondary mt-1">{exp.conditionDescription}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleCompleteExperiment(exp)}
                              className="text-xs font-bold"
                            >
                              Zakończ
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm('Czy na pewno chcesz anulować ten eksperyment?')) {
                                  cancelExperiment(exp.id);
                                  notify('Anulowano eksperyment', 'info');
                                }
                              }}
                              className="text-xs font-semibold"
                            >
                              Anuluj
                            </Button>
                          </div>
                        </div>

                        <div className="w-full bg-border-custom/50 rounded-full h-1.5 mt-4 overflow-hidden">
                          <div className="bg-success h-1.5 transition-all duration-300" style={{ width: `${pct}%` }}></div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3 pt-4">
              <h2 className="text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-15em)] text-text-muted">
                Ukończone eksperymenty
              </h2>
              {completedExperiments.length === 0 ? (
                <p className="text-xs text-text-muted">Brak zakończonych eksperymentów.</p>
              ) : (
                <div className="space-y-3">
                  {completedExperiments.map(exp => {
                    const formattedDelta = exp.delta !== null
                      ? (exp.delta > 0 ? `+${exp.delta.toFixed(1)}` : exp.delta.toFixed(1))
                      : 'Brak danych';
                    return (
                      <Card key={exp.id} variant="surface" padding="1rem" className="border border-border-custom">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-3xs font-bold text-text-muted uppercase">Zakończono: {exp.completedAt}</span>
                              <span className="text-3xs font-black uppercase text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/20">Osobisty dowód</span>
                            </div>
                            <h4 className="text-xs font-bold text-text-primary mt-1.5">
                              {exp.factorLabel} ➔ {exp.outcomeLabel}
                            </h4>
                            <p className="text-2xs text-text-muted mt-0.5">{exp.conditionDescription}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-black text-success tabular-nums">
                              {formattedDelta}
                            </p>
                            <p className="text-3xs font-medium text-text-muted mt-0.5 font-sans">zmiana średniej</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'archive' && (
          <>
            <CorrelationFilters filter="all" setFilter={() => {}} />

            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-15em)] text-text-muted">
                  Pełny skan par ({filteredFactors.length})
                </h3>
              </div>

              {filteredFactors.length === 0 ? (
                <p className="text-center text-xs text-text-muted py-8">
                  Brak wyników.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredFactors.map(c => (
                    <CorrelationCard key={c.id} item={c} expanded />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
