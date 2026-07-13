import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';
import { Card } from '../ui/Card';
import { useMedicalData } from './hooks/useMedicalData';
import { useRetestSuggestions } from './hooks/useMedicalRetestContext';
import {
  buildMarkerSeries,
  categoryLabel,
  diffDaysFromToday,
  formatMedicalDate,
  freshnessLabel,
  groupRowsByDate,
  groupSeriesByCategory,
  labFreshness,
  PRIORITY_CHART_MARKERS,
} from '../../lib/health/medicalAnalytics';
import { findLatestFullPanel } from '../../lib/health/medicalRetestContext';
import { computeBiologyScoresLite } from '../../lib/getBased/biologyScoresLite';
import MedicalBiologyScores from './MedicalBiologyScores';
import MedicalRetestPanel from './MedicalRetestPanel';
import MedicalTrendCharts from './MedicalTrendCharts';
import {
  BodyCompositionSection,
  CategorySection,
  KeyMarkerCards,
  PanelTimeline,
  Scale,
  SectionShell,
} from './MedicalLabSections';
import { useUserId } from '../../store/useStore';

const SUBSECTIONS = [
  { id: 'przeglad', label: 'Przegląd' },
  { id: 'retest', label: 'Co warto' },
  { id: 'scores', label: 'Biology Scores' },
  { id: 'trendy', label: 'Trendy' },
  { id: 'kategorie', label: 'Kategorie' },
  { id: 'panele', label: 'Panele' },
  { id: 'cialo', label: 'Skład ciała' },
] as const;

