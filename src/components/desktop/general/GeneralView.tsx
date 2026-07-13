import { Link } from 'react-router-dom';
import { BarChart2, ChevronRight } from 'lucide-react';
import { useGeneralViewData } from './hooks/useGeneralViewData';
import Skeleton from '../../ui/Skeleton';
import { Card } from '../../ui/Card';
import {
  buildTimeline,
  buildSleepHrvScatter,
} from './generalView/generalViewUtils';

import { FRICTION_COLOR as FRICTION_COLOR_TYPED } from '../../../lib/frictionColors';
import { C, OuraRow } from '../desktopUtils';

import GeneralHealthCharts from './generalView/GeneralHealthCharts';
import GeneralFrictionPanels from './generalView/GeneralFrictionPanels';
import GeneralMemexPanels from './generalView/GeneralMemexPanels';
import GeneralRecommendationsPanel from './generalView/GeneralRecommendationsPanel';

const FRICTION_COLOR: Record<string, string> = FRICTION_COLOR_TYPED;

export default function GeneralView({
  userId,
  oura: ouraProp,
}: {
  userId: string;
  oura?: OuraRow[];
}) {
  const {
    strain,
    oura,
    patterns,
    wiki,
    curiosity,
    friction,
    recommendations,
    loading,
  } = useGeneralViewData({ userId, ouraProp });

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} variant="card" className="h-48 rounded-[20px]" />
        ))}
      </div>
    );
  }

  // Merge strain + oura by date
  const timelineData = buildTimeline(strain, oura);
  const sleepSeries = oura.map((r) => ({
    d: r.date.slice(5),
    sleepScore: r.sleep_score ?? r.sleep_efficiency ?? null,
    sleepHours: r.total_sleep_hours ?? null,
  }));
  const hasSleepScore = sleepSeries.some((r) => r.sleepScore != null);
  const sleepUsesHours = !hasSleepScore && sleepSeries.some((r) => r.sleepHours != null);
  const sleepChartData = sleepSeries
    .map((r) => ({
      d: r.d,
      value: sleepUsesHours ? r.sleepHours : r.sleepScore,
    }))
    .filter((r) => r.value != null);

  // Friction by type — last 90d counts
  const frictionCounts: Record<string, number> = {};
  friction.forEach((f) => {
    const t = f.friction_type || 'other';
    frictionCounts[t] = (frictionCounts[t] || 0) + 1;
  });
  const frictionBar = Object.entries(frictionCounts)
    .map(([type, count]) => ({
      type: type.replace(/_/g, ' '),
      count,
      color: FRICTION_COLOR[type] || '#9ca3af',
    }))
    .sort((a, b) => b.count - a.count);

  const sleepHrvCorr = buildSleepHrvScatter(oura);

  // Readiness distribution
  const readinessCounts: Record<string, number> = {};
  strain.forEach((s) => {
    const l = s.readiness_level || 'insufficient';
    readinessCounts[l] = (readinessCounts[l] || 0) + 1;
  });

  const tick = 'var(--color-text-muted)';

  return (
    <div className="space-y-5">
      <Link
        id="korelacje"
        to="/korelacje"
        className="scroll-mt-28 block group"
      >
        <Card variant="outline" padding="1.25rem" className="flex items-center gap-4 hover:bg-primary/[0.08] transition-colors" style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.04)' }}>
        <div className="rounded-full border border-primary/25 bg-background p-2.5 text-primary">
          <BarChart2 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-primary">Korelacje</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            Skan odkrywczy z logów — sen, deep/REM, kawa, trening, nawyki (Lenie)…
          </p>
        </div>
        <ChevronRight size={16} className="text-text-muted group-hover:text-primary shrink-0 transition-colors" />
        </Card>
      </Link>

      {/* ── SEKCJA: ZDROWIE ── */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border-custom" />
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Zdrowie — 90 dni</span>
        <div className="h-px flex-1 bg-border-custom" />
      </div>

      <GeneralHealthCharts
        timelineData={timelineData}
        sleepChartData={sleepChartData}
        sleepUsesHours={sleepUsesHours}
        sleepHrvCorr={sleepHrvCorr}
        readinessCounts={readinessCounts}
        strainLength={strain.length}
        tick={tick}
      />

      {/* ── SEKCJA: TARCIA ── */}
      <div className="flex items-center gap-3 mt-2">
        <div className="h-px flex-1 bg-border-custom" />
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
          Tarcia — 90 dni ({friction.length} zdarzeń)
        </span>
        <div className="h-px flex-1 bg-border-custom" />
      </div>

      <GeneralFrictionPanels
        frictionBar={frictionBar}
        friction={friction}
        frictionColor={FRICTION_COLOR}
        tick={tick}
      />

      {/* ── SEKCJA: MEMEX ── */}
      <div id="pamiec" className="scroll-mt-28 flex items-center gap-3 mt-2">
        <div className="h-px flex-1 bg-border-custom" />
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
          Memex — Pamięć systemu
        </span>
        <div className="h-px flex-1 bg-border-custom" />
      </div>

      <GeneralMemexPanels
        patterns={patterns}
        curiosity={curiosity}
        wiki={wiki}
        emeraldColor={C.emerald}
      />

      {/* ── SEKCJA: ZALECENIA WYROCZNI ── */}
      <div className="flex items-center gap-3 mt-2">
        <div className="h-px flex-1 bg-border-custom" />
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
          Zalecenia Wyroczni
        </span>
        <div className="h-px flex-1 bg-border-custom" />
      </div>

      <GeneralRecommendationsPanel recommendations={recommendations} />
    </div>
  );
}