export default function MedicalStudiesPage() {
  const userId = useUserId();
  const { labs, bodyComposition, loading, error } = useMedicalData(userId!);

  const series = useMemo(() => buildMarkerSeries(labs), [labs]);
  const byCategory = useMemo(() => groupSeriesByCategory(series), [series]);
  const byDate = useMemo(() => groupRowsByDate(labs), [labs]);
  const fullPanel = useMemo(() => findLatestFullPanel(byDate), [byDate]);
  const { suggestions, userContext, loading: retestLoading } = useRetestSuggestions(
    userId!,
    series,
    labs,
  );

  const prioritySeries = useMemo(() => {
    const order = new Map(PRIORITY_CHART_MARKERS.map((k, i) => [k, i]));
    return [...series].sort((a, b) => {
      const ai = order.get(a.marker_key as (typeof PRIORITY_CHART_MARKERS)[number]) ?? 999;
      const bi = order.get(b.marker_key as (typeof PRIORITY_CHART_MARKERS)[number]) ?? 999;
      return ai - bi;
    });
  }, [series]);

  const latestPanelDate = labs[0]?.result_date ?? null;
  const latestAge = latestPanelDate ? diffDaysFromToday(latestPanelDate) : null;
  const latestFresh = labFreshness(latestAge);
  const categoryOrder = [...byCategory.keys()].sort((a, b) =>
    categoryLabel(a).localeCompare(categoryLabel(b), 'pl'),
  );
  const biologyScores = useMemo(() => computeBiologyScoresLite(series), [series]);

  if (!userId) return null;

  return (
    <div className="min-h-screen w-full bg-background text-text-primary flex flex-col">
      <header className="sticky top-0 z-30 w-full border-b border-border-custom bg-background/95 backdrop-blur-md">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="rounded-xl border border-border-custom p-2.5 text-text-muted hover:text-text-primary shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black font-display uppercase tracking-tight">Badania</h1>
            <p className="text-[11px] text-text-muted mt-0.5 truncate">
              {fullPanel
                ? `Ostatni pełny panel: ${formatMedicalDate(fullPanel.date)} · ${fullPanel.ageDays ?? '?'} dni temu`
                : 'Laboratoryjne wyniki · biology scores · trendy'}
            </p>
          </div>
        </div>
        {!loading && !error && labs.length > 0 && (
          <nav className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
            {SUBSECTIONS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="shrink-0 rounded-full border border-border-custom px-3 py-1.5 text-[9px] font-black uppercase text-text-muted hover:text-primary hover:border-primary/30 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <div className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-16 space-y-10">
        {loading ? (
          <Skeleton variant="card" className="h-64 rounded-2xl" />
        ) : error ? (
          <Card variant="danger" padding="0.75rem 1rem" className="text-[12px] text-rose-700 dark:text-rose-300">
            Nie udało się wczytać badań: {error}
          </Card>
        ) : labs.length === 0 && bodyComposition.length === 0 ? (
          <EmptyState
            icon="🧪"
            label="Brak danych badań. Wyniki pojawią się tu po imporcie z PDF."
          />
        ) : (
          <>
            <Card variant="notice" padding="0.75rem 1rem" className="text-[11px] text-text-secondary leading-relaxed">
              Kontekst z datą — nie diagnoza. Stary wynik nie opisuje automatycznie dzisiejszego stanu.
            </Card>

            <SectionShell id="przeglad" title="Przegląd" subtitle="Ostatni panel i kluczowe markery">
              {(latestPanelDate || series.length > 0) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {fullPanel && (
                    <div className="rounded-xl border border-border-custom bg-surface/40 px-3 py-2.5 col-span-2 sm:col-span-1">
                      <p className="text-[8px] font-black uppercase text-text-muted">Ostatni pełny panel</p>
                      <p className="text-[12px] font-bold text-text-primary mt-0.5">
                        {formatMedicalDate(fullPanel.date)}
                      </p>
                      <p className="text-[9px] text-text-muted">
                        {fullPanel.markerCount} markerów · {fullPanel.ageDays ?? '?'} dni temu
                      </p>
                    </div>
                  )}
                  {latestPanelDate && (
                    <div className="rounded-xl border border-border-custom bg-surface/40 px-3 py-2.5">
                      <p className="text-[8px] font-black uppercase text-text-muted">Ostatni wpis</p>
                      <p className="text-[12px] font-bold text-text-primary mt-0.5">
                        {formatMedicalDate(latestPanelDate)}
                      </p>
                      <p className="text-[9px] text-text-muted">
                        {freshnessLabel(latestFresh)} · {latestAge ?? '?'} dni temu
                      </p>
                    </div>
                  )}
                  <div className="rounded-xl border border-border-custom bg-surface/40 px-3 py-2.5">
                    <p className="text-[8px] font-black uppercase text-text-muted">Markery</p>
                    <p className="text-[12px] font-bold text-text-primary mt-0.5">{series.length}</p>
                    <p className="text-[9px] text-text-muted">{labs.length} wpisów</p>
                  </div>
                  <div className="rounded-xl border border-border-custom bg-surface/40 px-3 py-2.5 col-span-2 sm:col-span-1">
                    <p className="text-[8px] font-black uppercase text-text-muted">Skład ciała</p>
                    <p className="text-[12px] font-bold text-text-primary mt-0.5">{bodyComposition.length}</p>
                    <p className="text-[9px] text-text-muted">pomiarów BIA</p>
                  </div>
                </div>
              )}
              <KeyMarkerCards series={prioritySeries} limit={6} />
            </SectionShell>

            {labs.length > 0 && (
              <SectionShell
                id="retest"
                title="Co warto badać / odświeżyć"
                subtitle="Reguły + Oracle z kontekstem (wiek, trening, projekty)"
              >
                <MedicalRetestPanel
                  suggestions={suggestions}
                  userContext={userContext}
                  fullPanel={fullPanel}
                  loading={retestLoading}
                />
              </SectionShell>
            )}

            {biologyScores.length > 0 && (
              <SectionShell
                id="scores"
                title="Biology Scores"
                subtitle="Wzorce z liczb (getbased) — nie diagnoza"
              >
                <MedicalBiologyScores scores={biologyScores} />
              </SectionShell>
            )}

            {series.some((s) => s.history.length >= 2) && (
              <SectionShell
                id="trendy"
                title="Trendy"
                subtitle="≥2 pomiary · zielony pas = zakres optymalny getbased (gdy znany)"
              >
                <MedicalTrendCharts series={series} />
              </SectionShell>
            )}

            {categoryOrder.length > 0 && (
              <SectionShell id="kategorie" title="Kategorie" subtitle="Tabela z normą lab + optymalnym (getbased)">
                <div className="space-y-3">
                  {categoryOrder.map((cat) => (
                    <CategorySection key={cat} catKey={cat} series={byCategory.get(cat)!} />
                  ))}
                </div>
              </SectionShell>
            )}

            {byDate.size > 0 && (
              <SectionShell id="panele" title="Historia paneli" subtitle="Zestawy wyników wg daty pobrania">
                <PanelTimeline byDate={byDate} />
              </SectionShell>
            )}

            {bodyComposition.length > 0 && (
              <SectionShell
                id="cialo"
                title="Skład ciała"
                subtitle="BIA / Tanita — szacunek, nie diagnostyka"
                icon={<Scale size={14} className="text-text-muted mt-0.5 shrink-0" />}
              >
                <BodyCompositionSection rows={bodyComposition} />
              </SectionShell>
            )}
          </>
        )}
      </div>
    </div>
  );
}
